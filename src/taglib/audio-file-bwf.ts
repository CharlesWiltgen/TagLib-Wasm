/**
 * @fileoverview BWF (`bext` + iXML) operations, factored out of AudioFileImpl
 * to keep that file under the size limit. Each function takes the raw FileHandle
 * plus the already-resolved format string (for the unsupported-format guard).
 */

import type { FileHandle } from "../wasm.ts";
import type { BroadcastAudioExtension } from "../types/bwf.ts";
import { decodeBext, encodeBext } from "../bwf/bext.ts";
import { UnsupportedFormatError } from "../errors.ts";

const BWF_FORMATS = new Set(["WAV", "FLAC"]);

function requireBwf(format: string): void {
  if (!BWF_FORMATS.has(format)) {
    throw new UnsupportedFormatError(format, ["WAV", "FLAC"], {
      operation: "BWF metadata",
    });
  }
}

export function getBextData(handle: FileHandle): Uint8Array | undefined {
  const raw = handle.getBextData();
  return raw && raw.length > 0 ? raw : undefined;
}

export function setBextData(
  handle: FileHandle,
  format: string,
  data: Uint8Array | null,
): void {
  requireBwf(format);
  handle.setBextData(data);
}

export function getBext(
  handle: FileHandle,
): BroadcastAudioExtension | undefined {
  const raw = handle.getBextData();
  return raw && raw.length > 0 ? decodeBext(raw) : undefined;
}

export function setBext(
  handle: FileHandle,
  format: string,
  bext: BroadcastAudioExtension,
): void {
  requireBwf(format);
  handle.setBextData(encodeBext(bext));
}

export function getIxml(handle: FileHandle): string | undefined {
  return handle.getIxml();
}

export function setIxml(
  handle: FileHandle,
  format: string,
  data: string | null,
): void {
  requireBwf(format);
  handle.setIxml(data);
}
