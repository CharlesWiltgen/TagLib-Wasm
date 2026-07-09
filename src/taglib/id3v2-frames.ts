/**
 * Validation and mapping helpers for the raw ID3v2 frame API (taglib-b67).
 * See docs/superpowers/specs/2026-07-09-raw-id3v2-frames-design.md.
 */

import { MetadataError, UnsupportedFormatError } from "../errors/classes.ts";
import type { RawId3v2Frame } from "../wasm.ts";
import type { Id3v2Frame } from "../constants/complex-properties.ts";

const FRAME_ID_PATTERN = /^[A-Z0-9]{4}$/;

export function assertMp3(format: string): void {
  if (format !== "MP3") {
    throw new UnsupportedFormatError(format, ["MP3"], {
      operation: "id3v2Frames",
    });
  }
}

export function assertFrameId(id: string, operation: "read" | "write"): void {
  if (!FRAME_ID_PATTERN.test(id)) {
    throw new MetadataError(
      operation,
      `Invalid ID3v2 frame ID: "${id}". Frame IDs must match [A-Z0-9]{4}`,
      id,
    );
  }
}

export function assertFrameBodies(id: string, data: Uint8Array[]): void {
  for (const body of data) {
    if (body.length === 0) {
      throw new MetadataError(
        "write",
        "Frame data must not be empty: zero-size ID3v2 frames are invalid",
        id,
      );
    }
  }
}

/** Normalize a handle-level frame for the public API (zero flags → absent). */
export function toPublicFrame(frame: RawId3v2Frame): Id3v2Frame {
  return {
    id: frame.id,
    data: frame.data,
    ...(frame.flags ? { flags: frame.flags } : {}),
  };
}
