# Cross-Backend Parity Coverage

taglib-wasm ships **two Wasm backends** with fundamentally different state
models — **Emscripten** (Embind, stateful imperative method calls on a C++
`FileHandle`) and **WASI** (declarative MessagePack snapshots). Any feature can
drift between them in subtle ways, and such drift is only caught by tests that
exercise BOTH backends through the same scenario (e.g. `taglib-y91`,
`taglib-nc5`, the `bitrateMode`-in-`properties()` leak).

This table inventories per-method backend coverage for the public `AudioFile`
surface (`src/taglib/audio-file-interface.ts`). It is a point-in-time audit
(`taglib-7ek`); update it when you add a method or a parity test.

## Convention (MANDATORY)

**Any `AudioFile` feature with format-specific or backend-specific behavior MUST
have at least one parity test** that runs the same scenario on both backends.
The default Deno backend is WASI, so a test without `forceWasmType` exercises
WASI only — that is NOT parity coverage. Acceptable patterns:
`for (const backend of ["wasi", "emscripten"])` with
`TagLib.initialize({ forceWasmType: backend })`; `forEachBackend()` /
`BackendAdapter` (`tests/backend-adapter.ts`); or paired `[${backend}]` cases.
Prefer one seed-then-assert scenario looped over both backends (so it can fail
on a real divergence) over separate per-backend tests.

## Legend

- **✓** — exercised on this backend through the public `AudioFile` API.
- **unit** — exercised only at the `WasiFileHandle` adapter level
  (`wasi-adapter-unit.test.ts` / `wasi-host.test.ts`), not via `AudioFile`.
- **error** — exercised only on an error path (e.g. throws on wrong format),
  not a functional round-trip.
- **✗** — not exercised.
- **Paired** — a single test runs the SAME scenario on both backends (the
  strongest form: a `for (const backend of ["wasi","emscripten"])` loop,
  `forEachBackend`, the `BackendAdapter` layer, or paired `[backend]` cases).

## Coverage matrix

| Method              | WASI | Emscripten | Paired | Where                                                                            |
| ------------------- | :--: | :--------: | :----: | -------------------------------------------------------------------------------- |
| `getFormat`         |  ✓   |     ✓      |   ✓    | format-detection, id3-format-detection (`forEachBackend`)                        |
| `isFormat`          |  ✓   |     ✓      |   ✓    | format-narrowing `[wasi]`/`[emscripten]`                                         |
| `isValid`           |  ✓   |     ✓      |   —    | wasi-host (wasi) + taglib.test (emscripten); unpaired                            |
| `isMP4`             | unit |     ✗      |   —    | wasi-adapter-unit only                                                           |
| `properties`        |  ✓   |     ✓      |   ✓    | cross-backend-parity, tag-roundtrip-property, property-raw-values (qpl)          |
| `getProperty`       |  ✓   |     ✓      |   ✓    | format-narrowing (typed); remap fallback for MP4 atom keys (bnhl)                |
| `setProperty`       |  ✓   |     ✓      |   ✓    | wasi-adapter-unit + extended-metadata                                            |
| `setProperties`     |  ✓   |     ✓      |   ✓    | audio-file-save (REPLACE vs MERGE); property-raw-values (qpl); mp4 casing (bnhl) |
| `audioProperties`   |  ✓   |     ✓      |   ✓    | audio-properties (`forEachBackend`)                                              |
| `tag()` read        |  ✓   |     ✓      |   ✓    | basic-tags (`forEachBackend`)                                                    |
| `tag()` write       |  ✓   |     ✓      |   ✓    | basic-tags, BackendAdapter.writeTags; setTrack keeps the total (eq3)             |
| `save`              |  ✓   |     ✓      |   ✓    | audio-file-save, all `forEachBackend` suites                                     |
| `getFileBuffer`     |  ✓   |     ✓      |   ✓    | audio-file-save loops both; 0sv read-failure throws (WASI) vs in-memory (EM)     |
| `saveToFile`        |  ✓   |     ✓      |   —    | backend-specific paths: EM full-load (0iq) + EM partial + WASI save-as           |
| `getPictures`       |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                                   |
| `setPictures`       |  ✓   |     ✓      |   ✓    | picture-api 1dr loops both (replace round-trip)                                  |
| `addPicture`        |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                                   |
| `removePictures`    |  ✓   |     ✓      |   ✓    | audio-file-save nc5 (clearTags) loops both                                       |
| `getRatings`        |  ✓   |     ✓      |   ✓    | nc5 + cross-backend-parity readRatingCount                                       |
| `setRatings`        |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                                   |
| `getRating`         |  ✓   |     ✓      |   ✓    | rating-api 86z loops both                                                        |
| `setRating`         |  ✓   |     ✓      |   ✓    | rating-api 86z loops both                                                        |
| `getLyrics`         |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                                       |
| `setLyrics`         |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                                       |
| `getChapters`       |  ✓   |     ✓      |   ✓    | chapters loops both                                                              |
| `setChapters`       |  ✓   |     ✓      |   ✓    | chapters loops both                                                              |
| `getBext`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                   |
| `setBext`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                   |
| `getBextData`       |  ✓   |     ✓      |   ✓    | bwf loops both                                                                   |
| `setBextData`       |  ✓   |     ✓      |   ✓    | bwf loops both                                                                   |
| `getIxml`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                   |
| `setIxml`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                   |
| `getMP4Item`        |  ✓   |     ✓      |   ✓    | mp4-items loops both: freeform, standard + int-pair atoms (uj2b)                 |
| `setMP4Item`        |  ✓   |     ✓      |   ✓    | mp4-items: arbitrary names on file bytes (bnhl); item types (uj2b)               |
| `removeMP4Item`     |  ✓   |     ✓      |   ✓    | mp4-items loops both: freeform + standard atoms (0piv)                           |
| `hasId3Tags`        |  ✓   |     ✓      |   ✓    | strip-id3-flac loops both                                                        |
| `stripId3Tags`      |  ✓   |     ✓      |   ✓    | strip-id3-flac loops both                                                        |
| `dispose`           |  ✓   |     ✓      |   ✓    | ubiquitous (try/finally)                                                         |
| `getId3v2Frames`    |  ✓   |     ✓      |   ✓    | id3v2-frames.test.ts seed-then-assert loop                                       |
| `setId3v2Frames`    |  ✓   |     ✓      |   ✓    | id3v2-frames.test.ts byte-identity round-trips                                   |
| `removeId3v2Frames` |  ✓   |     ✓      |   ✓    | id3v2-frames.test.ts per-ID removal                                              |
| `[Symbol.dispose]`  |  ✓   |     ✓      |   ✓    | strip-id3-flac (`using`)                                                         |

