import {CodeActionProvider} from "../types.js";
import {addMissingInputsProvider} from "./add-missing-inputs.js";

export const quickfixProviders: CodeActionProvider[] = [addMissingInputsProvider];
