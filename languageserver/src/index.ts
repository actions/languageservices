import {Connection} from "vscode-languageserver";

import {initConnection} from "./connection.js";

/** Helper function determining whether we are executing with node runtime */
function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node != null;
}

async function getConnection(): Promise<Connection> {
  if (isNode()) {
    const {createConnection} = await import("vscode-languageserver/node.js");
    return createConnection();
  } else {
    const {BrowserMessageReader, BrowserMessageWriter, createConnection} = await import(
      "vscode-languageserver/browser.js"
    );
    const messageReader = new BrowserMessageReader(self);
    const messageWriter = new BrowserMessageWriter(self);
    return createConnection(messageReader, messageWriter);
  }
}

getConnection().then(initConnection);
