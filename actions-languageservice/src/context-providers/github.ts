import {data} from "@github/actions-expressions";

export function getGithubContext(): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#github-context
  const keys = [
    "action",
    "action_path",
    "action_ref",
    "action_repository",
    "action_status",
    "actor",
    "api_url",
    "base_ref",
    "env",
    "event",
    "event_name",
    "event_path",
    "graphql_url",
    "head_ref",
    "job",
    "ref",
    "ref_name",
    "ref_protected",
    "ref_type",
    "path",
    "repository",
    "repository_owner",
    "repositoryUrl",
    "retention_days",
    "run_id",
    "run_number",
    "run_attempt",
    "secret_source",
    "server_url",
    "sha",
    "token",
    "triggering_actor",
    "workflow",
    "workspace"
  ];

  return new data.Dictionary(
    ...keys.map(key => {
      return {key, value: new data.Null()};
    })
  );
}
