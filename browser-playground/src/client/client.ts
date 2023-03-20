/* eslint-disable */
import * as monaco from "monaco-editor";

import {CloseAction, ErrorAction, MessageTransports, MonacoLanguageClient, MonacoServices} from "monaco-languageclient";
import {BrowserMessageReader, BrowserMessageWriter} from "vscode-languageserver-protocol/browser.js";

monaco.editor.create(document.getElementById("container")!, {
  value: `name: Demo workflow

on:
  push:
  workflow_dispatch:
    inputs:
      name:
        type: string

jobs:
  say-hello:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - run: echo "Hello \${{ github.event.inputs.name }}"`,
  language: "yaml",
  wordBasedSuggestions: false
});

function createLanguageClient(transports: MessageTransports): MonacoLanguageClient {
  return new MonacoLanguageClient({
    name: "GitHub Actions Language Client",
    clientOptions: {
      // Handle all yaml files as workflows
      documentSelector: [{language: "yaml"}],
      errorHandler: {
        error: () => ({action: ErrorAction.Continue}),
        closed: () => ({action: CloseAction.DoNotRestart})
      },
      // Custom options for the GitHub Actions language server
      initializationOptions: {}
    },
    connectionProvider: {
      get: () => Promise.resolve(transports)
    }
  });
}

MonacoServices.install();

const worker = new Worker(new URL("../service-worker/service-worker.ts", import.meta.url), {
  type: "module"
});

const reader = new BrowserMessageReader(worker);
const writer = new BrowserMessageWriter(worker);

const languageClient = createLanguageClient({reader, writer});
languageClient.start();
reader.onClose(() => languageClient.stop());
