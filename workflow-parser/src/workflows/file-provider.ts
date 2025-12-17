import {File} from "./file.js";
import {FileReference} from "./file-reference.js";

export interface FileProvider {
  getFileContent(ref: FileReference): Promise<File>;
}
