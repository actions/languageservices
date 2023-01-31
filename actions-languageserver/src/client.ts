import {Octokit} from "@octokit/rest";
import {version} from "../package.json";

export function getClient(token: string, userAgent?: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: userAgent || `GitHub Actions Language Server (${version})`
  });
}
