import {LogLevel} from "@github/actions-languageservice/log";
export {LogLevel} from "@github/actions-languageservice/log";

export interface InitializationOptions {
  sessionToken?: string;

  repos?: RepositoryContext[];

  logLevel?: LogLevel;
}

export interface RepositoryContext {
  id: number;
  owner: string;
  name: string;

  workspaceUri: string;
}
