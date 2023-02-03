import {data, DescriptionDictionary} from "@github/actions-expressions";
import {isScalar, isString} from "@github/actions-workflow-parser";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {WorkflowContext} from "../context/workflow-context";

export function getEnvContext(workflowContext: WorkflowContext): DescriptionDictionary {
  const d = new DescriptionDictionary();

  //step env
  if (workflowContext.step?.env) {
    envContext(workflowContext.step.env, d);
  }

  //job env
  const job = workflowContext.job;
  if (job && isJob(job) && job.env) {
    envContext(job.env, d);
  }

  //workflow env
  if (workflowContext.template && workflowContext.template.env) {
    const wfEnv = workflowContext.template.env.assertMapping("workflow env");
    envContext(wfEnv, d);
  }

  return d;
}

function envContext(envMap: MappingToken, d: data.Dictionary) {
  for (const env of envMap) {
    if (!isString(env.key)) {
      continue;
    }

    const value = isScalar(env.value) ? new data.StringData(env.value.toDisplayString()) : new data.Null();
    d.add(env.key.value, value);
  }
}
