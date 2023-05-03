export class CertificateReader {
  getAllRootCAs(): string[] {
    switch (process.platform) {
      case "darwin":
        return this.getMacOSCerts();
      case "win32":
        return this.getWindowsCerts();
      default:
        // We only support self-signed certs from Windows anc MacOS
        return [];
    }
  }

  private getMacOSCerts(): string[] {
    // loading modules here prevents unnecessary module loading
    // see: https://stackoverflow.com/questions/9132772/lazy-loading-in-node-js
    const macCa = require("@roamhq/mac-ca");
    const forge = require("node-forge");

    return macCa.all().map((cert: any) => forge.pki.certificateToPem(cert));
  }

  private getWindowsCerts(): string[] {
    const ca = require("win-ca");

    let rootCAs: string[] = [];

    ca({
      format: ca.der2.pem,
      ondata: (crt: string) => rootCAs.push(crt)
    });

    return rootCAs;
  }
}
