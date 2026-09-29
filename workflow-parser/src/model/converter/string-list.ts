import {SequenceToken} from "../../templates/tokens/sequence-token.js";

export function convertStringList(name: string, token: SequenceToken): string[] {
  const result = [] as string[];

  for (const item of token) {
    result.push(item.assertString(`${name} item`).value);
  }

  return result;
}
