export type FileReference = LocalFileReference | RemoteFileReference;

export type LocalFileReference = {
  path: string;
};

export type RemoteFileReference = {
  repository: string;
  owner: string;
  path: string;
  version: string;
};

export function parseFileReference(ref: string): FileReference {
  if (ref.startsWith("./")) {
    return {
      path: ref.substring(2)
    };
  }

  const [remotePath, version] = ref.split("@");
  const [owner, repository, ...pathSegments] = remotePath.split("/").filter(s => s.length > 0);

  if (!owner || !repository || !version) {
    throw new Error(`Invalid file reference: ${ref}`);
  }

  return {
    repository,
    owner,
    path: pathSegments.join("/"),
    version
  };
}

export function fileIdentifier(ref: FileReference): string {
  if (!("repository" in ref)) {
    return "./" + ref.path;
  }

  return `${ref.owner}/${ref.repository}/${ref.path}@${ref.version}`;
}
