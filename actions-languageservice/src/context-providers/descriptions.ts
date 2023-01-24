import descriptions from "./descriptions.json";

export const RootContext = "root";

/**
 * Get a description for a built-in context
 * @param context Name of the context, for example `github`
 * @param key Key of the context, for example `actor`
 * @returns Description if one is found, otherwise undefined
 */
export function getDescription(context: string, key: string): string | undefined {
  // The inferred type doesn't quite match the actual type, use any to work around that
  return (descriptions as any)[context]?.[key]?.description;
}
