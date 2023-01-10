// Does just-in-time expression expansion

import {evaluateMappingToken, evaluateStringToken, evaluateTemplateToken} from "./evaluate-expression";
import {CLOSE_EXPRESSION, OPEN_EXPRESSION} from "./template-constants";
import {TemplateContext} from "./template-context";
import {
  BasicExpressionToken,
  InsertExpressionToken,
  LiteralToken,
  MappingToken,
  ScalarToken,
  SequenceToken,
  StringToken,
  TemplateToken
} from "./tokens";
import {TokenType} from "./tokens/types";

/**
 * This class allows callers to easily traverse a template object.
 * This class hides the details of expression expansion, depth tracking,
 * and memory tracking.
 */
export class TemplateUnraveler {
  private readonly _context: TemplateContext;
  private _current: ReaderState | undefined;
  private _expanded = false;

  public constructor(context: TemplateContext, template: TemplateToken, removeBytes: number) {
    this._context = context;

    // Initialize the reader state
    this.moveFirst(template, removeBytes);
  }

  public allowScalar(expand: boolean): ScalarToken | undefined {
    if (expand) {
      this.unravel(true);
    }

    if (this._current?.value.isScalar) {
      const scalar = this._current.value as ScalarToken;
      this.moveNext();
      return scalar;
    }

    return undefined;
  }

  public allowSequenceStart(expand: boolean): SequenceToken | undefined {
    if (expand) {
      this.unravel(true);
    }

    if (this._current?.value.templateTokenType === TokenType.Sequence && (this._current as SequenceState).isStart) {
      const sequence = new SequenceToken(
        this._current.value.file,
        this._current.value.range,
        this._current.value.definitionInfo
      );
      this.moveNext();
      return sequence;
    }

    return undefined;
  }

  public allowSequenceEnd(expand: boolean): boolean {
    if (expand) {
      this.unravel(true);
    }

    if (this._current?.value.templateTokenType === TokenType.Sequence && (this._current as SequenceState).isEnd) {
      this.moveNext();
      return true;
    }

    return false;
  }

  public allowMappingStart(expand: boolean): MappingToken | undefined {
    if (expand) {
      this.unravel(true);
    }

    if (this._current?.value.templateTokenType === TokenType.Mapping && (this._current as MappingState).isStart) {
      const mapping = new MappingToken(
        this._current.value.file,
        this._current.value.range,
        this._current.value.definitionInfo
      );
      this.moveNext();
      return mapping;
    }

    return undefined;
  }

  public allowMappingEnd(expand: boolean): boolean {
    if (expand) {
      this.unravel(true);
    }

    if (this._current?.value.templateTokenType === TokenType.Mapping && (this._current as MappingState).isEnd) {
      this.moveNext();
      return true;
    }

    return false;
  }

  public readEnd(): void {
    if (this._current !== undefined) {
      throw new Error(`Expected end of template object. ${this.dumpState("readEnd")}`);
    }
  }

  public readMappingEnd(): void {
    if (!this.allowMappingEnd(false)) {
      throw new Error(`Unexpected state while attempting to read the mapping end. ${this.dumpState("readMappingEnd")}`);
    }
  }

  public skipSequenceItem(): void {
    if (this._current?.parent?.value.templateTokenType !== TokenType.Sequence) {
      throw new Error(
        `Unexpected state while attempting to skip the current sequence item. ${this.dumpState("skipSequenceItem")}`
      );
    }

    this.moveNext(true);
  }

  public skipMappingKey(): void {
    if (
      this._current?.parent?.value.templateTokenType !== TokenType.Mapping ||
      !(this._current.parent as MappingState).isKey
    ) {
      throw new Error(
        `Unexpected state while attempting to skip the current mapping key. ${this.dumpState("skipMappingKey")}`
      );
    }

    this.moveNext(true);
  }

  public skipMappingValue(): void {
    if (
      this._current?.parent?.value.templateTokenType !== TokenType.Mapping ||
      (this._current.parent as MappingState).isKey
    ) {
      throw new Error(
        `Unexpected state while attempting to skip the current mapping value. ${this.dumpState("skipMappingValue")}`
      );
    }

    this.moveNext(true);
  }

