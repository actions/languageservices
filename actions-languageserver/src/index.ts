import {createConnection} from "vscode-languageserver/node";

import {initConnection} from "./connection";

// By default create node connection
const connection = createConnection();
initConnection(connection);
