import {File} from "./file";

export interface FileProvider {
  getFileContent(path: string): Promise<File>;
}
