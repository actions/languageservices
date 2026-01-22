import {DiagnosticSeverity} from "vscode-languageserver-types";
import {validate} from "./validate.js";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";

beforeEach(() => {
  clearCache();
});

describe("validate uses format", () => {
  describe("valid formats", () => {
    it("standard org/repo@ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("org/repo with path @ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/aws/ec2@main
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("org/repo with deep path @ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/aws/nested/deep/path@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("docker image", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: docker://alpine:3.8
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("docker image with registry", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: docker://gcr.io/my-project/my-image:latest
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("local path with ./", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: ./my-action
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("local path with ./ and subdirectories", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: ./.github/actions/my-action
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("local path with .\\ (Windows)", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: .\\my-action
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("SHA ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("branch ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: owner/repo@feature/my-branch
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });
  });

  describe("invalid formats", () => {
    it("missing @ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual 'actions/checkout'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 28}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("empty ref", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual 'actions/checkout@'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 29}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("missing org/owner", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: checkout@v4
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual 'checkout@v4'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 23}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("empty owner", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: /repo@v4
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual '/repo@v4'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 20}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("empty repo", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: owner/@v4
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual 'owner/@v4'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 21}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("multiple @ symbols", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4@extra
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual 'actions/checkout@v4@extra'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 37}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("just a name with no slash", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: checkout
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Expected format {owner}/{repo}[/path]@{ref}. Actual 'checkout'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 20}
          },
          code: "invalid-uses-format"
        }
      ]);
    });

    it("empty uses value", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: ""
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toContainEqual({
        message: "'uses' value in action cannot be blank",
        severity: DiagnosticSeverity.Error,
        range: {
          start: {line: 5, character: 12},
          end: {line: 5, character: 14}
        },
        code: "invalid-uses-format"
      });
    });

    it("reusable workflow in step", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: owner/repo/.github/workflows/test.yml@main
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Reusable workflows should be referenced at the top-level `jobs.<job_id>.uses` key, not within steps",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 5, character: 12},
            end: {line: 5, character: 54}
          },
          code: "invalid-uses-format"
        }
      ]);
    });
  });
});

