import {ScalarToken} from "./scalar-token.js";
import {TemplateToken} from "./template-token.js";

export class KeyValuePair {
  public readonly key: ScalarToken;
  public readonly value: TemplateToken;
  public constructor(key: ScalarToken, value: TemplateToken) {
    this.key = key;
    this.value = value;
  }
}
