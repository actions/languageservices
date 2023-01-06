export interface TraceWriter {
  error(message: string): void

  info(message: string): void

  verbose(message: string): void
}

export class NoOperationTraceWriter implements TraceWriter {
  public error(message: string): void {}

  public info(message: string): void {}

  public verbose(message: string): void {}
}
