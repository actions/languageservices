import {TraceWriter} from "@github/actions-workflow-parser/templates/trace-writer";

export const nullTrace: TraceWriter = {
  info: x => {},
  verbose: x => {},
  error: x => {}
};
