import type { TagLib } from "../taglib.ts";

let cachedTagLib: TagLib | null = null;
let bufferModeEnabled = false;
let sidecarConfig: {
  preopens: Record<string, string>;
  wasmtimePath?: string;
  wasmPath?: string;
} | null = null;

export async function setSidecarConfig(
  config: {
    preopens: Record<string, string>;
    wasmtimePath?: string;
    wasmPath?: string;
  } | null,
): Promise<void> {
  sidecarConfig = config;
  if (config) {
    bufferModeEnabled = false;
  }
  if (cachedTagLib) {
    await cachedTagLib.sidecar?.shutdown();
    cachedTagLib = null;
  }
}

export function setBufferMode(enabled: boolean): void {
  bufferModeEnabled = enabled;
  if (enabled) {
    sidecarConfig = null;
  }
  cachedTagLib = null;
}

export async function getTagLib(): Promise<TagLib> {
  if (!cachedTagLib) {
    const { TagLib } = await import("../taglib.ts");
    let initOptions;
    if (sidecarConfig) {
      initOptions = { useSidecar: true, sidecarConfig } as const;
    } else if (bufferModeEnabled) {
      initOptions = { forceBufferMode: true } as const;
    }
    cachedTagLib = await TagLib.initialize(initOptions);
  }
  return cachedTagLib;
}