  private dumpState(operation: string): string {
    const result: string[] = [];

    if (operation) {
      result.push(`Operation: ${operation}`);
    }

    if (this._current === undefined) {
      result.push(`State: (null)`);
    } else {
      result.push(`State:`);
      result.push("");

      // Push state hierarchy
      const stack: ReaderState[] = [];
      let curr: ReaderState | undefined = this._current;
      while (curr) {
        result.push(curr.toString());
        curr = curr.parent;
      }
    }

    return result.join("\n");
  }

  private moveFirst(value: TemplateToken, removeBytes: number): void {
    switch (value.templateTokenType) {
      case TokenType.Null:
      case TokenType.Boolean:
      case TokenType.Number:
      case TokenType.String:
      case TokenType.Sequence:
      case TokenType.Mapping:
      case TokenType.BasicExpression:
        break;
      default:
        throw new Error(`Unexpected type '${value.typeName()}' when initializing object reader state`);
    }

    this._current = ReaderState.createState(undefined, value, this._context);
  }

  private moveNext(skipNestedEvents?: boolean): void {
    if (this._current === undefined) {
      return;
    }

    // Sequence start
    if (
      this._current.value.templateTokenType === TokenType.Sequence &&
      (this._current as SequenceState).isStart &&
      !skipNestedEvents
    ) {
      // Move to the first item or sequence end
      const sequenceState = this._current as SequenceState;
      this._current = sequenceState.next();
    }
    // Mapping state
    else if (
      this._current.value.templateTokenType === TokenType.Mapping &&
      (this._current as MappingState).isStart &&
      !skipNestedEvents
    ) {
      // Move to the first item key or mapping end
      const mappingState = this._current as MappingState;
      this._current = mappingState.next();
    }
    // Parent is a sequence
    else if (this._current.parent?.value.templateTokenType === TokenType.Sequence) {
      // Move to the next item or sequence end
      const parentSequenceState = this._current.parent as SequenceState;
      this._current = parentSequenceState.next();
    }
    // Parent is a mapping
    else if (this._current.parent?.value.templateTokenType === TokenType.Mapping) {
      // Move to the next item value, item key, or mapping end
      const parentMappingState = this._current.parent as MappingState;
      this._current = parentMappingState.next();
    }
    // Parent is an expression end
    else if (this._current.parent !== undefined) {
      this._current = this._current.parent;
    }
    // Parent is undefined
    else {
      this._current = undefined;
    }

    this._expanded = false;
    this.unravel(false);
  }

