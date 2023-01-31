import {Octokit} from "@octokit/rest";

export function getClient(token: string, userAgent?: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: userAgent || `GitHub Actions Language Server`
  });
}
