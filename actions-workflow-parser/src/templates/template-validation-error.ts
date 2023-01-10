import {TokenRange} from "./tokens/token-range";

/**
 * Provides information about an error which occurred during validation
 */
export class TemplateValidationError {
  constructor(
    public readonly rawMessage: string,
    public readonly prefix: string | undefined,
    public readonly code: string | undefined,
    public readonly range: TokenRange | undefined
  ) {}

  public get message(): string {
    if (this.prefix) {
      return `${this.prefix}: ${this.rawMessage}`;
    }

    return this.rawMessage;
  }

  public toString(): string {
    return this.message;
  }
}
