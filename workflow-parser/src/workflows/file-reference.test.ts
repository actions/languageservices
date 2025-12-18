import {parseFileReference} from "./file-reference.js";

describe("parseFileReference", () => {
  it("parses local file reference", () => {
    const ref = parseFileReference("./workflow/path");
    expect(ref).toEqual({
      path: "workflow/path"
    });
  });

  it("parses local file references with an empty path", () => {
    const ref = parseFileReference("./");
    expect(ref).toEqual({
      path: ""
    });
  });

  it("parses remote file reference", () => {
    const ref = parseFileReference("owner/repo/path@version");
    expect(ref).toEqual({
      owner: "owner",
      repository: "repo",
      path: "path",
      version: "version"
    });
  });

  it("parses remote file reference with an empty path", () => {
    const ref = parseFileReference("owner/repo@version");
    expect(ref).toEqual({
      owner: "owner",
      repository: "repo",
      path: "",
      version: "version"
    });
  });

  it("parses remote file reference with slashes in the version", () => {
    const ref = parseFileReference("owner/repo@feature-branch/dev");
    expect(ref).toEqual({
      owner: "owner",
      repository: "repo",
      path: "",
      version: "feature-branch/dev"
    });
  });

  it("throws for malformed remote file references", () => {
    expect(() => parseFileReference("owner/repo/path")).toThrowError("Invalid file reference: owner/repo/path");

    expect(() => parseFileReference("owner/repo/path@")).toThrowError("Invalid file reference: owner/repo/path@");

    expect(() => parseFileReference("owner@")).toThrowError("Invalid file reference: owner@");
  });
});
