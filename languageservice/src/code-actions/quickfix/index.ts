import { CodeActionProvider } from "../types";
import { addMissingInputsProvider } from "./add-missing-inputs";

export const quickfixProviders: CodeActionProvider[] = [
  addMissingInputsProvider,
];
