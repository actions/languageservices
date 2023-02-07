import {File} from "@github/actions-workflow-parser/workflows/file";
import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {fileIdentifier} from "@github/actions-workflow-parser/workflows/file-reference";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "./utils/cache";

export function getFileProvider(client: Octokit | undefined, cache: TTLCache): FileProvider | undefined {
  if (!client) {
    return undefined;
  }

  return {
    getFileContent: async (ref): Promise<File> => {
      if (!("repository" in ref)) {
        throw new Error("Only remote file references are supported right now");
      }

      return await cache.get(`file-content-${fileIdentifier(ref)}`, undefined, () =>
        fetchWorkflowFile(client, ref.owner, ref.repository, ref.path, ref.version)
      );
    }
  };
}

async function fetchWorkflowFile(
  client: Octokit,
  owner: string,
  repo: string,
  path: string,
  version: string
): Promise<File> {
  const resp = await client.repos.getContent({
    owner,
    repo,
    path,
    ref: version
  });

  // https://docs.github.com/rest/repos/contents?apiVersion=2022-11-28
  // Ignore directories (array of files) and non-file content
  if (
    resp.data === undefined ||
    Array.isArray(resp.data) ||
    resp.data.type !== "file" ||
    resp.data.content === undefined
  ) {
    throw new Error("Not a file");
  }

  return {
    name: path,
    content: Buffer.from(resp.data.content, "base64").toString("utf8")
  };
}
