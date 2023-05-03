import {Octokit} from "@octokit/rest";
import {Agent} from "node:https";
import { CertificateReader } from "./certificate-reader";

export function getClient(token: string, userAgent?: string): Octokit {

  const certReader = new CertificateReader();
  const selfSignedCerts = certReader.getAllRootCAs();

  if (selfSignedCerts.length > 0) {
    const httpsAgent = new Agent({
      ca: selfSignedCerts,
    });

    return new Octokit({
      auth: token,
      userAgent: userAgent || `GitHub Actions Language Server`,
      request: {
        agent: httpsAgent
      }
    });
  } else {
    return new Octokit({
      auth: token,
      userAgent: userAgent || `GitHub Actions Language Server`
    });
  }
}
