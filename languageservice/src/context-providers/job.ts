import {data, DescriptionDictionary} from "@actions/expressions";
import {isMapping, isSequence} from "@actions/workflow-parser";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {WorkflowContext} from "../context/workflow-context.js";
import {getDescription} from "./descriptions.js";

/**
 * Returns the job context with container, services, status, and check_run_id.
 */
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
    jobContext.add("container", containerContext, getDescription("job", "container"));
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
    jobContext.add("services", servicesContext, getDescription("job", "services"));
  }

  // Status
  jobContext.add("status", new data.StringData(""), getDescription("job", "status"));

  // Check run ID
  jobContext.add("check_run_id", new data.StringData(""), getDescription("job", "check_run_id"));

  return jobContext;
}

function createContainerContext(container: MappingToken, isServices: boolean): DescriptionDictionary {
  const containerContext = new DescriptionDictionary();

  // id and network are always available
  containerContext.add(
    "id",
    new data.StringData(""),
    getDescription("job", isServices ? "services.<service_id>.id" : "container.id")
  );
  containerContext.add(
    "network",
    new data.StringData(""),
    getDescription("job", isServices ? "services.<service_id>.network" : "container.network")
  );

  // ports are only available for service containers (not job container)
  if (isServices) {
    const ports = new DescriptionDictionary();
    for (const {key, value} of container) {
      if (key.toString() === "ports" && isSequence(value)) {
        for (const item of value) {
          const portParts = item.toString().split(":");
          // The key is the container port (second part if host:container format)
          const containerPort = portParts.length === 2 ? portParts[1] : portParts[0];
          ports.add(containerPort, new data.StringData(""));
        }
      }
    }
    containerContext.add("ports", ports, getDescription("job", "services.<service_id>.ports"));
  }

  return containerContext;
}
