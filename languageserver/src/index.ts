import {Connection} from "vscode-languageserver";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection as createBrowserConnection
} from "vscode-languageserver/browser";
import {createConnection as createNodeConnection} from "vscode-languageserver/node";

import {initConnection} from "./connection.js";

/** Helper function determining whether we are executing with node runtime */
function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node != null;
}

function getConnection(): Connection {
  if (isNode()) {
    return createNodeConnection();
  } else {
    const messageReader = new BrowserMessageReader(self);
    const messageWriter = new BrowserMessageWriter(self);
    return createBrowserConnection(messageReader, messageWriter);
  }
}

initConnection(getConnection());
