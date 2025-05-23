import descriptions from "./descriptions.json";

export const RootContext = "root";
const FunctionContext = "functions";

/**
 * Get a description for a built-in context
 * @param context Name of the context, for example `github`
 * @param key Key of the context, for example `actor`
 * @returns Description if one is found, otherwise undefined
 */
export function getDescription(context: string, key: string): string | undefined {
  // The inferred type doesn't quite match the actual type, use any to work around that
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  return (descriptions as any)[context]?.[key]?.description;
}

/**
 * Get a description for a context function
 * This will not include functions defined by the expressions library (e.g. `contains`, `fromJSON`, etc.)
 * @param name Name of the function, for example `hashFiles`
 */
export function getFunctionDescription(name: string): string | undefined {
  return getDescription(FunctionContext, name);
}
