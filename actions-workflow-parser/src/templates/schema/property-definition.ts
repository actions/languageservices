import {MAPPING_PROPERTY_VALUE, TYPE, REQUIRED, DESCRIPTION} from "../template-constants";
import {TemplateToken, StringToken} from "../tokens";
import {TokenType} from "../tokens/types";

export class PropertyDefinition {
  public readonly type: string = "";
  public readonly required: boolean = false;
  public readonly description: string | undefined;

  public constructor(token: TemplateToken) {
    if (token.templateTokenType === TokenType.String) {
      this.type = (token as StringToken).value;
    } else {
      const mapping = token.assertMapping(MAPPING_PROPERTY_VALUE);
      for (const mappingPair of mapping) {
        const mappingKey = mappingPair.key.assertString(`${MAPPING_PROPERTY_VALUE} key`);
        switch (mappingKey.value) {
          case TYPE:
            this.type = mappingPair.value.assertString(`${MAPPING_PROPERTY_VALUE} ${TYPE}`).value;
            break;
          case REQUIRED:
            this.required = mappingPair.value.assertBoolean(`${MAPPING_PROPERTY_VALUE} ${REQUIRED}`).value;
            break;
          case DESCRIPTION:
            this.description = mappingPair.value.assertString(`${MAPPING_PROPERTY_VALUE} ${DESCRIPTION}`).value;
            break;
          default:
            mappingKey.assertUnexpectedValue(`${MAPPING_PROPERTY_VALUE} key`); // throws
        }
      }
    }
  }
}
