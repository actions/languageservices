import {actionIdentifier, parseActionReference as parse} from "./action-reference";

describe("parseActionReference", () => {
  it("basic action", () => {
    expect(parse("actions/checkout@v2")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "v2"
    });
  });

  it("action with reference to branch", () => {
    expect(parse("actions/checkout@main")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "main"
    });
  });

  it("action with reference to branch with slashes", () => {
    expect(parse("actions/checkout@features/a")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "features/a"
    });
  });

  it("action with reference to commit sha", () => {
    expect(parse("actions/checkout@755da8c3cf115ac066823e79a1e1788f8940201b")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "755da8c3cf115ac066823e79a1e1788f8940201b"
    });
  });

  it("valid action with path", () => {
    expect(parse("actions/checkout/path/to/action@v2")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "v2",
      path: "path/to/action"
    });
  });

  it("valid action with path and trailing slash", () => {
    expect(parse("actions/checkout/path/to/action/@v2")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "v2",
      path: "path/to/action"
    });
  });

  it("local action", () => {
    expect(parse("./")).toBeUndefined();
  });

  it("local action with path", () => {
    expect(parse("./directory/")).toBeUndefined();
  });

  it("Docker Hub action", () => {
    expect(parse("docker://alpine:3.8")).toBeUndefined();
  });

  it("GitHub Packages Container action", () => {
    expect(parse("docker://ghcr.io/OWNER/IMAGE_NAME")).toBeUndefined();
  });

  it("action with backslashes", () => {
    expect(parse("actions\\checkout\\path\\to\\action@v2")).toEqual({
      owner: "actions",
      name: "checkout",
      ref: "v2",
      path: "path/to/action"
    });
  });
});

describe("actionIdentifier", () => {
  it("basic action", () => {
    expect(
      actionIdentifier({
        owner: "actions",
        name: "checkout",
        ref: "v2"
      })
    ).toEqual("actions/checkout/v2");
  });

  it("action with path", () => {
    expect(
      actionIdentifier({
        owner: "actions",
        name: "checkout",
        ref: "v2",
        path: "path/to/action"
      })
    ).toEqual("actions/checkout/v2/path/to/action");
  });
});
