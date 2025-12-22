import {ExpressionData, StringData} from "../data/index.js";
import {FunctionDefinition} from "./info.js";

export const format: FunctionDefinition = {
  name: "format",
  description:
    "`format( string, replaceValue0, replaceValue1, ..., replaceValueN)`\n\nReplaces values in the `string`, with the variable `replaceValueN`. Variables in the `string` are specified using the `{N}` syntax, where `N` is an integer. You must specify at least one `replaceValue` and `string`. There is no maximum for the number of variables (`replaceValueN`) you can use. Escape curly braces using double braces.",
  minArgs: 1,
  maxArgs: 255 /*MAX_ARGUMENTS*/,
  call: (...args: ExpressionData[]): ExpressionData => {
    const fs = args[0].coerceString();

    const result: string[] = [];
    let index = 0;

    while (index < fs.length) {
      const lbrace = fs.indexOf("{", index);
      const rbrace = fs.indexOf("}", index);

      // Left brace
      if (lbrace >= 0 && (rbrace < 0 || rbrace > lbrace)) {
        // Escaped left brace
        if (safeCharAt(fs, lbrace + 1) === "{") {
          result.push(fs.substr(index, lbrace - index + 1));
          index = lbrace + 2;
          continue;
        }

        // Left brace, number, optional format specifiers, right brace
        if (rbrace > lbrace + 1) {
          const argIndex = readArgIndex(fs, lbrace + 1);
          if (argIndex.success) {
            // Check parameter count
            if (1 + argIndex.result > args.length - 1) {
              throw new Error(`The following format string references more arguments than were supplied: ${fs}`);
            }

            // Append the portion before the left brace
            if (lbrace > index) {
              result.push(fs.substr(index, lbrace - index));
            }

            // Append the arg
            result.push(`${args[1 + argIndex.result].coerceString()}`);
            index = rbrace + 1;
            continue;
          }
        }

        throw new Error(`The following format string is invalid: ${fs}`);
      }
      // Right brace
      else if (rbrace >= 0) {
        // Escaped right brace
        if (safeCharAt(fs, rbrace + 1) === "}") {
          result.push(fs.substr(index, rbrace - index + 1));
          index = rbrace + 2;
        } else {
          throw new Error(`The following format string is invalid: ${fs}`);
        }
      }
      // Last segment
      else {
        result.push(fs.substr(index));
        break;
      }
    }

    return new StringData(result.join(""));
  }
};

function safeCharAt(string: string, index: number): string {
  if (string.length > index) {
    return string[index];
  }

  return "\0";
}

function readArgIndex(string: string, startIndex: number): ArgIndex {
  // Count the number of digits
  let length = 0;
  for (;;) {
    const nextChar = safeCharAt(string, startIndex + length);
    if (nextChar >= "0" && nextChar <= "9") {
      length++;
    } else {
      break;
    }
  }

  // Validate at least one digit
  if (length < 1) {
    return <ArgIndex>{
      success: false
    };
  }

  // Parse the number
  const endIndex = startIndex + length - 1;
  const result = parseInt(string.substr(startIndex, length));
  return <ArgIndex>{
    success: !isNaN(result),
    result: result,
    endIndex: endIndex
  };
}

interface ArgIndex {
  success: boolean;
  result: number;
  endIndex: number;
}
