import {log} from "@github/actions-languageservice/log";

export async function timeOperation<T>(name: string, f: () => T): Promise<T> {
  const start = Date.now();
  const result = f();
  if (result instanceof Promise) {
    await result;
  }

  const end = Date.now();

  log(`${name} took ${end - start}ms`);
  return result;
}
