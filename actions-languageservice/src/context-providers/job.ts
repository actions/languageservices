import {data} from "@github/actions-expressions";
import { Dictionary } from "@github/actions-expressions/data/dictionary";
import {isMapping, isScalar, isString} from "@github/actions-workflow-parser";
import {WorkflowContext} from "../context/workflow-context";
import {scalarToData} from "../utils/scalar-to-data";

export function getJobContext(workflowContext: WorkflowContext): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#job-context
  const keys = ["container", "services", "status"];
  const containerKeys = ["id", "network"];
  const serviceKeys = containerKeys.concat("ports");

  const job = workflowContext.job;
  if (!job) {
    return new data.Dictionary();
  }

  const jobContext = new data.Dictionary();
  for (const key of keys) {
    if (!jobContext.get(key)) {
      switch (key) {
        case "container":
          var containerDictionary = new data.Dictionary();
          for (const containerKey of containerKeys) {
            if (job.container[containerKey]) {
              containerDictionary.add(containerKey, job.container[containerKey]);
            }
          }
          jobContext.add(key, containerDictionary);
          // jobContext.add(key, new data.Null());
          break;
        case "services":
          var services = new data.Dictionary();
          for (const service of job.services) {
            var serviceDictionary = new data.Dictionary();
            for (const serviceKey of serviceKeys) {
              if (service[serviceKey]) {
                serviceDictionary.add(serviceKey, service[serviceKey]);
              }
            }
            services.add(service, serviceDictionary);
          }
          jobContext.add(key, services);
          // jobContext.add(key, new data.Null());
          break;
        case "status":
          jobContext.add(key, job.status);
          // jobContext.add(key, new data.Null());
          break;
      }
    }
  }

  return jobContext;
}
