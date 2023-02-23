import {Value} from "./config";

export function stringsToValues(labels: string[]): Value[] {
  return labels.map(x => ({label: x}));
}
