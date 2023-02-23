export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3
}

const loggers: Logger[] = [];
let logLevel = LogLevel.Warn;

export interface Logger {
  /**
   * Show an error message.
   *
   * @param message The message to show.
   */
  error(message: string): void;
  /**
   * Show a warning message.
   *
   * @param message The message to show.
   */
  warn(message: string): void;
  /**
   * Show an information message.
   *
   * @param message The message to show.
   */
  info(message: string): void;
  /**
   * Log a message.
   *
   * @param message The message to log.
   */
  log(message: string): void;
}

export function registerLogger(l: Logger) {
  loggers.push(l);
}

export function setLogLevel(ll: LogLevel) {
  logLevel = ll;
}

export function log(message: string): void {
  if (logLevel > LogLevel.Debug) {
    return;
  }

  for (const l of loggers) {
    l.log(message);
  }
}

export function info(message: string): void {
  if (logLevel > LogLevel.Info) {
    return;
  }

  for (const l of loggers) {
    l.info(message);
  }
}

export function warn(message: string): void {
  if (logLevel > LogLevel.Warn) {
    return;
  }

  for (const l of loggers) {
    l.warn(message);
  }
}

export function error(message: string): void {
  if (logLevel > LogLevel.Error) {
    return;
  }

  for (const l of loggers) {
    l.error(message);
  }
}
