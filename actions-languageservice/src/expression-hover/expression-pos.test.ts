import {parseWorkflow} from "@github/actions-workflow-parser/.";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {nullTrace} from "../nulltrace";
import {getPositionFromCursor} from "../test-utils/cursor-position";
import {findToken} from "../utils/find-token";
import {ExpressionPos, mapToExpressionPos} from "./expression-pos";

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