describe("workflow uses format validation", () => {
  beforeEach(() => {
    clearCache();
  });

  describe("valid formats", () => {
    it("local workflow path", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./.github/workflows/test.yml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("local workflow path with yaml extension", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./.github/workflows/test.yaml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("remote workflow with version", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("remote workflow with sha ref", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@abc123
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("remote workflow with branch ref", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@main
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("remote workflow with yaml extension", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yaml@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("local workflows-lab path", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./.github/workflows-lab/test.yml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("local workflows-lab path with yaml extension", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./.github/workflows-lab/test.yaml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });

    it("remote workflows-lab with version", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows-lab/test.yml@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([]);
    });
  });

  describe("invalid formats", () => {
    it("remote workflow missing version", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message: "Invalid workflow reference 'owner/repo/.github/workflows/test.yml': no version specified",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 47}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("local workflow with version", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./.github/workflows/test.yml@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference './.github/workflows/test.yml@v1': cannot specify version when calling local workflows",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 41}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("malformed local path not in .github/workflows", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./foo/bar.yml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference './foo/bar.yml': local workflow references must be rooted in '.github/workflows'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 23}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("missing .github/workflows path", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/test.yml@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference 'owner/repo/test.yml@v1': references to workflows must be rooted in '.github/workflows'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 32}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("invalid file extension", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.txt@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference 'owner/repo/.github/workflows/test.txt@v1': workflow file should have either a '.yml' or '.yaml' file extension",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 50}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("no extension", async () => {
      const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference 'owner/repo/.github/workflows/test@v1': workflow file should have either a '.yml' or '.yaml' file extension",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 46}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("just a ref", async () => {
      const input = `on: push
jobs:
  test:
    uses: test.yml@v1
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference 'test.yml@v1': references to workflows must be rooted in '.github/workflows'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 21}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    it("local without .github/workflows", async () => {
      const input = `on: push
jobs:
  test:
    uses: ./workflows/test.yml
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toEqual([
        {
          message:
            "Invalid workflow reference './workflows/test.yml': local workflow references must be rooted in '.github/workflows'",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {line: 3, character: 10},
            end: {line: 3, character: 30}
          },
          code: "invalid-workflow-uses-format"
        }
      ]);
    });

    describe("invalid ref/version format", () => {
      it("empty version after @", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message: "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@': no version specified",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 48}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version with invalid character ?", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@v1?
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@v1?': invalid character '?' in version",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 51}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version with double dots", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@v1..v2
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@v1..v2': invalid character '..' in version",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 54}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version ending with dot", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@v1.
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@v1.': version cannot begin or end with a slash '/' or a dot '.'",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 51}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version starting with slash", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@/v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@/v1': version cannot begin or end with a slash '/' or a dot '.'",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 51}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version ending with .lock", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@refs/heads/main.lock
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@refs/heads/main.lock': invalid version: refs/heads/main.lock",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 68}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version with whitespace", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@v1 && rm -rf
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@v1 && rm -rf': version cannot have whitespace",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 60}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("version with backslash", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/test.yml@v1\\1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo/.github/workflows/test.yml@v1\\1': invalid character '\\' in version",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 52}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });
    });

    describe("invalid owner/repo names", () => {
      it("owner with invalid characters", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner*/repo/.github/workflows/test.yml@v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner*/repo/.github/workflows/test.yml@v1': owner name must be a valid repository owner name",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 51}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("repo with invalid characters", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo!name/.github/workflows/test.yml@v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner/repo!name/.github/workflows/test.yml@v1': repository name is invalid",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 55}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("owner with spaces", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner name/repo/.github/workflows/test.yml@v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "Invalid workflow reference 'owner name/repo/.github/workflows/test.yml@v1': owner name must be a valid repository owner name",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 55}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });
    });

    describe("invalid workflow filename", () => {
      it("filename is just .yml", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/.yml@v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message: "Invalid workflow reference 'owner/repo/.github/workflows/.yml@v1': invalid workflow file name",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 46}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("filename is just .yaml", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/.yaml@v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message: "Invalid workflow reference 'owner/repo/.github/workflows/.yaml@v1': invalid workflow file name",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 47}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });

      it("local workflow filename is just .yml", async () => {
        const input = `on: push
jobs:
  test:
    uses: ./.github/workflows/.yml
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message: "Invalid workflow reference './.github/workflows/.yml': invalid workflow file name",
            severity: DiagnosticSeverity.Error,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 34}
            },
            code: "invalid-workflow-uses-format"
          }
        ]);
      });
    });
  });

  describe("short SHA warnings", () => {
    describe("step uses", () => {
      it("warns on 7-char short SHA", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@a1b2c3d
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "The provided ref 'a1b2c3d' may be a shortened commit SHA. If so, please use the full 40-character commit SHA instead, as short SHAs are not supported.",
            severity: DiagnosticSeverity.Warning,
            range: {
              start: {line: 5, character: 12},
              end: {line: 5, character: 36}
            },
            code: "short-sha-ref",
            codeDescription: {
              href: "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions"
            }
          }
        ]);
      });

      it("warns on 8-char short SHA", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@a1b2c3d4
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "The provided ref 'a1b2c3d4' may be a shortened commit SHA. If so, please use the full 40-character commit SHA instead, as short SHAs are not supported.",
            severity: DiagnosticSeverity.Warning,
            range: {
              start: {line: 5, character: 12},
              end: {line: 5, character: 37}
            },
            code: "short-sha-ref",
            codeDescription: {
              href: "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions"
            }
          }
        ]);
      });

      it("does not warn on full SHA (40 chars)", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("does not warn on tag ref", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("does not warn on branch ref", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@main
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("does not warn on Docker action", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: docker://alpine:3.8
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("does not warn on local action", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: ./my-action
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });
    });

    describe("workflow uses", () => {
      it("warns on 7-char short SHA in reusable workflow", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/ci.yml@a1b2c3d
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "The provided ref 'a1b2c3d' may be a shortened commit SHA. If so, please use the full 40-character commit SHA instead, as short SHAs are not supported.",
            severity: DiagnosticSeverity.Warning,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 53}
            },
            code: "short-sha-ref",
            codeDescription: {
              href: "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions"
            }
          }
        ]);
      });

      it("warns on 8-char short SHA in reusable workflow", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/ci.yml@a1b2c3d4
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([
          {
            message:
              "The provided ref 'a1b2c3d4' may be a shortened commit SHA. If so, please use the full 40-character commit SHA instead, as short SHAs are not supported.",
            severity: DiagnosticSeverity.Warning,
            range: {
              start: {line: 3, character: 10},
              end: {line: 3, character: 54}
            },
            code: "short-sha-ref",
            codeDescription: {
              href: "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions"
            }
          }
        ]);
      });

      it("does not warn on full SHA in reusable workflow", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/ci.yml@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("does not warn on tag ref in reusable workflow", async () => {
        const input = `on: push
jobs:
  test:
    uses: owner/repo/.github/workflows/ci.yml@v1
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("does not warn on local workflow", async () => {
        const input = `on: push
jobs:
  test:
    uses: ./.github/workflows/ci.yml
`;
        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });
    });
  });
});
