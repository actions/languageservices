import {Value} from "./config.js";

export function stringsToValues(labels: string[]): Value[] {
  return labels.map(x => ({label: x}));
}
