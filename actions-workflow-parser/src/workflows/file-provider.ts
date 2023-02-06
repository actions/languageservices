export interface FileProvider {
  getFileContent(path: string): Promise<File | undefined>;
}
