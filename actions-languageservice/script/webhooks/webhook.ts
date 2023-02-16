// Based on https://github.com/github/docs/blob/main/src/rest/scripts/utils/webhook.js

import {getBodyParams} from "./get-body-params.js";

export default class Webhook {
  public description: string;
  public summary: string;
  public bodyParameters: any[];
  public availability: string[];
  public action: string;
  public category: string;
  #webhook: any;

  constructor(webhook: any) {
    this.#webhook = webhook;
    this.description = webhook.description;
    this.summary = webhook.summary;
    this.bodyParameters = [];
    this.availability = webhook["x-github"]["supported-webhook-types"];

    // for some webhook action types (like some pull-request webhook types) the
    // schema properties are under a oneOf so we try and take the action from
    // the first one (the action will be the same across oneOf items)
    this.action =
      webhook.requestBody.content["application/json"]?.schema?.properties?.action?.enum?.[0] ||
      webhook.requestBody.content["application/json"]?.schema?.oneOf?.[0]?.properties?.action?.enum?.[0] ||
      null;

    // The OpenAPI uses hyphens for the webhook names, but the webhooks
    // are sent using underscores (e.g. `branch_protection_rule` instead
    // of `branch-protection-rule`)
    this.category = webhook["x-github"].subcategory.replaceAll("-", "_");
    return this;
  }

  public async process() {
    await this.renderBodyParameterDescriptions();
  }

  private async renderBodyParameterDescriptions() {
    if (!this.#webhook.requestBody) return [];
    const schema = this.#webhook.requestBody.content["application/json"]?.schema || {};

    const isObject = schema !== null && typeof schema === "object";

    this.bodyParameters = isObject ? await getBodyParams(schema, true) : [];
  }
}
