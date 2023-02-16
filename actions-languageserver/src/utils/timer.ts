import {log} from "@github/actions-languageservice/log";

export function timeOperation<T>(name: string, f: () => T): T {
  const start = Date.now();
  const result = f();
  const end = Date.now();

  log(`${name} took ${end - start}ms`);
  return result;
}
