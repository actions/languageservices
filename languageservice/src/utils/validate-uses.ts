/**
 * Shared validation utilities for step `uses` field format.
 * Used by both workflow and action validation.
 */

import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {mapRange} from "./range.js";

// Matches a short SHA (7-8 hex characters) that looks like it should be a full SHA
const SHORT_SHA_PATTERN = /^[0-9a-f]{7,8}$/i;
const SHORT_SHA_DOCS_URL =
  "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions";

/**
 * Checks if a ref looks like a short SHA and adds a warning if so.
 * Returns true if a warning was added.
 */
export function warnIfShortSha(diagnostics: Diagnostic[], token: StringToken, ref: string): boolean {
  if (SHORT_SHA_PATTERN.test(ref)) {
    diagnostics.push({
      message: `The provided ref '${ref}' may be a shortened commit SHA. If so, please use the full 40-character commit SHA instead, as short SHAs are not supported.`,
      severity: DiagnosticSeverity.Warning,
      range: mapRange(token.range),
      code: "short-sha-ref",
      codeDescription: {
        href: SHORT_SHA_DOCS_URL
      }
    });
    return true;
  }
  return false;
}

/**
 * Validates the format of a step's `uses` field.
 *
 * Valid formats:
 * - docker://image:tag
 * - ./local/path
 * - .\local\path (Windows)
 * - {owner}/{repo}@{ref}
 * - {owner}/{repo}/{path}@{ref}
 */
export function validateStepUsesFormat(diagnostics: Diagnostic[], token: StringToken): void {
  const uses = token.value;

  // Empty uses value
  if (!uses) {
    diagnostics.push({
      message: "'uses' value in action cannot be blank",
      severity: DiagnosticSeverity.Error,
      range: mapRange(token.range),
      code: "invalid-uses-format"
    });
    return;
  }

  // Docker image reference - always valid format
  if (uses.startsWith("docker://")) {
    return;
  }

  // Local action path - always valid format
  if (uses.startsWith("./") || uses.startsWith(".\\")) {
    return;
  }

  // Remote action: must be {owner}/{repo}[/path]@{ref}
  const atSegments = uses.split("@");

  // Must have exactly one @
  if (atSegments.length !== 2) {
    addStepUsesFormatError(diagnostics, token);
    return;
  }

  const [repoPath, gitRef] = atSegments;

  // Ref cannot be empty
  if (!gitRef) {
    addStepUsesFormatError(diagnostics, token);
    return;
  }

  // Split by / or \ to get path segments
  const pathSegments = repoPath.split(/[\\/]/);

  // Must have at least owner and repo (both non-empty)
  if (pathSegments.length < 2 || !pathSegments[0] || !pathSegments[1]) {
    addStepUsesFormatError(diagnostics, token);
    return;
  }

  // Check if this is a reusable workflow reference (should be at job level, not step)
  // Path would be like: owner/repo/.github/workflows/file.yml
  if (pathSegments.length >= 4 && pathSegments[2] === ".github" && pathSegments[3] === "workflows") {
    diagnostics.push({
      message: "Reusable workflows should be referenced at the top-level `jobs.<job_id>.uses` key, not within steps",
      severity: DiagnosticSeverity.Error,
      range: mapRange(token.range),
      code: "invalid-uses-format"
    });
    return;
  }

  // Warn if ref looks like a short SHA
  warnIfShortSha(diagnostics, token, gitRef);
}

function addStepUsesFormatError(diagnostics: Diagnostic[], token: StringToken): void {
  diagnostics.push({
    message: `Expected format {owner}/{repo}[/path]@{ref}. Actual '${token.value}'`,
    severity: DiagnosticSeverity.Error,
    range: mapRange(token.range),
    code: "invalid-uses-format"
  });
}
