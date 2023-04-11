import {
  BasicExpressionToken,
  MappingToken,
  ScalarToken,
  SequenceToken,
  StringToken,
  TemplateToken
} from "../templates/tokens";

export type WorkflowTemplate = {
  events: EventsConfig;
  jobs: WorkflowJob[];
  concurrency: TemplateToken;
  env: TemplateToken;

  errors?: {
    Message: string;
  }[];
};

export type ConcurrencySetting = {
  group?: StringToken;
  cancelInProgress?: boolean;
};

export type ActionsEnvironmentReference = {
  name?: TemplateToken;
  url?: TemplateToken;
};

export type WorkflowJob = Job | ReusableWorkflowJob;

export type JobType = "job" | "reusableWorkflowJob";

export type BaseJob = {
  type: JobType;
  id: StringToken;
  name?: ScalarToken;
  needs?: StringToken[];
  if: BasicExpressionToken;
  concurrency?: TemplateToken;
  strategy?: TemplateToken;
  outputs?: MappingToken;
};

// `job-factory` in the schema
export type Job = BaseJob & {
  type: "job";
  env?: MappingToken;
  environment?: TemplateToken;
  "runs-on"?: TemplateToken;
  container?: TemplateToken;
  services?: TemplateToken;
  steps: Step[];
};

// `workflow-job` in the schema
export type ReusableWorkflowJob = BaseJob & {
  type: "reusableWorkflowJob";
  ref: StringToken;
  "input-definitions"?: MappingToken;
  "input-values"?: MappingToken;
  "secret-definitions"?: MappingToken;
  "secret-values"?: MappingToken;
  "inherit-secrets"?: boolean;
  jobs?: WorkflowJob[];
};

export type Container = {
  image: StringToken;
  credentials?: Credential;
  env?: MappingToken;
  ports?: SequenceToken;
  volumes?: SequenceToken;
  options?: StringToken;
};

export type Credential = {
  username: StringToken | undefined;
  password: StringToken | undefined;
};

export type Step = ActionStep | RunStep;

type BaseStep = {
  id: string;
  name?: ScalarToken;
  if: BasicExpressionToken;
  "continue-on-error"?: boolean | ScalarToken;
  env?: MappingToken;
};

export type RunStep = BaseStep & {
  run: ScalarToken;
};

export type ActionStep = BaseStep & {
  uses: StringToken;
};

export type EventsConfig = {
  schedule?: ScheduleConfig[];
  workflow_dispatch?: WorkflowDispatchConfig;
  workflow_call?: WorkflowCallConfig;

  // Events that support filters
  pull_request?: BranchFilterConfig & PathFilterConfig & TypesFilterConfig;
  pull_request_target?: BranchFilterConfig & PathFilterConfig & TypesFilterConfig;
  push?: BranchFilterConfig & TagFilterConfig & PathFilterConfig;
  workflow_run?: WorkflowFilterConfig & BranchFilterConfig & TypesFilterConfig;

  // Events that only support activity types
  branch_protection_rule?: TypesFilterConfig;
  check_run?: TypesFilterConfig;
  check_suite?: TypesFilterConfig;
  disccusion?: TypesFilterConfig;
  disccusion_comment?: TypesFilterConfig;
  issue_comment?: TypesFilterConfig;
  issues?: TypesFilterConfig;
  label?: TypesFilterConfig;
  merge_group?: TypesFilterConfig;
  milestone?: TypesFilterConfig;
  project?: TypesFilterConfig;
  project_card?: TypesFilterConfig;
  project_column?: TypesFilterConfig;
  pull_request_review?: TypesFilterConfig;
  pull_request_review_comment?: TypesFilterConfig;
  registry_package?: TypesFilterConfig;
  repository_dispatch?: TypesFilterConfig;
  release?: TypesFilterConfig;
  watch?: TypesFilterConfig;

  // Index signature to allow easier lookup
  [eventName: string]: unknown;
};

export type TypesFilterConfig = {
  types?: string[];
};

export type BranchFilterConfig = {
  branches?: string[];
  "branches-ignore"?: string[];
};

export type TagFilterConfig = {
  tags?: string[];
  "tags-ignore"?: string[];
};

export type PathFilterConfig = {
  paths?: string[];
  "paths-ignore"?: string[];
};

export type WorkflowDispatchConfig = {
  inputs?: { [inputName: string]: InputConfig };
};

export type WorkflowCallConfig = {
  inputs?: { [inputName: string]: InputConfig & { default?: string | boolean | number | ScalarToken } };
  secrets?: { [secretName: string]: SecretConfig };
  // TODO - these are supported in C# and Go but not in TS yet
  // outputs: { [outputName: string]: OutputConfig }
};

export enum InputType {
  string = "string",
  choice = "choice",
  boolean = "boolean",
  environment = "environment"
}

export type InputConfig = {
  type: InputType;
  description?: string;
  required?: boolean;
  default?: string | boolean | number;
  options?: string[];
};

export type SecretConfig = {
  description?: string;
  required?: boolean;
};

export type ScheduleConfig = {
  cron: string;
};

export type WorkflowFilterConfig = {
  workflows?: string[];
};
