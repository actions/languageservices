import {RequestError} from "@octokit/types";

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }

  if ("name" in (error as RequestError)) {
    return (error as RequestError).name;
  }

  const status = errorStatus(error);
  if (status) {
    return `HTTP ${status}`;
  }

  return "Unknown error";
}

export function errorStatus(error: unknown): number | undefined {
  if ("status" in (error as RequestError)) {
    return (error as RequestError).status;
  }
}
