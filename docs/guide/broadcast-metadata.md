# Broadcast Metadata (BWF `bext` / iXML)

Broadcast Wave Format (BWF) adds production metadata to WAV files via two
chunks: `bext` (the Broadcast Audio Extension, EBU Tech 3285) and `iXML` (an
XML payload used by field recorders, DAWs, and editorial tools). TagLib-Wasm
reads and writes both — for **WAV and FLAC files** — through the Full API.

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("recording.wav");

const bext = file.getBext(); // parsed bext chunk, or undefined
console.log(bext?.description, bext?.timeReferenceSamples, bext?.codingHistory);

console.log(file.getIxml()); // raw iXML string, or undefined

file.setBext({
  ...bext!,
  description: "Scene 4, take 2",
  version: 2,
  loudnessValueDb: -16,
});
file.setIxml("<BWFXML>…</BWFXML>");
file.save();
```

> **Formats:** `getBext` / `setBext` / `getBextData` / `setBextData` / `getIxml`
> / `setIxml` work on WAV and FLAC. On any other format the setters throw
> `UnsupportedFormatError`; the getters return `undefined`.

## The `BroadcastAudioExtension` type

```typescript
interface BroadcastAudioExtension {
  description: string; // free text — ≤ 256 ASCII bytes on write
  originator: string; // producer / device — ≤ 32 bytes
  originatorReference: string; // unambiguous reference — ≤ 32 bytes
  originationDate: string; // "YYYY-MM-DD" (10 bytes)
  originationTime: string; // "HH:MM:SS" (8 bytes)
  timeReferenceSamples: bigint; // samples from midnight to sequence start
  version: number; // 0 | 1 | 2
  umid?: string; // SMPTE UMID, hex string — present when version ≥ 1
  loudnessValueDb?: number; // integrated loudness, LUFS — version ≥ 2
  loudnessRangeDb?: number; // loudness range, LU — version ≥ 2
  maxTruePeakLevelDbtp?: number; // max true peak, dBTP — version ≥ 2
  maxMomentaryLoudnessDb?: number; // max momentary loudness, LUFS — version ≥ 2
  maxShortTermLoudnessDb?: number; // max short-term loudness, LUFS — version ≥ 2
  codingHistory: string; // CR/LF-delimited encoding history, verbatim
}
```

`version` controls which optional fields are meaningful: **0** = none, **1**
adds `umid`, **2** adds the loudness fields. The serialized chunk always writes
the full 602-byte fixed prefix (plus `codingHistory`); unused fields are zeroed,
and `undefined` loudness values are written as the EBU `0x7FFF` "not set"
sentinel.

### `setBext()` normalization

When you call `setBext()`:

- `version` defaults to **2** if any loudness field is set, otherwise **1** if
  `umid` is set, otherwise **0**.
- Over-long string fields are truncated to their fixed widths.
- Loudness values are scaled ×100 and clamped to the `Int16` range.
- `umid` is written only when the effective version is ≥ 1.

Call `save()` afterwards to persist.

## Raw `bext` bytes: `getBextData()` / `setBextData()`

If you need to round-trip a chunk verbatim — for vendor extensions, unusual
layouts, or a chunk too short for `getBext()` to parse — use the raw byte
accessors:

```typescript
const raw = file.getBextData(); // Uint8Array | undefined
file.setBextData(raw); // write raw bytes
file.setBextData(null); // remove the bext chunk
```

## iXML: `getIxml()` / `setIxml()`

iXML is passed through as a string — TagLib-Wasm does not parse or validate it:

```typescript
const xml = file.getIxml(); // string | undefined
file.setIxml("<BWFXML>…</BWFXML>"); // write
file.setIxml(null); // remove the iXML chunk
```

## Standalone codec: `bwf.decodeBext` / `bwf.encodeBext`

The `bext` (de)serializer is also exported as the `bwf` namespace, so you can
work with raw chunk bytes without a file handle (e.g. when reading a chunk from
elsewhere, or writing one into a buffer yourself):

```typescript
import { bwf } from "taglib-wasm";

const parsed = bwf.decodeBext(rawBextBytes); // BroadcastAudioExtension | undefined
const bytes = bwf.encodeBext({
  description: "Field recording",
  originator: "MixPre-6 II",
  originatorReference: "",
  originationDate: "2026-05-12",
  originationTime: "09:14:03",
  timeReferenceSamples: 0n,
  version: 1,
  umid: "060a2b3401010101...",
  codingHistory: "A=PCM,F=48000,W=24,M=stereo,T=MixPre-6 II",
});
```

`decodeBext()` returns `undefined` only if the input is shorter than 348 bytes
(can't even read the `Version` field); shorter-than-full v0/v1 chunks parse into
a partial struct based on the declared version and available length.

## `bext` loudness vs. ReplayGain

The v2 loudness fields (`loudnessValueDb`, `loudnessRangeDb`,
`maxTruePeakLevelDbtp`, …) are **EBU R128-style measurements describing the
recording** — they are not playback-gain instructions. They are independent of
ReplayGain / R128 `*_GAIN` tags and of the Opus `outputGainDb` header value; a
player that honors ReplayGain does not look at `bext` loudness.

## See also

- [API Reference — BWF / Broadcast Metadata Methods](https://charleswiltgen.github.io/TagLib-Wasm/api/#bwf-broadcast-metadata-methods-wav-and-flac-only)
- [Chapters](./chapters.md)
