import {Octokit} from "@octokit/rest";
import { Agent } from "node:https";
import { readFileSync } from "fs";

export function getClient(token: string, userAgent?: string): Octokit {
  const selfSignedCertPath = process.env.NODE_EXTRA_CA_CERTS;

  // if NODE_EXTRA_CA_CERTS is set then use the self-signed cert to make the request
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
