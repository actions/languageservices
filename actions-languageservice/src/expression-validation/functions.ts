import {data, wellKnownFunctions} from "@github/actions-expressions";

// Custom implementations for standard actions-expression functions used during validation and auto-completion.
// For example, for fromJson we'll most likely not have a valid input. In order to not throw, we'll always
// return an empty dictionary.
export const validatorFunctions = new Map(
  Object.entries({
    fromjson: {
      ...wellKnownFunctions.fromjson,
      call: () => new data.Dictionary()
    }
  })
);
