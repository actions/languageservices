import {TraceWriter} from "../templates/trace-writer";

export const nullTrace: TraceWriter = {
  info: x => {},
  verbose: x => {},
  error: x => {}
};
