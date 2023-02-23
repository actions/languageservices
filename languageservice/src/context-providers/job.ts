import {data, DescriptionDictionary} from "@github/actions-expressions";
import {isMapping, isSequence} from "@github/actions-workflow-parser";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {WorkflowContext} from "../context/workflow-context";

export function getJobContext(workflowContext: WorkflowContext): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#job-context
  const jobContext = new DescriptionDictionary();
  const job = workflowContext.job;
  if (!job) {
    return jobContext;
  }

  // Container
  const jobContainer = job.container;
  if (jobContainer && isMapping(jobContainer)) {
    const containerContext = createContainerContext(jobContainer, false);
    jobContext.add("container", containerContext);
  }

  // Services
  const jobServices = job.services;
  if (jobServices && isMapping(jobServices)) {
    const servicesContext = new DescriptionDictionary();
    for (const service of jobServices) {
      if (!isMapping(service.value)) {
        continue;
      }
      const serviceContext = createContainerContext(service.value, true);
      servicesContext.add(service.key.toString(), serviceContext);
    }
    jobContext.add("services", servicesContext);
  }

  // Status
  jobContext.add("status", new data.Null());

  return jobContext;
}

function createContainerContext(container: MappingToken, isServices: boolean): data.Dictionary {
  const containerContext = new data.Dictionary();
  for (const {key, value} of container) {
    if (isSequence(value)) {
      // service ports are the only thing that is part of the job context
      if (key.toString() !== "ports") {
        continue;
      }
      const ports = new data.Dictionary();
      for (const item of value) {
        // We can determine the context mapping fully only if the port is defined
        // as a mapping (i.e. <port1>:<port2>), single ports are assigned randomly
        const portParts = item.toString().split(":");
        if (isServices && portParts.length === 2) {
          ports.add(portParts[1], new data.StringData(portParts[0]));
        } else {
          // If the port isn't a mapping, just use null
          ports.add(portParts[0], new data.Null());
        }
      }
      containerContext.add(key.toString(), ports);
    }
  }
  containerContext.add("id", new data.Null());
  containerContext.add("network", new data.Null());
  return containerContext;
}
