import {parseWorkflow} from "@actions/workflow-parser";
import {File} from "@actions/workflow-parser/workflows/file";
import {nullTrace} from "../nulltrace.js";
import {getPositionFromCursor} from "../test-utils/cursor-position.js";
import {findToken} from "../utils/find-token.js";
import {ExpressionPos, mapToExpressionPos} from "./expression-pos.js";

describe("mapToExpressionPos", () => {
  it("simple expression", () => {
    expect(
      testMapToExpressionPos(`on: push
run-name: \${{ git|hub.event }}`)
    ).toEqual<ExpressionPos>({
      expression: "github.event",
      position: {line: 0, column: 3},
      documentRange: {
        start: {line: 1, character: 14},
        end: {line: 1, character: 26}
      }
    });
  });

  it("implicit format expression", () => {
    expect(
      testMapToExpressionPos(`on: push
run-name: hello \${{ git|hub.event }}`)
    ).toEqual<ExpressionPos>({
      expression: "github.event",
      position: {line: 0, column: 3},
      documentRange: {
        start: {line: 1, character: 20},
        end: {line: 1, character: 32}
      }
    });
  });

  it("implicit complex format expression", () => {
    expect(
      testMapToExpressionPos(`on: push
run-name: hello \${{ github.test }}-\${{ git|hub.event }}`)
    ).toEqual<ExpressionPos>({
      expression: "github.event",
      position: {line: 0, column: 3},
      documentRange: {
        start: {line: 1, character: 39},
        end: {line: 1, character: 51}
      }
    });
  });

  it("multi-line expression", () => {
    expect(
      testMapToExpressionPos(`on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
    - run: >
        echo 'hello'
        echo '\${{ github.event.te|st }}
        echo 'world'
        echo '\${{ github.event.test }}`)
    ).toEqual<ExpressionPos>({
      expression: "github.event.test",
      position: {line: 0, column: 15},
      documentRange: {
        start: {line: 7, character: 18},
        end: {line: 7, character: 35}
      }
    });
  });

  it("job-level if condition without status function (gets wrapped)", () => {
    expect(
      testMapToExpressionPos(`on: push
jobs:
  build:
    if: git|hub.event_name == 'push'
    runs-on: ubuntu-latest`)
    ).toEqual<ExpressionPos>({
      expression: "success() && (github.event_name == 'push')",
      position: {line: 0, column: 17}, // "success() && (".length + 3 = 17
      documentRange: {
        start: {line: 3, character: 8},
        end: {line: 3, character: 35} // End of the original condition in the document
      }
    });
  });

  it("job-level if condition with status function (not wrapped)", () => {
    expect(
      testMapToExpressionPos(`on: push
jobs:
  build:
    if: alw|ays()
    runs-on: ubuntu-latest`)
    ).toEqual<ExpressionPos>({
      expression: "always()",
      position: {line: 0, column: 3},
      documentRange: {
        start: {line: 3, character: 8},
        end: {line: 3, character: 16}
      }
    });
  });

  it("step-level if condition without status function (gets wrapped)", () => {
    expect(
      testMapToExpressionPos(`on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: steps.test.outc|ome == 'success'
        run: echo hello`)
    ).toEqual<ExpressionPos>({
      expression: "success() && (steps.test.outcome == 'success')",
      position: {line: 0, column: 29}, // Actual position in the wrapped expression
      documentRange: {
        start: {line: 5, character: 12},
        end: {line: 5, character: 43} // End of the original condition in the document
      }
    });
  });
});

function testMapToExpressionPos(input: string) {
  const [td, pos] = getPositionFromCursor(input);

  const file: File = {
    name: td.uri,
    content: td.getText()
  };
  const result = parseWorkflow(file, nullTrace);
  if (!result.value) {
    throw new Error("Invalid workflow");
  }

  const {token} = findToken(pos, result.value);
  if (!token) {
    throw new Error("No token found");
  }

  return mapToExpressionPos(token, pos);
}
