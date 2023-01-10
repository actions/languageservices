import {BrowserMessageReader, BrowserMessageWriter, createConnection} from "vscode-languageserver/browser.js";

import {initConnection} from "@github/actions-languageserver/connection";

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

initConnection(connection);
