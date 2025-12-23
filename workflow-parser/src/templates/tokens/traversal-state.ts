import {TemplateToken} from "./index.js";
import {MappingToken} from "./mapping-token.js";
import {SequenceToken} from "./sequence-token.js";
import {TokenType} from "./types.js";

export class TraversalState {
  private readonly _token: TemplateToken;
  private index = -1;
  private isKey = false;
  public readonly parent: TraversalState | undefined;
  public current: TemplateToken | undefined;
  public currentKey: TemplateToken | undefined;

  public constructor(parent: TraversalState | undefined, token: TemplateToken) {
    this.parent = parent;
    this._token = token;
    this.current = token;
  }

  public moveNext(omitKeys: boolean): boolean {
    switch (this._token.templateTokenType) {
      case TokenType.Sequence: {
        const sequence = this._token as SequenceToken;
        if (++this.index < sequence.count) {
          this.current = sequence.get(this.index);
          return true;
        }
        this.current = undefined;
        return false;
      }

      case TokenType.Mapping: {
        const mapping = this._token as MappingToken;

        // Already returned the key, now return the value
        if (this.isKey) {
          this.isKey = false;
          this.currentKey = this.current;
          this.current = mapping.get(this.index).value;
          return true;
        }

        // Move next
        if (++this.index < mapping.count) {
          // Skip the key, return the value
          if (omitKeys) {
            this.isKey = false;
            this.currentKey = mapping.get(this.index).key;
            this.current = mapping.get(this.index).value;
            return true;
          }

          // Return the key
          this.isKey = true;
          this.currentKey = undefined;
          this.current = mapping.get(this.index).key;
          return true;
        }

        this.currentKey = undefined;
        this.current = undefined;
        return false;
      }

      default:
        throw new Error(`Unexpected token type '${this._token.templateTokenType}' when traversing state`);
    }
  }
}
