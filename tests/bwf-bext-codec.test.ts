/// <reference lib="deno.ns" />

/**
 * @fileoverview Pure-TS unit + property tests for the EBU 3285 `bext` codec.
 */

import { assertEquals } from "@std/assert";
import fc from "fast-check";
import { decodeBext, encodeBext } from "../src/bwf/bext.ts";
import type { BroadcastAudioExtension } from "../src/types/bwf.ts";

/** Build a known v2 bext chunk by hand for offset-level assertions. */
function buildV2Chunk(codingHistory = "A=PCM,F=48000\r\n"): Uint8Array {
  const enc = new TextEncoder();
  const bytes = new Uint8Array(602 + enc.encode(codingHistory).length);
  const dv = new DataView(bytes.buffer);
  const putStr = (off: number, len: number, s: string) => {
    const b = enc.encode(s);
    for (let i = 0; i < len; i++) bytes[off + i] = i < b.length ? b[i] : 0;
  };
  putStr(0, 256, "Take 1");
  putStr(256, 32, "Recorder X");
  putStr(288, 32, "REF-001");
  putStr(320, 10, "2026-05-12");
  putStr(330, 8, "13:45:00");
  dv.setUint32(338, 48000, true); // TimeReferenceLow
  dv.setUint32(342, 0, true); // TimeReferenceHigh
  dv.setUint16(346, 2, true); // Version
  bytes[348] = 0x06; // first 2 bytes of UMID, rest zero
  bytes[349] = 0x0a;
  dv.setInt16(412, 1234, true); // LoudnessValue ×100 => 12.34
  dv.setInt16(414, 567, true); // LoudnessRange => 5.67
  dv.setInt16(416, -89, true); // MaxTruePeakLevel => -0.89
  dv.setInt16(418, 234, true); // MaxMomentaryLoudness => 2.34
  dv.setInt16(420, 345, true); // MaxShortTermLoudness => 3.45
  bytes.set(enc.encode(codingHistory), 602);
  return bytes;
}

Deno.test("decodeBext: parses a v2 chunk field-by-field", () => {
  assertEquals(decodeBext(buildV2Chunk()), {
    description: "Take 1",
    originator: "Recorder X",
    originatorReference: "REF-001",
    originationDate: "2026-05-12",
    originationTime: "13:45:00",
    timeReferenceSamples: 48000n,
    version: 2,
    umid: "060a" + "0".repeat(124),
    loudnessValueDb: 12.34,
    loudnessRangeDb: 5.67,
    maxTruePeakLevelDbtp: -0.89,
    maxMomentaryLoudnessDb: 2.34,
    maxShortTermLoudnessDb: 3.45,
    codingHistory: "A=PCM,F=48000\r\n",
  });
});

Deno.test("decodeBext: a v0 chunk has no umid/loudness", () => {
  const chunk = buildV2Chunk("");
  new DataView(chunk.buffer).setUint16(346, 0, true);
  const b = decodeBext(chunk)!;
  assertEquals(b.version, 0);
  assertEquals(b.umid, undefined);
  assertEquals(b.loudnessValueDb, undefined);
});

Deno.test("decodeBext: a v1 chunk has umid but no loudness", () => {
  const chunk = buildV2Chunk("");
  new DataView(chunk.buffer).setUint16(346, 1, true);
  const b = decodeBext(chunk)!;
  assertEquals(b.version, 1);
  assertEquals(b.umid, "060a" + "0".repeat(124));
  assertEquals(b.loudnessValueDb, undefined);
});

Deno.test("decodeBext: returns undefined for a chunk shorter than 348 bytes", () => {
  assertEquals(decodeBext(new Uint8Array(347)), undefined);
});

Deno.test("decodeBext: tolerates a missing CodingHistory", () => {
  assertEquals(decodeBext(buildV2Chunk(""))!.codingHistory, "");
});

Deno.test("encodeBext: round-trips a v2 struct unchanged", () => {
  const original: BroadcastAudioExtension = {
    description: "Take 1",
    originator: "Recorder X",
    originatorReference: "REF-001",
    originationDate: "2026-05-12",
    originationTime: "13:45:00",
    timeReferenceSamples: 1n << 40n,
    version: 2,
    umid: "060a" + "0".repeat(124),
    loudnessValueDb: 12.34,
    loudnessRangeDb: 5.67,
    maxTruePeakLevelDbtp: -0.89,
    maxMomentaryLoudnessDb: 2.34,
    maxShortTermLoudnessDb: 3.45,
    codingHistory: "A=PCM,F=48000\r\nA=ANALOGUE,M=stereo\r\n",
  };
  assertEquals(decodeBext(encodeBext(original)), original);
});

Deno.test("encodeBext: buffer is always 602 + codingHistory bytes", () => {
  const base = {
    description: "",
    originator: "",
    originatorReference: "",
    originationDate: "",
    originationTime: "",
    timeReferenceSamples: 0n,
    umid: "00".repeat(64),
    codingHistory: "",
  };
  assertEquals(encodeBext({ ...base, version: 0 }).length, 602);
  assertEquals(encodeBext({ ...base, version: 2 }).length, 602);
  assertEquals(
    encodeBext({ ...base, version: 2, codingHistory: "x".repeat(7) }).length,
    609,
  );
});

