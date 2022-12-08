import {data} from "@github/actions-expressions";
import {Job} from "@github/actions-workflow-parser/model/workflow-template";
import {BasicExpressionToken} from "@github/actions-workflow-parser/templates/tokens/basic-expression-token";
import {ExpressionToken} from "@github/actions-workflow-parser/templates/tokens/expression-token";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {WorkflowContext} from "../context/workflow-context";
import {getMatrixContext} from "./matrix";

type MatrixMap = {
  [key: string]: Array<string> | Array<{[key: string]: string}>;
};

function createMatrix(map: MatrixMap): WorkflowContext {
  const strategy = new MappingToken(undefined, undefined, undefined);
  strategy.add(stringToToken("matrix"), mapToToken(map));
  return contextFromStrategy(strategy);
}

function mapToToken(map: MatrixMap) {
  const token = new MappingToken(undefined, undefined, undefined);
  for (const key in map) {
    const arr = map[key];
    const seqToken = new SequenceToken(undefined, undefined, undefined);
    for (const item of arr) {
      if (typeof item === "string") {
        seqToken.add(new StringToken(undefined, undefined, item, undefined));
      } else {
        const mapToken = new MappingToken(undefined, undefined, undefined);
        for (const key in item) {
          mapToken.add(stringToToken(key), stringToToken(item[key]));
        }
        seqToken.add(mapToken);
      }
    }
    token.add(stringToToken(key), seqToken);
  }
  return token;
}

function stringToToken(value: string) {
  return new StringToken(undefined, undefined, value, undefined);
}

function expressionToToken(expr: string) {
  return new BasicExpressionToken(undefined, undefined, expr, undefined, undefined);
}

function contextFromStrategy(strategy?: TemplateToken) {
  return {
    job: {
      strategy: strategy
    }
  } as WorkflowContext;
}

describe("matrix context", () => {
  describe("invalid workflow context", () => {
    it("job not defined", () => {
      const workflowContext = {} as WorkflowContext;
      expect(workflowContext.job).toBeUndefined();

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(new data.Dictionary());
    });

    it("strategy not defined", () => {
      const job = {} as Job;
      const workflowContext = {job} as WorkflowContext;
      expect(workflowContext.job!.strategy).toBeUndefined();

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(new data.Dictionary());
    });

    it("strategy is not a mapping token", () => {
      const workflowContext = contextFromStrategy(stringToToken("hello"));
      expect(workflowContext.job!.strategy).toBeDefined();

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(new data.Dictionary());
    });

    it("matrix is not defined", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      const workflowContext = contextFromStrategy(strategy);

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(new data.Dictionary());
    });

    it("matrix is not a mapping token", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("matrix"), stringToToken("hello"));
      const workflowContext = contextFromStrategy(strategy);

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(new data.Dictionary());
    });

    it("empty matrix", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("matrix"), new MappingToken(undefined, undefined, undefined));
      const workflowContext = contextFromStrategy(strategy);

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(new data.Dictionary());
    });
  });

  describe("matrix with expressions", () => {
    it("matrix from expression", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("matrix"), expressionToToken("${{ fromJSON(needs.job1.outputs.matrix) }}"));

      const workflowContext = contextFromStrategy(strategy);
      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(new data.Dictionary());
    });

    it("matrix with include expression", () => {
      const include = expressionToToken("${{ fromJSON(needs.job1.outputs.matrix) }}");

      const nodeSequence = new SequenceToken(undefined, undefined, undefined);
      nodeSequence.add(stringToToken("12"));
      nodeSequence.add(stringToToken("14"));

      const matrix = new MappingToken(undefined, undefined, undefined);
      matrix.add(stringToToken("node"), nodeSequence);
      matrix.add(stringToToken("include"), include);

      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("matrix"), matrix);

      const workflowContext = contextFromStrategy(strategy);
      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(new data.Dictionary());
    });

    it("matrix with expression within property", () => {
      const version = expressionToToken("${{ github.event.client_payload.versions }}");

      const matrix = new MappingToken(undefined, undefined, undefined);
      matrix.add(stringToToken("version"), version);

      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("matrix"), matrix);

      const workflowContext = contextFromStrategy(strategy);
      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(
        new data.Dictionary({
          key: "version",
          value: new data.Null()
        })
      );
    });
  });

  describe("valid matrices", () => {
    it("basic matrix", () => {
      const workflowContext = createMatrix({os: ["ubuntu-latest", "windows-latest"]});

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(
        new data.Dictionary({
          key: "os",
          value: new data.Array(new data.StringData("ubuntu-latest"), new data.StringData("windows-latest"))
        })
      );
    });

    it("matrix with multiple properties", () => {
      const workflowContext = createMatrix({
        os: ["ubuntu-latest", "windows-latest"],
        node: ["12", "14"]
      });

      const context = getMatrixContext(workflowContext);
      expect(context).toEqual(
        new data.Dictionary(
          {
            key: "os",
            value: new data.Array(new data.StringData("ubuntu-latest"), new data.StringData("windows-latest"))
          },
          {
            key: "node",
            value: new data.Array(new data.StringData("12"), new data.StringData("14"))
          }
        )
      );
    });

    it("matrix with include", () => {
      const workflowContext = createMatrix({
        os: ["ubuntu-latest", "windows-latest"],
        node: ["12", "14"],
        include: [
          {
            os: "macos-latest",
            node: "12"
          }
        ]
      });

      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(
        new data.Dictionary(
          {
            key: "os",
            value: new data.Array(
              new data.StringData("ubuntu-latest"),
              new data.StringData("windows-latest"),
              new data.StringData("macos-latest")
            )
          },
          {
            key: "node",
            value: new data.Array(new data.StringData("12"), new data.StringData("14"))
          }
        )
      );
    });

    it("matrix with only include", () => {
      const workflowContext = createMatrix({
        include: [
          {
            site: "production",
            datacenter: "site-a"
          },
          {
            site: "staging",
            datacenter: "site-b"
          }
        ]
      });

      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(
        new data.Dictionary(
          {
            key: "site",
            value: new data.Array(new data.StringData("production"), new data.StringData("staging"))
          },
          {
            key: "datacenter",
            value: new data.Array(new data.StringData("site-a"), new data.StringData("site-b"))
          }
        )
      );
    });

    it("matrix with exclude", () => {
      const workflowContext = createMatrix({
        os: ["macos-latest", "windows-latest"],
        node: ["12", "14", "16"],
        environment: ["staging", "production"],
        exclude: [
          {
            os: "macos-latest",
            node: "12",
            environment: "production"
          },
          {
            os: "windows-latest",
            node: "16"
          }
        ]
      });

      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(
        new data.Dictionary(
          {
            key: "os",
            value: new data.Array(new data.StringData("macos-latest"), new data.StringData("windows-latest"))
          },
          {
            key: "node",
            value: new data.Array(new data.StringData("12"), new data.StringData("14"), new data.StringData("16"))
          },
          {
            key: "environment",
            value: new data.Array(new data.StringData("staging"), new data.StringData("production"))
          }
        )
      );
    });

    it("matrix with only exclude", () => {
      const workflowContext = createMatrix({
        exclude: [
          {
            os: "macos-latest",
            node: "12",
            environment: "production"
          },
          {
            os: "windows-latest",
            node: "16"
          }
        ]
      });

      const context = getMatrixContext(workflowContext);

      expect(context).toEqual(new data.Dictionary());
    });
  });
});
