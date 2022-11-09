export interface InitializationOptions {
  sessionToken?: string;
  repos?: RepositoryContext[];
}

export interface RepositoryContext {
  id: number;
  owner: string;
  name: string;

  workspaceUri: string;
}
