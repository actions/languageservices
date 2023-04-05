import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {File} from "@actions/workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {DocumentSymbol, SymbolKind} from "vscode-languageserver-types";
import {mapRange} from "./utils/range";
import {fetchOrConvertWorkflowTemplate, fetchOrParseWorkflow} from "./utils/workflow-cache";

export async function documentSymbols(
  document: TextDocument,
  workspace: string | undefined
): Promise<DocumentSymbol[]> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  const parsedWorkflow = fetchOrParseWorkflow(file, document.uri);
  if (!parsedWorkflow?.value) {
    return [];
  }

  const template = await fetchOrConvertWorkflowTemplate(
    parsedWorkflow.context,
    parsedWorkflow.value,
    document.uri,
    undefined,
    {
      errorPolicy: ErrorPolicy.TryConversion
    }
  );

  if (!template) {
    return [];
  }

  const symbols: DocumentSymbol[] = [];

  const onSymbol = DocumentSymbol.create(
    "`on` Triggers",
    undefined,
    SymbolKind.Key,
    mapRange(template.events.range),
    mapRange(template.events.range)
  );
  symbols.push(onSymbol);

  const jobsSymbol = DocumentSymbol.create(
    "Jobs",
    undefined,
    SymbolKind.Namespace,
    mapRange(template.jobs?.[0].id.range),
    mapRange(template.jobs?.[0].id.range),
    []
  );
  symbols.push(jobsSymbol);

  for (const job of template.jobs || []) {
    const jobSymbol = DocumentSymbol.create(
      `Job ${job.name?.toDisplayString() || job.id?.toString()}`,
      "detail",
      SymbolKind.Class,
      mapRange(job.id.range),
      mapRange(job.id.range)
    );

    jobsSymbol.children!.push(jobSymbol);
  }

  return symbols;
}
