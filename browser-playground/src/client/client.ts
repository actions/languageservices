import * as monaco from "monaco-editor";

import { buildWorkerDefinition } from "monaco-editor-workers";

import { MonacoServices } from "monaco-languageclient";
import getMessageServiceOverride from "vscode/service-override/messages";
import { StandaloneServices } from "vscode/services";

StandaloneServices.initialize({
  ...getMessageServiceOverride(document.body),
});

buildWorkerDefinition("dist", new URL("", window.location.href).href, false);

// register Monaco languages
monaco.languages.register({
  id: "plaintext",
  extensions: [".txt"],
  aliases: ["PLAINTEXT", "plaintext"],
  mimetypes: ["text/plain"],
});

// or import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// if shipping only a subset of the features & languages is desired

monaco.editor.create(document.getElementById("container")!, {
  value: 'console.log("Hello, world")',
  language: "yaml",
});

// function createLanguageClient(
//   transports: MessageTransports
// ): MonacoLanguageClient {
//   return new MonacoLanguageClient({
//     name: "Sample Language Client",
//     clientOptions: {
//       // use a language id as a document selector
//       documentSelector: [{ language: "plaintext" }],
//       // disable the default error handler
//       errorHandler: {
//         error: () => ({ action: ErrorAction.Continue }),
//         closed: () => ({ action: CloseAction.DoNotRestart }),
//       },
//     },
//     // create a language client connection to the server running in the web worker
//     connectionProvider: {
//       get: () => {
//         return Promise.resolve(transports);
//       },
//     },
//   });
// }

// install Monaco language client services
MonacoServices.install();

// const worker = new Worker(
//   new URL("./src/serverWorker.ts", window.location.href).href,
//   { type: "module" }
// );
// const reader = new BrowserMessageReader(worker);
// const writer = new BrowserMessageWriter(worker);
// const languageClient = createLanguageClient({ reader, writer });
// languageClient.start();

// reader.onClose(() => languageClient.stop());
