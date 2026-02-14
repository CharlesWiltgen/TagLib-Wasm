import type { TagLib } from "../taglib.ts";
import {
  getGlobalWorkerPool,
  type TagLibWorkerPool,
} from "../worker-pool/index.ts";

let cachedTagLib: TagLib | null = null;
let useWorkerPool = false;
let workerPoolInstance: TagLibWorkerPool | null = null;
let bufferModeEnabled = false;
let sidecarConfig: {
  preopens: Record<string, string>;
  wasmtimePath?: string;
  wasmPath?: string;
} | null = null;

export function setWorkerPoolMode(
  enabled: boolean,
  pool?: TagLibWorkerPool,
): void {
  useWorkerPool = enabled;
  if (enabled && pool) {
    workerPoolInstance = pool;
  } else if (enabled && !workerPoolInstance) {
    workerPoolInstance = getGlobalWorkerPool();
  } else if (!enabled) {
    workerPoolInstance = null;
  }
}

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

export function getActiveWorkerPool(): TagLibWorkerPool | null {
  return useWorkerPool ? workerPoolInstance : null;
}
