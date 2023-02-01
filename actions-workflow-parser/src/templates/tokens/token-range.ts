/** Represents the position within a template object */
export type Position = {
  /** The one-based line value */
  line: number;
  /** The one-based column value */
  column: number;
};

export type TokenRange = {
  start: Position;
  end: Position;
};