  private unravel(expand: boolean): void {
    if (this._expanded) {
      return;
    }

    for (;;) {
      if (this._current === undefined) {
        break;
      }
      // Literal
      else if (this._current.value.isLiteral) {
        break;
      }
      // Basic expression
      else if (this._current.value.templateTokenType === TokenType.BasicExpression) {
        const basicExpressionState = this._current as BasicExpressionState;

        // Sequence item is a basic expression start
        // For example:
        //   steps:
        //     - script: credscan
        //     - ${{ parameters.preBuild }}
        //     - script: build
        if (basicExpressionState.isStart && this._current.parent?.value.templateTokenType === TokenType.Sequence) {
          if (expand) {
            this.sequenceItemBasicExpression();
          } else {
            break;
          }
        }
        // Mapping key is a basic expression start
        // For example:
        //   steps:
        //     - ${{ parameters.scriptHost }}: echo hi
        else if (
          basicExpressionState.isStart &&
          this._current.parent?.value.templateTokenType === TokenType.Mapping &&
          (this._current.parent as MappingState).isKey
        ) {
          if (expand) {
            this.mappingKeyBasicExpression();
          } else {
            break;
          }
        }
        // Mapping value is a basic expression start
        // For example:
        //   steps:
        //     - script: credscan
        //     - script: ${{ parameters.tool }}
        else if (
          basicExpressionState.isStart &&
          this._current.parent?.value.templateTokenType === TokenType.Mapping &&
          !(this._current.parent as MappingState).isKey
        ) {
          if (expand) {
            this.mappingValueBasicExpression();
          } else {
            break;
          }
        }
        // Root basic expression start
        else if (basicExpressionState.isStart && this._current.parent === undefined) {
          if (expand) {
            this.rootBasicExpression();
          } else {
            break;
          }
        }
        // Basic expression end
        else if (basicExpressionState.isEnd) {
          this.endExpression();
        } else {
          this.unexpectedState("unravel basic expression");
        }
      }
      // Mapping
      else if (this._current.value.templateTokenType === TokenType.Mapping) {
        const mappingState = this._current as MappingState;

        // Mapping end, closing an "insert" mapping insertion
        if (mappingState.isEnd && this._current.parent?.value.templateTokenType === TokenType.InsertExpression) {
          this._current = this._current.parent; // Skip to the expression end
        }
        // Normal mapping start
        else if (mappingState.isStart) {
          break;
        }
        // Normal mapping end
        else if (mappingState.isEnd) {
          break;
        } else {
          this.unexpectedState("unravel mapping");
        }
      }
      // Sequence
      else if (this._current.value.templateTokenType === TokenType.Sequence) {
        const sequenceState = this._current as SequenceState;

        // Sequence end, closing a sequence insertion
        if (
          sequenceState.isEnd &&
          this._current.parent?.value.templateTokenType === TokenType.BasicExpression &&
          this._current.parent.parent?.value.templateTokenType === TokenType.Sequence
        ) {
          this._current = this._current.parent; // Skip to the expression end
        }
        // Normal sequence start
        else if (sequenceState.isStart) {
          break;
        }
        // Normal sequence end
        else if (sequenceState.isEnd) {
          break;
        } else {
          this.unexpectedState("unravel sequence");
        }
      }
      // Insert expression
      else if (this._current.value.templateTokenType === TokenType.InsertExpression) {
        const insertExpressionState = this._current as InsertExpressionState;

        // Mapping key, beginning an "insert" mapping insertion
        // For example:
        //   - job: a
        //     variables:
        //       ${{ insert }}: ${{ parameters.jobVariables }}
        if (
          insertExpressionState.isStart &&
          this._current.parent?.value.templateTokenType === TokenType.Mapping &&
          (this._current.parent as MappingState).isKey
        ) {
          if (expand) {
            this.startMappingInsertion();
          } else {
            break;
          }
        }
        // Expression end
        else if (insertExpressionState.isEnd) {
          this.endExpression();
        }
        // Not allowed
        else if (insertExpressionState.isStart) {
          this._context.error(
            insertExpressionState.value,
            `The expression directive '${insertExpressionState.expression.directive}' is not supported in this context`
          );
          this._current = insertExpressionState.toStringToken();
        } else {
          this.unexpectedState("unravel insert expression");
        }
      } else {
        this.unexpectedState("unravel");
      }
    }

    this._expanded = expand;
  }

  private sequenceItemBasicExpression() {
    // The template looks like:
    //
    //   steps:
    //   - ${{ parameters.preSteps }}
    //   - script: build
    //
    // The current state looks like:
    //
    //   MappingState   // The document starts with a mapping
    //
    //   SequenceState  // The "steps" sequence
    //
    //   BasicExpressionState   // m_current

    const expressionState = this._current as BasicExpressionState;
    const expression = expressionState.value as BasicExpressionToken;
    let value: TemplateToken | undefined;
    try {
      value = evaluateTemplateToken(expression, expressionState.context);
    } catch (err) {
      this._context.error(expression, err);
    }

    // Move to the nested sequence, skip the sequence start
    if (value?.templateTokenType === TokenType.Sequence) {
      this._current = expressionState.next(value, true);
    }
    // Move to the new value
    else if (value !== undefined) {
      this._current = expressionState.next(value, false);
    }
    // Move to the expression end
    else if (value === undefined) {
      expressionState.end();
    }
  }

