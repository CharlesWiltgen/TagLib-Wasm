import type { TagLib } from "../taglib.ts";

let cachedTagLib: TagLib | null = null;
let bufferModeEnabled = false;

export function setBufferMode(enabled: boolean): void {
  bufferModeEnabled = enabled;
  cachedTagLib = null;
}

export async function getTagLib(): Promise<TagLib> {
  if (!cachedTagLib) {
    const { TagLib } = await import("../taglib.ts");
    const initOptions = bufferModeEnabled
      ? { forceBufferMode: true } as const
      : undefined;
    cachedTagLib = await TagLib.initialize(initOptions);
  }
  return cachedTagLib;
}
