import {Value, ValueProvider} from "./config";

export function defaultValueProviders(): {[key: string]: ValueProvider} {
  return {
    "runs-on": () =>
      stringsToValues([
        "ubuntu-latest",
        "ubuntu-18.04",
        "ubuntu-16.04",
        "windows-latest",
        "windows-2019",
        "windows-2016",
        "macos-latest",
        "macos-10.15",
        "macos-10.14",
        "macos-10.13",
        "self-hosted"
      ])
  };
}

export function stringsToValues(labels: string[]): Value[] {
  return labels.map(x => ({label: x}));
}
