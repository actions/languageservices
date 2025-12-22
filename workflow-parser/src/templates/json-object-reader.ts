import {ObjectReader} from "./object-reader.js";
import {EventType, ParseEvent} from "./parse-event.js";
import {
  LiteralToken,
  SequenceToken,
  MappingToken,
  NullToken,
  BooleanToken,
  NumberToken,
  StringToken
} from "./tokens/index.js";

export class JSONObjectReader implements ObjectReader {
  private readonly _fileId: number | undefined;
  private readonly _generator: Generator<ParseEvent, void>;
  private _current: IteratorResult<ParseEvent, void>;

  public constructor(fileId: number | undefined, input: string) {
    this._fileId = fileId;
    const value: unknown = JSON.parse(input);
    this._generator = this.getParseEvents(value, true);
    this._current = this._generator.next();
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
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentStart) {
        this._current = this._generator.next();
        return;
      }
    }

    throw new Error("Expected start of reader");
  }

  /**
   * Returns all tokens (depth first)
   */
  private *getParseEvents(value: unknown, root?: boolean): Generator<ParseEvent, void> {
    if (root) {
      yield new ParseEvent(EventType.DocumentStart, undefined);
    }
    switch (typeof value) {
      case "undefined":
        yield new ParseEvent(EventType.Literal, new NullToken(this._fileId, undefined, undefined));
        break;
      case "boolean":
        yield new ParseEvent(EventType.Literal, new BooleanToken(this._fileId, undefined, value, undefined));
        break;
      case "number":
        yield new ParseEvent(EventType.Literal, new NumberToken(this._fileId, undefined, value, undefined));
        break;
      case "string":
        yield new ParseEvent(EventType.Literal, new StringToken(this._fileId, undefined, value, undefined));
        break;
      case "object":
        // null
        if (value === null) {
          yield new ParseEvent(EventType.Literal, new NullToken(this._fileId, undefined, undefined));
        }
        // array
        else if (Array.isArray(value)) {
          yield new ParseEvent(EventType.SequenceStart, new SequenceToken(this._fileId, undefined, undefined));
          for (const item of value) {
            for (const e of this.getParseEvents(item)) {
              yield e;
            }
          }
          yield new ParseEvent(EventType.SequenceEnd, undefined);
        }
        // object
        else {
          yield new ParseEvent(EventType.MappingStart, new MappingToken(this._fileId, undefined, undefined));
          for (const key of Object.keys(value)) {
            yield new ParseEvent(EventType.Literal, new StringToken(this._fileId, undefined, key, undefined));
            for (const e of this.getParseEvents(value[key as keyof typeof value])) {
              yield e;
            }
          }
          yield new ParseEvent(EventType.MappingEnd, undefined);
        }
        break;
      default:
        throw new Error(`Unexpected value type '${typeof value}' when reading object`);
    }

    if (root) {
      yield new ParseEvent(EventType.DocumentEnd, undefined);
    }
  }
}
