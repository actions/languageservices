import check_run from "./check_run.json" assert {type: "json"};
import check_suite from "./check_suite.json" assert {type: "json"};
import commit_comment from "./commit_comment.json" assert {type: "json"};
import content_reference from "./content_reference.json" assert {type: "json"};
import create from "./create.json" assert {type: "json"};
import deletePayload from "./delete.json" assert {type: "json"};
import deploy_key from "./deploy_key.json" assert {type: "json"};
import deployment from "./deployment.json" assert {type: "json"};
import deployment_status from "./deployment_status.json" assert {type: "json"};
import fork from "./fork.json" assert {type: "json"};
import github_app_authorization from "./github_app_authorization.json" assert {type: "json"};
import gollum from "./gollum.json" assert {type: "json"};
import installation from "./installation.json" assert {type: "json"};
import installation_repositories from "./installation_repositories.json" assert {type: "json"};
import issue_comment from "./issue_comment.json" assert {type: "json"};
import issues from "./issues.json" assert {type: "json"};
import label from "./label.json" assert {type: "json"};
import marketplace_purchase from "./marketplace_purchase.json" assert {type: "json"};
import member from "./member.json" assert {type: "json"};
import membership from "./membership.json" assert {type: "json"};
import merge_group from "./merge_group.json" assert {type: "json"};
import meta from "./meta.json" assert {type: "json"};
import milestone from "./milestone.json" assert {type: "json"};
import org_block from "./org_block.json" assert {type: "json"};
import organization from "./organization.json" assert {type: "json"};
import packagePayload from "./package_payload.json" assert {type: "json"};
import page_build from "./page_build.json" assert {type: "json"};
import ping from "./ping.json" assert {type: "json"};
import project from "./project.json" assert {type: "json"};
import project_card from "./project_card.json" assert {type: "json"};
import project_column from "./project_column.json" assert {type: "json"};
import publicPayload from "./public.json" assert {type: "json"};
import pull_request from "./pull_request.json" assert {type: "json"};
import pull_request_review from "./pull_request_review.json" assert {type: "json"};
import pull_request_review_comment from "./pull_request_review_comment.json" assert {type: "json"};
import push from "./push.json" assert {type: "json"};
import release from "./release.json" assert {type: "json"};
import repository from "./repository.json" assert {type: "json"};
import repository_dispatch from "./repository_dispatch.json" assert {type: "json"};
import repository_import from "./repository_import.json" assert {type: "json"};
import repository_vulnerability_alert from "./repository_vulnerability_alert.json" assert {type: "json"};
import schedule from "./schedule.json" assert {type: "json"};
import security_advisory from "./security_advisory.json" assert {type: "json"};
import sponsorship from "./sponsorship.json" assert {type: "json"};
import star from "./star.json" assert {type: "json"};
import status from "./status.json" assert {type: "json"};
import team from "./team.json" assert {type: "json"};
import team_add from "./team_add.json" assert {type: "json"};
import watch from "./watch.json" assert {type: "json"};
import workflow_dispatch from "./workflow_dispatch.json" assert {type: "json"};
import workflow_run from "./workflow_run.json" assert {type: "json"};

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
  merge_group,
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
