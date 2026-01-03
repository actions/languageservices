import {WorkflowContext} from "../context/workflow-context.js";

export interface Value {
  /** Label of this value */
  label: string;

  /** Optional description to show when auto-completing */
  description?: string;

  /** Optional qualifier shown inline after the label, e.g. "full syntax" or "list" */
  labelDetail?: string;

  /** Whether this value is deprecated */
  deprecated?: boolean;

  /** Alternative insert text, if not given `label` will be used */
  insertText?: string;

  /** Alternative filter text, if not given `label` will be used for filtering */
  filterText?: string;

  /** Sort text to control ordering, if not given `label` will be used for sorting */
  sortText?: string;

  /** Custom text edit with specific range, overrides default range calculation */
  textEdit?: {
    range: {start: {line: number; character: number}; end: {line: number; character: number}};
    newText: string;
  };

  /** Additional text edits to apply after the main edit (e.g., cleanup edits) */
  additionalTextEdits?: {
    range: {start: {line: number; character: number}; end: {line: number; character: number}};
    newText: string;
  }[];
}

export enum ValueProviderKind {
  AllowedValues,
  SuggestedValues
}

export type ValueProvider = {
  kind: ValueProviderKind;
  caseInsensitive?: boolean;
  get: (context: WorkflowContext, existingValues?: Set<string>) => Promise<Value[]>;
};

export interface ValueProviderConfig {
  [definitionKey: string]: ValueProvider;
}
