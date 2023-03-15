export interface TraceWriter {
  error(message: string): void;

  info(message: string): void;

  verbose(message: string): void;
}

export class NoOperationTraceWriter implements TraceWriter {
  public error(): void {
    // do nothing
  }

  public info(): void {
    // do nothing
  }

  public verbose(): void {
    // do nothing
  }
}