## Parity gaps (filed as sub-issues of taglib-7ek)

1. ~~**MP4 items — no functional round-trip on EITHER backend.**~~ **RESOLVED
   (taglib-1qn).** WASI dropped freeform `----:com.apple.iTunes:*` items on save
   (it routed them through the PropertyMap under the full atom key, which TagLib
   does not recognize). WASI now normalizes the iTunes atom key to the bare,
   uppercased NAME that TagLib's MP4 PropertyMap uses, so freeform items
   (including the Apple Sound Check `iTunNORM` atom) round-trip on both backends.
   Covered by `tests/mp4-items.test.ts` (loops both backends).
2. ~~**`setPictures` cross-backend parity.**~~ **RESOLVED (taglib-1dr).** No bug
   — the public `AudioFile.setPictures` replace + save round-trips on both
   backends. Covered by `picture-api.test.ts` (loops both backends).
3. ~~**`saveToFile` Emscripten full-load path.**~~ **RESOLVED (taglib-0iq).** No
   bug — the Emscripten full-load `saveToFile(target)` path now has a dedicated
   test in `audio-file-save.test.ts`. (Paths remain backend-specific by design:
   EM full-load, EM partial reconstruct, WASI path-mode save-as.)
4. ~~**`getRating`/`setRating` (singular) on WASI.**~~ **RESOLVED (taglib-86z).**
   No bug — `setRating`→`getRating` round-trips to the identical value on both
   backends. Covered by `rating-api.test.ts` (loops both backends).

Minor/unpaired (tracked here, not filed): `isValid` (covered both, unpaired);
`isMP4` (WASI unit only); `getProperty` string-overload (single-backend each).

## Resolved divergence: the int-pair split (MP3/MP4)

`properties()` used to present a `TRACKNUMBER` of `"3/12"` differently per
backend — WASI split it into `trackNumber` + `totalTracks` for MPEG/MP4, while
Emscripten reported the raw string. It was lossless but real, and once the raw
string became a public typed field it meant the same input produced different
FILES depending on which backend loaded it (`taglib-febo`).

Resolved by making the raw string canonical everywhere (`taglib-asg`): the C shim
no longer transforms the PropertyMap in either direction, so both backends defer
to TagLib and agree by construction rather than by two transformations being kept
in sync. Narrowing a pair into number + total now happens only on the TYPED
surface (`mapPropertiesToExtendedTag`), where it is additive and cannot destroy
the raw value — so `readTags().totalTracks` still answers 12 for a `"3/12"`, and
`normalizeTagInput` suppresses the derived total on write so a round-trip cannot
store it twice.

Pinned by `property-raw-values.test.ts` ("reports 3/12 raw and identically on
both backends").
