import {Octokit} from "@octokit/rest";
import { Agent } from "node:https";
import { readFileSync } from "fs";

export function getClient(token: string, userAgent?: string): Octokit {
  const selfSignedCertPath = process.env.PATH_TO_SELF_SIGNED_CERT;

  if (selfSignedCertPath) {
    const httpsAgent = new Agent({
      ca: readFileSync(selfSignedCertPath)
    });

    return new Octokit({
      auth: token,
      userAgent: userAgent || `GitHub Actions Language Server`,
      request: {
        agent: httpsAgent
      },
    });

  } else {
    return new Octokit({
      auth: token,
      userAgent: userAgent || `GitHub Actions Language Server`
    });
  }
}
