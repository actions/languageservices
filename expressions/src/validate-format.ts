/**
 * Format string validation for format() function calls.
 * Validates format string syntax and argument count at parse time.
 */

/**
 * Validates a format string and returns the maximum placeholder index.
 *
 * @param formatString The format string to validate
 * @returns { valid: boolean, maxArgIndex: number } where maxArgIndex is -1 if no placeholders
 */
export function validateFormatString(formatString: string): {valid: boolean; maxArgIndex: number} {
  let maxIndex = -1;
  let i = 0;

  while (i < formatString.length) {
    // Find next left brace
    let lbrace = -1;
    for (let j = i; j < formatString.length; j++) {
      if (formatString[j] === "{") {
        lbrace = j;
        break;
      }
    }

    // Find next right brace
    let rbrace = -1;
    for (let j = i; j < formatString.length; j++) {
      if (formatString[j] === "}") {
        rbrace = j;
        break;
      }
    }

    // No more braces
    if (lbrace < 0 && rbrace < 0) {
      break;
    }

    // Left brace comes first (or only left brace exists)
    if (lbrace >= 0 && (rbrace < 0 || lbrace < rbrace)) {
      // Check if it's escaped
      if (lbrace + 1 < formatString.length && formatString[lbrace + 1] === "{") {
        // Escaped left brace
        i = lbrace + 2;
        continue;
      }

      // This is a placeholder opening - find the closing brace
      rbrace = -1;
      for (let j = lbrace + 1; j < formatString.length; j++) {
        if (formatString[j] === "}") {
          rbrace = j;
          break;
        }
      }

      if (rbrace < 0) {
        // Missing closing brace
        return {valid: false, maxArgIndex: -1};
      }

      // Validate placeholder content (must be digits only)
      if (rbrace === lbrace + 1) {
        // Empty placeholder {}
        return {valid: false, maxArgIndex: -1};
      }

      // Parse the index and validate it's all digits
      let index = 0;
      for (let j = lbrace + 1; j < rbrace; j++) {
        const c = formatString[j];
        if (c < "0" || c > "9") {
          // Non-numeric character
          return {valid: false, maxArgIndex: -1};
        }
        index = index * 10 + (c.charCodeAt(0) - "0".charCodeAt(0));
      }

      if (index > maxIndex) {
        maxIndex = index;
      }

      i = rbrace + 1;
      continue;
    }

    // Right brace comes first (or only right brace exists)
    // Check if it's escaped
    if (rbrace + 1 < formatString.length && formatString[rbrace + 1] === "}") {
      // Escaped right brace
      i = rbrace + 2;
      continue;
    }

    // Unescaped right brace outside of placeholder
    return {valid: false, maxArgIndex: -1};
  }

  return {valid: true, maxArgIndex: maxIndex};
}
