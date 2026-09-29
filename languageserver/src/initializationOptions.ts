import {ExperimentalFeatures} from "@actions/expressions";
import {LogLevel} from "@actions/languageservice/log";
export {LogLevel} from "@actions/languageservice/log";

export interface InitializationOptions {
  /**
   * GitHub token that will be used to retrieve additional information from github.com
   *
   * Requires the `repo` and `workflow` scopes
   */
  sessionToken?: string;

  /**
   * Optional user agent to use when making calls to github.com
   */
  userAgent?: string;

  /**
   * List of repositories that the language server should be aware of
   */
  repos?: RepositoryContext[];

  /**
   * Desired log level
   */
  logLevel?: LogLevel;

  /**
   * If a GitHub Enterprise Server should be used, the URL of the API endpoint, eg "https://ghe.my-company.com/api/v3"
   */
  gitHubApiUrl?: string;

  /**
   * Experimental features that are opt-in.
   * Features listed here may change or be removed without notice.
   */
  experimentalFeatures?: ExperimentalFeatures;
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
   * Indicates if the repository is owned by an organization
   */
  organizationOwned: boolean;

  /**
   * Repository name
   */
  name: string;

  /**
   * Local workspace uri
   */
  workspaceUri: string;
}