  private mappingKeyBasicExpression(): void {
    // The template looks like:
    //
    //   steps:
    //   - ${{ parameters.scriptHost }}: echo hi
    //
    // The current state looks like:
    //
    //   MappingState   // The document starts with a mapping
    //
    //   SequenceState  // The "steps" sequence
    //
    //   MappingState   // The step mapping
    //
    //   BasicExpressionState   // m_current

    // The expression should evaluate to a string
    const expressionState = this._current as BasicExpressionState;
    const expression = expressionState.value as BasicExpressionToken;
    let stringToken: StringToken | undefined;
    try {
      const result = evaluateStringToken(expression, expressionState.context);
      stringToken = result as StringToken;
    } catch (err) {
      this._context.error(expression, err);
    }

    // Move to the stringToken
    if (stringToken !== undefined) {
      this._current = expressionState.next(stringToken, false);
    }
    // Move to the next key or mapping end
    else {
      const parentMappingState = this._current!.parent as MappingState;
      this._current = parentMappingState.next(); // Next key or mapping end
    }
  }

  private mappingValueBasicExpression(): void {
    // The template looks like:
    //
    //   steps:
    //   - script: credScan
    //   - script: ${{ parameters.tool }}
    //
    // The current state looks like:
    //
    //   MappingState   // The document starts with a mapping
    //
    //   SequenceState  // The "steps" sequence
    //
    //   MappingState   // The step mapping
    //
    //   BasicExpressionState   // m_current

    const expressionState = this._current as BasicExpressionState;
    const expression = expressionState.value as BasicExpressionToken;
    let value: TemplateToken;
    try {
      value = evaluateTemplateToken(expression, expressionState.context);
    } catch (err) {
      this._context.error(expression, err);
      value = new StringToken(expression.file, expression.range, "", expression.definitionInfo);
    }

    // Move to the new value
    this._current = expressionState.next(value, false);
  }

  private rootBasicExpression() {
    // The template looks like:
    //
    //   ${{ parameters.tool }}
    //
    // The current state looks like:
    //
    //   BasicExpressionState   // m_current

    const expressionState = this._current as BasicExpressionState;
    const expression = expressionState.value as BasicExpressionToken;
    let value: TemplateToken;
    try {
      value = evaluateTemplateToken(expression, expressionState.context);
    } catch (err) {
      this._context.error(expression, err);
      value = new StringToken(expression.file, expression.range, "", expression.definitionInfo);
    }

    // Move to the new value
    this._current = expressionState.next(value, false);
  }

  private startMappingInsertion() {
    // The template looks like:
    //
    //   jobs:
    //   - job: a
    //     variables:
    //       ${{ insert }}: ${{ parameters.jobVariables }}
    //
    // The current state looks like:
    //
    //   MappingState       // The document starts with a mapping
    //
    //   SequenceState      // The "jobs" sequence
    //
    //   MappingState       // The "job" mapping
    //
    //   MappingState       // The "variables" mapping
    //
    //   InsertExpressionState  // m_current

    const expressionState = this._current as InsertExpressionState;
    const parentMappingState = expressionState.parent as MappingState;
    const nestedValue = parentMappingState.mapping.get(parentMappingState.index).value;
    let nestedMapping: MappingToken | undefined;
    if (nestedValue.templateTokenType === TokenType.Mapping) {
      nestedMapping = nestedValue as MappingToken;
    } else if (nestedValue.templateTokenType === TokenType.BasicExpression) {
      const basicExpression = nestedValue as BasicExpressionToken;

      // The expression should evaluate to a mapping
      try {
        nestedMapping = evaluateMappingToken(basicExpression, expressionState.context);
      } catch (err) {
        this._context.error(basicExpression, err);
      }
    } else {
      this._context.error(nestedValue, "Expected a mapping");
    }

    // Move to the nested first key
    if ((nestedMapping?.count ?? 0) > 0) {
      this._current = expressionState.next(nestedMapping!);
    }
    // Move to the expression end
    else {
      expressionState.end();
    }
  }

