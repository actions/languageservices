import {isCollection, isDocument, isMap, isPair, isScalar, isSeq, LineCounter, parseDocument, Scalar} from "yaml";
import type {LinePos} from "yaml/dist/errors";
import type {NodeBase} from "yaml/dist/nodes/Node";
import {ObjectReader} from "../templates/object-reader";
import {EventType, ParseEvent} from "../templates/parse-event";
import {TemplateContext} from "../templates/template-context";
import {
  BooleanToken,
  LiteralToken,
  MappingToken,
  NullToken,
  NumberToken,
  SequenceToken,
  StringToken
} from "../templates/tokens/index";
import {Position, TokenRange} from "../templates/tokens/token-range";

export class YamlObjectReader implements ObjectReader {
  private readonly _generator: Generator<ParseEvent>;
  private _current!: IteratorResult<ParseEvent>;
  private fileId?: number;
  private lineCounter = new LineCounter();

  constructor(context: TemplateContext, fileId: number | undefined, content: string) {
    const doc = parseDocument(content, {
      lineCounter: this.lineCounter,
      keepSourceTokens: true,
      uniqueKeys: false // Uniqueness is validated by the template reader
    });
    for (const err of doc.errors) {
      context.error(fileId, err.message, rangeFromLinePos(err.linePos));
    }
    this._generator = this.getNodes(doc);
    this.fileId = fileId;
  }

  private *getNodes(node: unknown): Generator<ParseEvent, void> {
    let range = this.getRange(node as NodeBase | undefined);

    if (isDocument(node)) {
      yield new ParseEvent(EventType.DocumentStart);
      for (const item of this.getNodes(node.contents)) {
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
        for (const child of this.getNodes(item)) {
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
      yield new ParseEvent(EventType.Literal, YamlObjectReader.getLiteralToken(this.fileId, range, node as Scalar));
    }

    if (isPair(node)) {
      const scalarKey = node.key as Scalar;
      range = this.getRange(scalarKey);
      const key = scalarKey.value as string;
      yield new ParseEvent(EventType.Literal, new StringToken(this.fileId, range, key, undefined));
      for (const child of this.getNodes(node.value)) {
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
      const parseEvent = this._current.value as ParseEvent;
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
      const parseEvent = this._current.value as ParseEvent;
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
