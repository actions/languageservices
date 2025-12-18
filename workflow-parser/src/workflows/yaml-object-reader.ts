import {
  isAlias,
  isCollection,
  isDocument,
  isMap,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  Scalar
} from "yaml";
import type {Document} from "yaml";
import {ObjectReader} from "../templates/object-reader.js";
import {EventType, ParseEvent} from "../templates/parse-event.js";
import {
  BooleanToken,
  LiteralToken,
  MappingToken,
  NullToken,
  NumberToken,
  SequenceToken,
  StringToken
} from "../templates/tokens/index.js";
import {Position, TokenRange} from "../templates/tokens/token-range.js";

// Internal yaml types - defined locally since yaml package doesn't export them
type LinePos = {line: number; col: number};
type NodeBase = {range?: [number, number, number] | null};

export type YamlError = {
  message: string;
  range: TokenRange | undefined;
};

export class YamlObjectReader implements ObjectReader {
  private readonly _generator: Generator<ParseEvent>;
  private _current!: IteratorResult<ParseEvent>;
  private readonly doc: Document;
  private fileId?: number;
  private lineCounter = new LineCounter();

  public errors: YamlError[] = [];

  constructor(fileId: number | undefined, content: string) {
    this.doc = parseDocument(content, {
      lineCounter: this.lineCounter,
      keepSourceTokens: true,
      uniqueKeys: false // Uniqueness is validated by the template reader
    });
    for (const err of this.doc.errors) {
      this.errors.push({message: err.message, range: rangeFromLinePos(err.linePos)});
    }
    this._generator = this.getNodes(this.doc, new Set());
    this.fileId = fileId;
  }

  private *getNodes(node: unknown, aliasResolutionStack: Set<unknown>): Generator<ParseEvent, void> {
    let range = this.getRange(node as NodeBase | undefined);

    if (isDocument(node)) {
      yield new ParseEvent(EventType.DocumentStart);
      for (const item of this.getNodes(node.contents, new Set())) {
        yield item;
      }
      yield new ParseEvent(EventType.DocumentEnd);
    }

    if (isCollection(node)) {
      if (isSeq(node)) {
        yield new ParseEvent(EventType.SequenceStart, new SequenceToken(this.fileId, range, undefined));
      } else if (isMap(node)) {
        yield new ParseEvent(EventType.MappingStart, new MappingToken(this.fileId, range, undefined));
      }

      for (const item of node.items) {
        for (const child of this.getNodes(item, aliasResolutionStack)) {
          yield child;
        }
      }
      if (isSeq(node)) {
        yield new ParseEvent(EventType.SequenceEnd);
      } else if (isMap(node)) {
        yield new ParseEvent(EventType.MappingEnd);
      }
    }

    if (isScalar(node)) {
      yield new ParseEvent(EventType.Literal, YamlObjectReader.getLiteralToken(this.fileId, range, node));
    }

    // Handle YAML aliases - resolve to the anchored value
    if (isAlias(node)) {
      const resolved = node.resolve(this.doc);
      if (resolved) {
        // Prevent infinite recursion from circular aliases
        if (aliasResolutionStack.has(resolved)) {
          // Silently ignore circular reference - the missing content will cause
          // downstream validation errors which is acceptable for this edge case
          return;
        }
        // Track this node in the alias resolution stack
        const newStack = new Set(aliasResolutionStack);
        newStack.add(resolved);
        // Yield the resolved node's contents
        yield* this.getNodes(resolved, newStack);
      }
      // If unresolved, the yaml library already reports an error
      return;
    }

    if (isPair(node)) {
      const scalarKey = node.key as Scalar;
      range = this.getRange(scalarKey);
      const key = scalarKey.value as string;
      yield new ParseEvent(EventType.Literal, new StringToken(this.fileId, range, key, undefined));
      for (const child of this.getNodes(node.value, aliasResolutionStack)) {
        yield child;
      }
    }
  }

  private getRange(node: NodeBase | undefined): TokenRange | undefined {
    const range = node?.range ?? [];
    const startPos = range[0];
    const endPos = range[1];

    if (startPos !== undefined && endPos !== undefined) {
      const slp = this.lineCounter.linePos(startPos);
      const elp = this.lineCounter.linePos(endPos);

      return {
        start: {line: slp.line, column: slp.col},
        end: {line: elp.line, column: elp.col}
      };
    }

    return undefined;
  }

  private static getLiteralToken(fileId: number | undefined, range: TokenRange | undefined, token: Scalar) {
    const value = token.value;

    if (value === null || value === undefined) {
      return new NullToken(fileId, range, undefined);
    }

    switch (typeof value) {
      case "number":
        return new NumberToken(fileId, range, value, undefined);
      case "boolean":
        return new BooleanToken(fileId, range, value, undefined);
      case "string": {
        let source: string | undefined;
        if (token.srcToken && "source" in token.srcToken) {
          source = token.srcToken.source;
        }

        return new StringToken(fileId, range, value, undefined, source);
      }
      default:
        throw new Error(`Unexpected value type '${typeof value}' when reading object`);
    }
  }

  public allowLiteral(): LiteralToken | undefined {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.Literal) {
        this._current = this._generator.next();
        return parseEvent.token as LiteralToken;
      }
    }

    return undefined;
  }

  public allowSequenceStart(): SequenceToken | undefined {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.SequenceStart) {
        this._current = this._generator.next();
        return parseEvent.token as SequenceToken;
      }
    }

    return undefined;
  }

  public allowSequenceEnd(): boolean {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.SequenceEnd) {
        this._current = this._generator.next();
        return true;
      }
    }

    return false;
  }

  public allowMappingStart(): MappingToken | undefined {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.MappingStart) {
        this._current = this._generator.next();
        return parseEvent.token as MappingToken;
      }
    }

    return undefined;
  }

  public allowMappingEnd(): boolean {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.MappingEnd) {
        this._current = this._generator.next();
        return true;
      }
    }

    return false;
  }

  public validateEnd(): void {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentEnd) {
        this._current = this._generator.next();
        return;
      }
    }

    throw new Error("Expected end of reader");
  }

  public validateStart(): void {
    if (!this._current) {
      this._current = this._generator.next();
    }

    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentStart) {
        this._current = this._generator.next();
        return;
      }
    }

    throw new Error("Expected start of reader");
  }
}

function rangeFromLinePos(linePos: [LinePos] | [LinePos, LinePos] | undefined): TokenRange | undefined {
  if (linePos === undefined) {
    return;
  }
  // TokenRange and linePos are both 1-based
  const start: Position = {line: linePos[0].line, column: linePos[0].col};
  const end: Position = linePos.length == 2 ? {line: linePos[1].line, column: linePos[1].col} : start;
  return {start, end};
}