  private endExpression(): void {
    if (!this._current) {
      throw new Error("_current should not be null");
    }

    // End of document
    if (this._current.parent === undefined) {
      this._current = undefined;
    }
    // End basic expression
    else if (this._current.value.templateTokenType === TokenType.BasicExpression) {
      // Move to the next item or sequence end
      if (this._current.parent.value.templateTokenType === TokenType.Sequence) {
        const parentSequenceState = this._current.parent as SequenceState;
        this._current = parentSequenceState.next();
      }
      // Move to the next key, next value, or mapping end
      else {
        const parentMappingState = this._current.parent as MappingState;
        this._current = parentMappingState.next();
      }
    }
    // End "insert" mapping insertion
    else {
      // Move to the next key or mapping end
      const parentMappingState = this._current.parent as MappingState;
      this._current = parentMappingState.next();
    }
  }

  private unexpectedState(operation: string): void {
    throw new Error(`Unexpected state while unraveling expressions. ${this.dumpState(operation)}`);
  }
}

abstract class ReaderState {
  public readonly parent: ReaderState | undefined;
  public readonly value: TemplateToken;
  public readonly context: TemplateContext;

  public constructor(parent: ReaderState | undefined, value: TemplateToken, context: TemplateContext) {
    this.parent = parent;
    this.value = value;
    this.context = context;
  }

  public abstract toString(): string;

  public static createState(parent: ReaderState | undefined, value: TemplateToken, context: TemplateContext) {
    switch (value.templateTokenType) {
      case TokenType.Null:
      case TokenType.Boolean:
      case TokenType.Number:
      case TokenType.String:
        return new LiteralState(parent, value as LiteralToken, context);
      case TokenType.Sequence:
        return new SequenceState(parent, value as SequenceToken, context);
      case TokenType.Mapping:
        return new MappingState(parent, value as MappingToken, context);
      case TokenType.BasicExpression:
        return new BasicExpressionState(parent, value as BasicExpressionToken, context);
      case TokenType.InsertExpression:
        return new InsertExpressionState(parent, value as InsertExpressionToken, context);
      default:
        throw new Error(`Unexpected type '${value.typeName()}' when constructing reader state`);
    }
  }
}

class LiteralState extends ReaderState {
  public constructor(parent: ReaderState | undefined, literal: LiteralToken, context: TemplateContext) {
    super(parent, literal, context);
  }

  public override toString(): string {
    const result: string[] = [];
    result.push("LiteralState");
    return `${result.join("\n")}\n`;
  }
}

class SequenceState extends ReaderState {
  private _isStart = true;
  private _index = 0;

  public constructor(parent: ReaderState | undefined, sequence: SequenceToken, context: TemplateContext) {
    super(parent, sequence, context);
  }

  /**
   * Indicates whether the state represents the sequence-start event
   */
  public get isStart(): boolean {
    return this._isStart;
  }

  /**
   * The current index within the sequence
   */
  public get index(): number {
    return this._index;
  }

  /**
   * Indicates whether the state represents the sequence-end event
   */
  public get isEnd(): boolean {
    return !this.isStart && this.index >= this.sequence.count;
  }

  public get sequence(): SequenceToken {
    return this.value as SequenceToken;
  }

  public next(): ReaderState {
    // Adjust the state
    if (this._isStart) {
      this._isStart = false;
    } else {
      this._index++;
    }

    // Return the next event
    if (!this.isEnd) {
      return ReaderState.createState(this, this.sequence.get(this._index), this.context);
    } else {
      return this;
    }
  }

  public override toString(): string {
    const result: string[] = [];
    result.push("SequenceState:");
    result.push(`  isStart: ${this._isStart}`);
    result.push(`  index: ${this._index}`);
    result.push(`  isEnd: ${this.isEnd}`);
    return `${result.join("\n")}\n`;
  }
}

class MappingState extends ReaderState {
  private _isStart = true;
  private _index = 0;
  private _isKey = false;

  public constructor(parent: ReaderState | undefined, mapping: MappingToken, context: TemplateContext) {
    super(parent, mapping, context);
  }

  /**
   * Indicates whether the state represents the mapping-start event
   */
  public get isStart(): boolean {
    return this._isStart;
  }

