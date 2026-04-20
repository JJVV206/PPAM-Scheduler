import { loadEnvConfig } from "@next/env";

declare global {
  // eslint-disable-next-line no-var
  var ppamEnvLoaded: boolean | undefined;
}

export function ensureServerEnvLoaded() {
  if (globalThis.ppamEnvLoaded) {
    return;
  }

  loadEnvConfig(process.cwd());
  globalThis.ppamEnvLoaded = true;
}
