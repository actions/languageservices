import {LiteralToken, SequenceToken, MappingToken} from "./tokens/index.js";

/**
 * Interface for reading a source object (or file).
 * This interface is used by TemplateReader to build a TemplateToken DOM.
 */
export interface ObjectReader {
  allowLiteral(): LiteralToken | undefined;

  // maybe rename these since we don't have out params
  allowSequenceStart(): SequenceToken | undefined;

  allowSequenceEnd(): boolean;

  allowMappingStart(): MappingToken | undefined;

  allowMappingEnd(): boolean;

  validateStart(): void;

  validateEnd(): void;
}
