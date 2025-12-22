import {Logger} from "../log.js";

export class TestLogger implements Logger {
  error(message: string): void {
    throw new Error(`Error: ${message}`);
  }

  warn(message: string): void {
    console.warn(message);
  }

  info(message: string): void {
    console.info(message);
  }

  log(message: string): void {
    console.warn(message);
  }
}
