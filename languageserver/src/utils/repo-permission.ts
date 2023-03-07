import {error} from "@github/actions-languageservice/log";
import {Octokit} from "@octokit/rest";
import {RepositoryContext} from "../initializationOptions";
import {TTLCache} from "./cache";
import {getUsername} from "./username";

export type RepoPermission = "admin" | "write" | "read" | "none";

export async function getRepoPermission(
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext
): Promise<RepoPermission> {
  const username = await getUsername(octokit, cache);
  const permission = await cache.get(`${repo.owner}/${repo.name}/${username}/permission`, undefined, () =>
    fetchRepoPermission(octokit, repo, username)
  );

  switch (permission) {
    case "admin":
    case "write":
    case "read":
    case "none":
      return permission;
    default:
      error(`Unknown permission: ${permission}`);
      return "none";
  }
}

async function fetchRepoPermission(octokit: Octokit, repo: RepositoryContext, username: string): Promise<string> {
  try {
    const res = await octokit.request("GET /repos/{owner}/{repo}/collaborators/{username}/permission", {
      owner: repo.owner,
      repo: repo.name,
      username: username
    });
    const permission = res.data?.permission;
    return permission;
  } catch (e: any) {
    if (e.status === 404 || e.status === 403) {
      return "none";
    }
    throw e;
  }
}
