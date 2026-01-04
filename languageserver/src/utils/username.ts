import {Octokit} from "@octokit/rest";
import {TTLCache} from "./cache.js";

export async function getUsername(octokit: Octokit, cache: TTLCache): Promise<string> {
  return await cache.get(`/username`, undefined, () => fetchUsername(octokit));
}

async function fetchUsername(octokit: Octokit): Promise<string> {
  try {
    const username = await octokit.request("GET /user").then(res => res.data.login);
    return username;
  } catch (e) {
    console.log("Failure to retrieve username: ", e);
    throw e;
  }
}
