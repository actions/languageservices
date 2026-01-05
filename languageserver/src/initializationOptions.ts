import {LogLevel} from "@actions/languageservice/log";
export {LogLevel} from "@actions/languageservice/log";

/**
 * Experimental feature flags.
 *
 * Individual feature flags take precedence over `all`.
 * Example: { all: true, missingInputsQuickfix: false } enables all
 * experimental features EXCEPT missingInputsQuickfix.
 *
 * When a feature graduates to stable, its flag becomes a no-op
 * (the feature will be enabled regardless of the configuration value).
 */
export interface ExperimentalFeatures {
  /**
   * Enable all experimental features.
   * Individual feature flags take precedence over this setting.
   * @default false
   */
  all?: boolean;

  /**
   * Enable quickfix code action for missing required action inputs.
   * @default false
   */
  missingInputsQuickfix?: boolean;
}

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