Deno.test("encodeBext: truncates over-long string fields to their widths", () => {
  const b = decodeBext(encodeBext({
    description: "z".repeat(400),
    originator: "",
    originatorReference: "",
    originationDate: "",
    originationTime: "",
    timeReferenceSamples: 0n,
    version: 0,
    codingHistory: "",
  }))!;
  assertEquals(b.description.length, 256);
});

Deno.test("encodeBext: loudness clamps at the Int16 edges; 0x7FFF is the not-set sentinel", () => {
  const b = decodeBext(encodeBext({
    description: "",
    originator: "",
    originatorReference: "",
    originationDate: "",
    originationTime: "",
    timeReferenceSamples: 0n,
    version: 2,
    codingHistory: "",
    loudnessValueDb: 327.66, // largest representable real value (one below the sentinel)
    loudnessRangeDb: -9999, // clamps to -327.68
    maxTruePeakLevelDbtp: 9999, // clamps up to 0x7FFF == "not set" => decodes as undefined
    // maxMomentaryLoudnessDb / maxShortTermLoudnessDb omitted => written as 0x7FFF => undefined
  }))!;
  assertEquals(b.loudnessValueDb, 327.66);
  assertEquals(b.loudnessRangeDb, -327.68);
  assertEquals(b.maxTruePeakLevelDbtp, undefined);
  assertEquals(b.maxMomentaryLoudnessDb, undefined);
  assertEquals(b.maxShortTermLoudnessDb, undefined);
});

Deno.test("bext: a v2 chunk with no loudness fields decodes them all as undefined", () => {
  const b = decodeBext(encodeBext({
    description: "x",
    originator: "",
    originatorReference: "",
    originationDate: "",
    originationTime: "",
    timeReferenceSamples: 0n,
    version: 2,
    umid: "00".repeat(64),
    codingHistory: "",
  }))!;
  assertEquals(b.version, 2);
  assertEquals(b.loudnessValueDb, undefined);
  assertEquals(b.loudnessRangeDb, undefined);
  assertEquals(b.maxTruePeakLevelDbtp, undefined);
  assertEquals(b.maxMomentaryLoudnessDb, undefined);
  assertEquals(b.maxShortTermLoudnessDb, undefined);
});

Deno.test("encodeBext: version defaults to 2 when loudness fields are present", () => {
  const b = decodeBext(encodeBext({
    description: "",
    originator: "",
    originatorReference: "",
    originationDate: "",
    originationTime: "",
    timeReferenceSamples: 0n,
    version: NaN as unknown as number,
    codingHistory: "",
    loudnessValueDb: 1,
  }))!;
  assertEquals(b.version, 2);
});

function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? `${v}n` : v;
}

Deno.test("property: decodeBext(encodeBext(b)) === b for arbitrary valid structs", () => {
  const ascii = (max: number) =>
    fc.string({ maxLength: max }).map((s) =>
      s.replace(/[^\x20-\x7e]/g, "").slice(0, max)
    );
  // Exclude 0x7FFF (32767) — that's the EBU "not set" sentinel, which round-trips
  // to `undefined`, not to a numeric value (covered by dedicated tests above).
  const cents = fc.integer({ min: -32768, max: 32766 }).map((n) => n / 100);
  fc.assert(
    fc.property(
      fc.record({
        description: ascii(256),
        originator: ascii(32),
        originatorReference: ascii(32),
        originationDate: ascii(10),
        originationTime: ascii(8),
        timeReferenceSamples: fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }),
        version: fc.constantFrom(0, 1, 2),
        umid: fc.uint8Array({ minLength: 64, maxLength: 64 }).map((u) =>
          [...u].map((x) => x.toString(16).padStart(2, "0")).join("")
        ),
        loudnessValueDb: cents,
        loudnessRangeDb: cents,
        maxTruePeakLevelDbtp: cents,
        maxMomentaryLoudnessDb: cents,
        maxShortTermLoudnessDb: cents,
        codingHistory: ascii(120).map((s) => s.replace(/\0/g, "")),
      }),
      (raw) => {
        const expected: BroadcastAudioExtension = {
          description: raw.description,
          originator: raw.originator,
          originatorReference: raw.originatorReference,
          originationDate: raw.originationDate,
          originationTime: raw.originationTime,
          timeReferenceSamples: raw.timeReferenceSamples,
          version: raw.version,
          codingHistory: raw.codingHistory,
        };
        if (raw.version >= 1) expected.umid = raw.umid;
        if (raw.version >= 2) {
          expected.loudnessValueDb = raw.loudnessValueDb;
          expected.loudnessRangeDb = raw.loudnessRangeDb;
          expected.maxTruePeakLevelDbtp = raw.maxTruePeakLevelDbtp;
          expected.maxMomentaryLoudnessDb = raw.maxMomentaryLoudnessDb;
          expected.maxShortTermLoudnessDb = raw.maxShortTermLoudnessDb;
        }
        const got = decodeBext(encodeBext(raw as BroadcastAudioExtension))!;
        return JSON.stringify(got, bigintReplacer) ===
          JSON.stringify(expected, bigintReplacer);
      },
    ),
    { numRuns: 200 }, // codec correctness is the crux of this feature
  );
});
