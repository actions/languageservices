import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {fileIdentifier} from "@actions/workflow-parser/workflows/file-reference";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "./utils/cache";
import vscodeURI from "vscode-uri/lib/umd";

export function getFileProvider(
  client: Octokit | undefined,
  cache: TTLCache,
  workspace: string | undefined,
  readFile: (path: string) => Promise<string>
): FileProvider | undefined {
  if (!client && !workspace) {
    return undefined;
  }

  return {
    getFileContent: async (ref): Promise<File> => {
      if ("repository" in ref) {
        if (!client) {
          throw new Error("Remote file references are not supported with this configuration");
        }

        return await cache.get(`file-content-${fileIdentifier(ref)}`, undefined, () =>
          fetchWorkflowFile(client, ref.owner, ref.repository, ref.path, ref.version)
        );
      }

      if (!workspace) {
        throw new Error("Local file references are not supported with this configuration");
      }

      const workspaceURI = vscodeURI.URI.parse(workspace);
      const path = vscodeURI.Utils.joinPath(workspaceURI, ref.path);
      const file = await readFile(path.toString());

      if (!file) {
        throw new Error(`File not found: ${ref.path}`);
      }
      return {
        name: ref.path,
        content: file
      };
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
