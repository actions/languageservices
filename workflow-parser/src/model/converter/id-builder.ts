const SEPARATOR = "_";
const MAX_ATTEMPTS = 1000;
const MAX_LENGTH = 100;

export class IdBuilder {
  private name: string[] = [];
  private readonly distinctNames: Set<string> = new Set();

  public appendSegment(value: string) {
    if (value.length === 0) {
      return;
    }

    if (this.name.length == 0) {
      const first = value[0];
      if (this.isAlpha(first) || first == "_") {
        // Legal first char
      } else if (this.isNumeric(first) || first == "-") {
        // Illegal first char, but legal char.
        // Prepend "_".
        this.name.push("_");
      } else {
        // Illegal char
      }
    } else {
      // Separator
      this.name.push(SEPARATOR);
    }

    for (const c of value) {
      {
        if (this.isAlphaNumeric(c) || c == "_" || c == "-") {
          // Legal
          this.name.push(c);
        } else {
          // Illegal
          this.name.push(SEPARATOR);
        }
      }
    }
  }

  public build(): string {
    const original = this.name.length > 0 ? this.name.join("") : "job";
    let suffix = "";
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt === 1) {
        suffix = "";
      } else {
        suffix = "_" + attempt;
      }

      const candidate = original.substring(0, Math.min(original.length, MAX_LENGTH - suffix.length)) + suffix;

      if (!this.distinctNames.has(candidate)) {
        this.distinctNames.add(candidate);
        this.name = [];
        return candidate;
      }
    }

    throw new Error("Unable to create a unique name");
  }

  /**
   * Adds a known identifier to the set of distinct ids.
   * @param value The value to add
   * @returns An error if the value is invalid, otherwise undefined
   */
  public tryAddKnownId(value: string): string | undefined {
    if (!value || !this.isValid(value) || value.length >= MAX_LENGTH) {
      return `The identifier '${value}' is invalid. IDs may only contain alphanumeric characters, '_', and '-'. IDs must start with a letter or '_' and and must be less than ${MAX_LENGTH} characters.`;
    }

    if (value.startsWith(SEPARATOR + SEPARATOR)) {
      return `The identifier '${value}' is invalid. IDs starting with '__' are reserved.`;
    }

    if (this.distinctNames.has(value)) {
      return `The identifier '${value}' may not be used more than once within the same scope.`;
    }

    this.distinctNames.add(value);
    return;
  }

  /**
   * A name is valid if it starts with a letter or underscore, and contains only
   * letters, numbers, underscores, and hyphens.
   * @param name The string name to validate
   * @returns Whether the name is valid
   */
  private isValid(name: string): boolean {
    let first = true;
    for (const c of name) {
      if (first) {
        first = false;
        if (!this.isAlpha(c) && c != "_") {
          return false;
        }
        continue;
      }
      if (!this.isAlphaNumeric(c) && c != "_" && c != "-") {
        return false;
      }
    }

    return true;
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isNumeric(c);
  }

  private isNumeric(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
  }
}
