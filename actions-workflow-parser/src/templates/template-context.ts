import {FunctionInfo} from "@github/actions-expressions/funcs/info";

import {TemplateSchema} from "./schema/template-schema";
import {TemplateValidationError} from "./template-validation-error";
import {TemplateToken} from "./tokens";
import {TokenRange} from "./tokens/token-range";
import {TraceWriter} from "./trace-writer";
/**
 * Context object that is flowed through while loading and evaluating object templates
 */
export class TemplateContext {
  private readonly _fileIds: {[name: string]: number} = {};
  private readonly _fileNames: string[] = [];

  /**
   * Available functions within expression contexts
   */
  public readonly expressionFunctions: FunctionInfo[] = [];

  /**
   * Available values within expression contexts
   */
  public readonly expressionNamedContexts: string[] = [];

  public readonly errors: TemplateValidationErrors;
  public readonly schema: TemplateSchema;
  public readonly trace: TraceWriter;
  public readonly state: {[key: string]: any} = {};

  public constructor(errors: TemplateValidationErrors, schema: TemplateSchema, trace: TraceWriter) {
    this.errors = errors;
    this.schema = schema;
    this.trace = trace;
  }

  public error(token: TemplateToken | undefined, err: string, tokenRange?: TokenRange): void;
  public error(token: TemplateToken | undefined, err: Error, tokenRange?: TokenRange): void;
  public error(token: TemplateToken | undefined, err: unknown): void;
  public error(fileId: number | undefined, err: string, tokenRange?: TokenRange): void;
  public error(fileId: number | undefined, err: Error, tokenRange?: TokenRange): void;
  public error(fileId: number | undefined, err: unknown, tokenRange?: TokenRange): void;
  public error(
    tokenOrFileId: TemplateToken | number | undefined,
    err: string | Error | unknown,
    tokenRange?: TokenRange
  ): void {
    const token = tokenOrFileId as TemplateToken | undefined;
    const range = tokenRange || token?.range;
    const prefix = this.getErrorPrefix(token?.file ?? (tokenOrFileId as number | undefined), token?.line, token?.col);
    const message = (err as Error | undefined)?.message ?? `${err}`;

    const e = new TemplateValidationError(message, prefix, undefined, range);
    this.errors.add(e);
    this.trace.error(e.message);
  }

  /**
   * Gets or adds the file ID
   */
  public getFileId(file: string) {
    const key = file.toUpperCase();
    let id: number | undefined = this._fileIds[key];
    if (id === undefined) {
      id = this._fileNames.length + 1;
      this._fileIds[key] = id;
      this._fileNames.push(file);
    }

    return id;
  }

  /**
   * Looks up a file name by ID. Returns undefined if not found.
   */
  public getFileName(fileId: number): string | undefined {
    return this._fileNames.length >= fileId ? this._fileNames[fileId - 1] : undefined;
  }

  /**
   * Gets a copy of the file table
   */
  public getFileTable(): string[] {
    return this._fileNames.slice();
  }

  private getErrorPrefix(fileId?: number, line?: number, column?: number): string {
    const fileName = fileId !== undefined ? this.getFileName(fileId as number) : undefined;
    if (fileName) {
      if (line !== undefined && column !== undefined) {
        return `${fileName} (Line: ${line}, Col: ${column})`;
      } else {
        return fileName;
      }
    } else if (line !== undefined && column !== undefined) {
      return `(Line: ${line}, Col: ${column})`;
    } else {
      return "";
    }
  }
}

/**
 * Provides information about errors which occurred during validation
 */
export class TemplateValidationErrors {
  private readonly _maxErrors: number;
  private readonly _maxMessageLength: number;
  private _errors: TemplateValidationError[] = [];

  public constructor(maxErrors?: number, maxMessageLength?: number) {
    this._maxErrors = maxErrors ?? 0;
    this._maxMessageLength = maxMessageLength ?? 0;
  }

  public get count(): number {
    return this._errors.length;
  }

  public add(err: TemplateValidationError | TemplateValidationError[]): void {
    for (let e of Array.isArray(err) ? err : [err]) {
      // Check max errors
      if (this._maxErrors <= 0 || this._errors.length < this._maxErrors) {
        // Check max message length
        if (this._maxMessageLength > 0 && e.message.length > this._maxMessageLength) {
          e = new TemplateValidationError(
            e.message.substring(0, this._maxMessageLength) + "[...]",
            e.prefix,
            e.code,
            e.range
          );
        }

        this._errors.push(e);
      }
    }
  }

  /**
   * Throws if any errors
   * @param prefix The error message prefix
   */
  public check(prefix?: string): void {
    if (this._errors.length <= 0) {
      return;
    }

    if (!prefix) {
      prefix = "The template is not valid.";
    }

    throw new Error(`${prefix} ${this._errors.map(x => x.message).join(",")}`);
  }

  public clear(): void {
    this._errors = [];
  }

  public getErrors(): TemplateValidationError[] {
    return this._errors.slice();
  }
}
