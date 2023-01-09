import { ScalarToken } from "./scalar-token"
import { TemplateToken } from "./template-token"

export class KeyValuePair {
  public readonly key: ScalarToken
  public readonly value: TemplateToken
  public constructor(key: ScalarToken, value: TemplateToken) {
    this.key = key
    this.value = value
  }
}
