import {BooleanDefinition} from "@github/actions-workflow-parser/templates/schema/boolean-definition";
import {Definition} from "@github/actions-workflow-parser/templates/schema/definition";
import {MappingDefinition} from "@github/actions-workflow-parser/templates/schema/mapping-definition";
import {OneOfDefinition} from "@github/actions-workflow-parser/templates/schema/one-of-definition";
import {StringDefinition} from "@github/actions-workflow-parser/templates/schema/string-definition";
import {getWorkflowSchema} from "@github/actions-workflow-parser/workflows/workflow-schema";
import {Value, ValueProvider} from "./config";

export function defaultValueProviders(): {[key: string]: ValueProvider} {
  const schema = getWorkflowSchema();

  const map: {[key: string]: ValueProvider} = {};
  for (const key of Object.keys(schema.definitions)) {
    const provider = definitionValueProvider(key, schema.definitions);
    if (provider) {
      map[key] = provider;
    }
  }

  return {
    ...map,
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

function definitionValueProvider(key: string, definitions: {[key: string]: Definition}): ValueProvider | undefined {
  const def = definitions[key];

  if (def instanceof MappingDefinition) {
    return mappingValueProvider(def);
  }

  if (def instanceof OneOfDefinition) {
    return oneOfValueProvider(def, definitions);
  }

  if (def instanceof BooleanDefinition) {
    return () => stringsToValues(["true", "false"]);
  }

  if (def instanceof StringDefinition && def.constant) {
    return () => stringsToValues([def.constant]);
  }
}

function mappingValueProvider(mappingDefinition: MappingDefinition): ValueProvider {
  const properties: Value[] = [];
  for (const [key, value] of Object.entries(mappingDefinition.properties)) {
    properties.push({label: key, description: value.description});
  }
  return () => properties;
}

function oneOfValueProvider(oneOfDefinition: OneOfDefinition, definitions: {[key: string]: Definition}): ValueProvider {
  return () => {
    const values: Value[] = [];
    for (const key of oneOfDefinition.oneOf) {
      const provider = definitionValueProvider(key, definitions);
      if (!provider) {
        continue;
      }
      for (const prop of provider()) {
        values.push(prop);
      }
    }
    return distinctValues(values);
  };
}

function stringsToValues(labels: string[]): Value[] {
  return labels.map(x => ({label: x}));
}

function distinctValues(values: Value[]): Value[] {
  const map = new Map<string, Value>();
  for (const value of values) {
    map.set(value.label, value);
  }
  return Array.from(map.values());
}
