import check_run from "./check_run.json";
import check_suite from "./check_suite.json";
import commit_comment from "./commit_comment.json";
import content_reference from "./content_reference.json";
import create from "./create.json";
import deletePayload from "./delete.json";
import deploy_key from "./deploy_key.json";
import deployment from "./deployment.json";
import deployment_status from "./deployment_status.json";
import fork from "./fork.json";
import github_app_authorization from "./github_app_authorization.json";
import gollum from "./gollum.json";
import installation from "./installation.json";
import installation_repositories from "./installation_repositories.json";
import issue_comment from "./issue_comment.json";
import issues from "./issues.json";
import label from "./label.json";
import marketplace_purchase from "./marketplace_purchase.json";
import member from "./member.json";
import membership from "./membership.json";
import meta from "./meta.json";
import milestone from "./milestone.json";
import org_block from "./org_block.json";
import organization from "./organization.json";
import packagePayload from "./package.json";
import page_build from "./page_build.json";
import ping from "./ping.json";
import project from "./project.json";
import project_card from "./project_card.json";
import project_column from "./project_column.json";
import publicPayload from "./public.json";
import pull_request from "./pull_request.json";
import pull_request_review from "./pull_request_review.json";
import pull_request_review_comment from "./pull_request_review_comment.json";
import push from "./push.json";
import release from "./release.json";
import repository from "./repository.json";
import repository_dispatch from "./repository_dispatch.json";
import repository_import from "./repository_import.json";
import repository_vulnerability_alert from "./repository_vulnerability_alert.json";
import schedule from "./schedule.json";
import security_advisory from "./security_advisory.json";
import sponsorship from "./sponsorship.json";
import star from "./star.json";
import status from "./status.json";
import team from "./team.json";
import team_add from "./team_add.json";
import watch from "./watch.json";
import workflow_dispatch from "./workflow_dispatch.json";
import workflow_run from "./workflow_run.json";

export const eventPayloads: {[key: string]: Object} = {
  check_run,
  check_suite,
  commit_comment,
  content_reference,
  create,
  delete: deletePayload,
  deploy_key,
  deployment,
  deployment_status,
  fork,
  github_app_authorization,
  gollum,
  installation,
  installation_repositories,
  issue_comment,
  issues,
  label,
  marketplace_purchase,
  member,
  membership,
  meta,
  milestone,
  org_block,
  organization,
  package: packagePayload,
  page_build,
  ping,
  project,
  project_card,
  project_column,
  public: publicPayload,
  pull_request,
  pull_request_review,
  pull_request_review_comment,
  pull_request_target: pull_request,
  push,
  release,
  repository,
  repository_dispatch,
  repository_import,
  repository_vulnerability_alert,
  schedule,
  security_advisory,
  sponsorship,
  star,
  status,
  team,
  team_add,
  watch,
  workflow_dispatch,
  workflow_run
};
