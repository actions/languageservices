export type Position = [line: number, character: number];

export type TokenRange = {
  start: Position;
  end: Position;
};
