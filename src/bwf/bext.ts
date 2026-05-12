/**
 * @fileoverview EBU Tech 3285 BWF `bext` chunk codec. Pure functions — no Wasm
 * or TagLib dependency. The fixed prefix is 602 bytes for all versions; the
 * `version` field selects which optional fields are meaningful (0 = none,
 * 1 = UMID, 2 = UMID + loudness). Fixed-width string fields are NUL-padded
 * ASCII; `codingHistory` is exposed verbatim (the spec uses CR/LF lines) and
 * is not promised to preserve embedded NUL bytes.
 */

import type { BroadcastAudioExtension } from "../types/bwf.ts";

const FIXED_PREFIX_LEN = 602;
const VERSION_OFFSET = 346;
const UMID_OFFSET = 348;
const UMID_LEN = 64;
const LOUDNESS_OFFSET = 412; // five Int16 LE, ×100

function readFixedString(
  bytes: Uint8Array,
  offset: number,
  len: number,
): string {
  let end = offset;
  const max = Math.min(offset + len, bytes.length);
  while (end < max && bytes[end] !== 0) end++;
  let s = "";
  for (let i = offset; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function writeFixedString(
  bytes: Uint8Array,
  offset: number,
  len: number,
  value: string,
): void {
  for (let i = 0; i < len; i++) {
    bytes[offset + i] = i < value.length ? value.charCodeAt(i) & 0xff : 0;
  }
}

function clampInt16(n: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(n)));
}

function loudnessRaw(v: number | undefined): number {
  return v === undefined ? 0 : clampInt16(v * 100);
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function hexToBytes(hex: string, outLen: number): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(outLen);
  for (let i = 0; i + 1 < clean.length + 1 && i / 2 < outLen; i += 2) {
    const pair = clean.slice(i, i + 2);
    if (pair.length === 2) out[i / 2] = parseInt(pair, 16);
  }
  return out;
}

/**
 * Parse a raw `bext` chunk. Returns `undefined` only if `bytes` is shorter than
 * 348 (cannot even read the `Version` field). Optional fields are populated per
 * the chunk's declared version and the available length, so compact/legacy v0
 * chunks parse into a partial struct.
 */
export function decodeBext(
  bytes: Uint8Array,
): BroadcastAudioExtension | undefined {
  if (bytes.length < VERSION_OFFSET + 2) return undefined;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const timeRefLow = dv.getUint32(338, true);
  const timeRefHigh = dv.getUint32(342, true);
  const version = dv.getUint16(VERSION_OFFSET, true);
  const result: BroadcastAudioExtension = {
    description: readFixedString(bytes, 0, 256),
    originator: readFixedString(bytes, 256, 32),
    originatorReference: readFixedString(bytes, 288, 32),
    originationDate: readFixedString(bytes, 320, 10),
    originationTime: readFixedString(bytes, 330, 8),
    timeReferenceSamples: (BigInt(timeRefHigh) << 32n) | BigInt(timeRefLow),
    version,
    codingHistory: bytes.length > FIXED_PREFIX_LEN
      ? readFixedString(
        bytes,
        FIXED_PREFIX_LEN,
        bytes.length - FIXED_PREFIX_LEN,
      )
      : "",
  };
  if (version >= 1 && bytes.length >= UMID_OFFSET + UMID_LEN) {
    result.umid = bytesToHex(
      bytes.subarray(UMID_OFFSET, UMID_OFFSET + UMID_LEN),
    );
  }
  if (version >= 2 && bytes.length >= LOUDNESS_OFFSET + 10) {
    result.loudnessValueDb = dv.getInt16(LOUDNESS_OFFSET, true) / 100;
    result.loudnessRangeDb = dv.getInt16(LOUDNESS_OFFSET + 2, true) / 100;
    result.maxTruePeakLevelDbtp = dv.getInt16(LOUDNESS_OFFSET + 4, true) / 100;
    result.maxMomentaryLoudnessDb = dv.getInt16(LOUDNESS_OFFSET + 6, true) /
      100;
    result.maxShortTermLoudnessDb = dv.getInt16(LOUDNESS_OFFSET + 8, true) /
      100;
  }
  return result;
}

/**
 * Serialize a `bext` chunk. The result is always `602 + codingHistory.length`
 * bytes. `version` defaults to 2 when any loudness field is present (else 1 if
 * `umid` is set, else 0). Over-long string fields are truncated to their widths;
 * loudness values are clamped to the Int16 range after ×100; UMID is written
 * only for version ≥ 1.
 */
export function encodeBext(b: BroadcastAudioExtension): Uint8Array {
  const codingHistory = b.codingHistory ?? "";
  const bytes = new Uint8Array(FIXED_PREFIX_LEN + codingHistory.length);
  const dv = new DataView(bytes.buffer);
  const hasLoudness = b.loudnessValueDb !== undefined ||
    b.loudnessRangeDb !== undefined || b.maxTruePeakLevelDbtp !== undefined ||
    b.maxMomentaryLoudnessDb !== undefined ||
    b.maxShortTermLoudnessDb !== undefined;
  const version = Number.isInteger(b.version)
    ? (b.version as number)
    : (hasLoudness ? 2 : (b.umid ? 1 : 0));
  writeFixedString(bytes, 0, 256, b.description ?? "");
  writeFixedString(bytes, 256, 32, b.originator ?? "");
  writeFixedString(bytes, 288, 32, b.originatorReference ?? "");
  writeFixedString(bytes, 320, 10, b.originationDate ?? "");
  writeFixedString(bytes, 330, 8, b.originationTime ?? "");
  const tr = b.timeReferenceSamples ?? 0n;
  dv.setUint32(338, Number(tr & 0xffffffffn), true);
  dv.setUint32(342, Number((tr >> 32n) & 0xffffffffn), true);
  dv.setUint16(VERSION_OFFSET, version, true);
  if (version >= 1 && b.umid) {
    bytes.set(hexToBytes(b.umid, UMID_LEN), UMID_OFFSET);
  }
  if (version >= 2) {
    dv.setInt16(LOUDNESS_OFFSET, loudnessRaw(b.loudnessValueDb), true);
    dv.setInt16(LOUDNESS_OFFSET + 2, loudnessRaw(b.loudnessRangeDb), true);
    dv.setInt16(LOUDNESS_OFFSET + 4, loudnessRaw(b.maxTruePeakLevelDbtp), true);
    dv.setInt16(
      LOUDNESS_OFFSET + 6,
      loudnessRaw(b.maxMomentaryLoudnessDb),
      true,
    );
    dv.setInt16(
      LOUDNESS_OFFSET + 8,
      loudnessRaw(b.maxShortTermLoudnessDb),
      true,
    );
  }
  writeFixedString(
    bytes,
    FIXED_PREFIX_LEN,
    codingHistory.length,
    codingHistory,
  );
  return bytes;
}
