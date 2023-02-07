import {File} from "./file";
import {FileReference} from "./file-reference";

export interface FileProvider {
  getFileContent(ref: FileReference): Promise<File>;
}