  /**
   * The current index within the mapping
   */
  public get index(): number {
    return this._index;
  }

  /**
   * Indicates whether the state represents a mapping-key position
   */
  public get isKey(): boolean {
    return this._isKey;
  }

  /**
   * Indicates whether the state represents the mapping-end event
   */
  public get isEnd(): boolean {
    return !this._isStart && this._index >= this.mapping.count;
  }

  public get mapping(): MappingToken {
    return this.value as MappingToken;
  }

  public next(): ReaderState {
    // Adjust the state
    if (this._isStart) {
      this._isStart = false;
      this._isKey = true;
    } else if (this._isKey) {
      this._isKey = false;
    } else {
      this._index++;
      this._isKey = true;
    }

    // Return the next event
    if (!this.isEnd) {
      if (this._isKey) {
        return ReaderState.createState(this, this.mapping.get(this._index).key, this.context);
      } else {
        return ReaderState.createState(this, this.mapping.get(this._index).value, this.context);
      }
    } else {
      return this;
    }
  }

  public override toString(): string {
    const result: string[] = [];
    result.push("MappingState:");
    result.push(`  isStart: ${this._isStart}`);
    result.push(`  index: ${this._index}`);
    result.push(`  isKey: ${this._isKey}`);
    result.push(`  isEnd: ${this.isEnd}`);
    return `${result.join("\n")}\n`;
  }
}

class BasicExpressionState extends ReaderState {
  private _isStart = true;

  public constructor(parent: ReaderState | undefined, expression: BasicExpressionToken, context: TemplateContext) {
    super(parent, expression, context);
  }

  /**
   * Indicates whether entering the expression
   */
  public get isStart(): boolean {
    return this._isStart;
  }

  /**
   * Indicates whether leaving the expression
   */
  public get isEnd(): boolean {
    return !this._isStart;
  }

  public next(value: TemplateToken, isSequenceInsertion: boolean): ReaderState {
    // Adjust the state
    this._isStart = false;

    // Create the nested state
    const nestedState = ReaderState.createState(this, value, this.context);
    if (isSequenceInsertion) {
      const nestedSequenceState = nestedState as SequenceState;
      return nestedSequenceState.next(); // Skip the sequence start
    } else {
      return nestedState;
    }
  }

  public end(): ReaderState {
    this._isStart = false;
    return this;
  }

  public override toString(): string {
    const result: string[] = [];
    result.push("BasicExpressionState:");
    result.push(`  isStart: ${this._isStart}`);
    return `${result.join("\n")}\n`;
  }
}

class InsertExpressionState extends ReaderState {
  private _isStart = true;

  public constructor(parent: ReaderState | undefined, expression: InsertExpressionToken, context: TemplateContext) {
    super(parent, expression, context);
  }

  /**
   * Indicates whether entering or leaving the expression
   */
  public get isStart(): boolean {
    return this._isStart;
  }

  /**
   * Indicates whether leaving the expression
   */
  public get isEnd(): boolean {
    return !this._isStart;
  }

  public get expression(): InsertExpressionToken {
    return this.value as InsertExpressionToken;
  }

  public next(value: MappingToken): ReaderState {
    // Adjust the state
    this._isStart = false;

    // Create the nested state
    const nestedState = ReaderState.createState(this, value, this.context) as MappingState;
    return nestedState.next(); // Skip the mapping start
  }

  public end(): ReaderState {
    this._isStart = false;
    return this;
  }

  /**
   * This happens when the expression is not allowed
   */
  public toStringToken(): ReaderState {
    const literal = new StringToken(
      this.value.file,
      this.value.range,
      `${OPEN_EXPRESSION} ${this.expression.directive} ${CLOSE_EXPRESSION}`,
      this.value.definitionInfo
    );
    return ReaderState.createState(this.parent, literal, this.context);
  }

  public override toString(): string {
    const result: string[] = [];
    result.push("InsertExpressionState:");
    result.push(`  isStart: ${this._isStart}`);
    return `${result.join("\n")}\n`;
  }
}
