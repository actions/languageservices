import {data} from "@github/actions-expressions";
import {isMapping, isSequence, isString} from "@github/actions-workflow-parser";
import { MappingToken } from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {WorkflowContext} from "../context/workflow-context";

export function getJobContext(workflowContext: WorkflowContext): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#job-context
  const keys = ["container", "services", "status"];

  const jobContext = new data.Dictionary();
  const job = workflowContext.job;
  if (!job) {
    return new data.Dictionary(
      ...keys.map(key => {
        return {key, value: new data.Null()};
      })
    );
  }

  // Container
  const jobContainer = job.container;
  if (jobContainer && isMapping(jobContainer)) {
    let containerContext = createContainerContext(jobContainer);
    jobContext.add("container", containerContext);
  }
  else {
    jobContext.add("container", new data.Null());
  }

  // Services
  const jobServices = job.services;
  if (jobServices && isMapping(jobServices)) {
    const servicesContext = new data.Dictionary();
    for (const service of jobServices) {
      if (!isMapping(service.value)) {
        continue
      }
      let serviceContext = createContainerContext(service.value);
      servicesContext.add(service.key.toString(), serviceContext);
    }
    jobContext.add("services", servicesContext);
  }
  else {
    jobContext.add("services", new data.Null());
  }

  // Status
  jobContext.add("status", new data.Null());

  return jobContext;
}

function createContainerContext(container: MappingToken): data.Dictionary {
  const containerContext = new data.Dictionary();
  for (const token of container) {
    if (isString(token.value)) {
      // image and options
      containerContext.add(token.key.toString(), new data.StringData(token.value.toString()));
    }
    else if (isSequence(token.value)) {
      // ports and volumes
      const sequence = new data.Array();
      for (const item of token.value) {
        sequence.add(new data.StringData(item.toString()));
      }
      containerContext.add(token.key.toString(), new data.Array(sequence));
    }
    else if (isMapping(token.value)) {
      // credentials and env
      const dict = new data.Dictionary();
      for (const item of token.value) {
        containerContext.add(item.key.toString(), new data.StringData(item.value.toString()));
      }
      containerContext.add(token.key.toString(), dict);
    }
  }
  return containerContext;
}

