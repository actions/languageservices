import {LogLevel} from "@github/actions-languageservice/log";
export {LogLevel} from "@github/actions-languageservice/log";

export interface InitializationOptions {
  /**
   * GitHub token that will be used to retrieve additional information from github.com
   *
   * Requires the `repo` and `workflow` scopes
   */
  sessionToken?: string;

  /**
   * List of repositories that the language server should be aware of
   */
  repos?: RepositoryContext[];

  /**
   * Desired log level
   */
  logLevel?: LogLevel;
}

export interface RepositoryContext {
  /**
   * Repository ID
   */
  id: number;

  /**
   * Repository owner
   */
  owner: string;

  /**
   * Repository name
   */
  name: string;

  /**
   * Local workspace uri
   */
  workspaceUri: string;
}
