import {TemplateToken} from "./tokens/index.js";

export class ParseEvent {
  public readonly type: EventType;
  public readonly token: TemplateToken | undefined;
  public constructor(type: EventType, token?: TemplateToken | undefined) {
    this.type = type;
    this.token = token;
  }
}

export enum EventType {
  Literal,
  SequenceStart,
  SequenceEnd,
  MappingStart,
  MappingEnd,
  DocumentStart,
  DocumentEnd
}
