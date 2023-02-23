export const Requests = {
  ReadFile: "actions/readFile"
} as const;

export type ReadFileRequest = {
  path: string;
};
