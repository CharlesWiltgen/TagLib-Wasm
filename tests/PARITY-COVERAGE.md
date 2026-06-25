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

| Method             | WASI | Emscripten | Paired | Where                                                         |
| ------------------ | :--: | :--------: | :----: | ------------------------------------------------------------- |
| `getFormat`        |  ✓   |     ✓      |   ✓    | format-detection, id3-format-detection (`forEachBackend`)     |
| `isFormat`         |  ✓   |     ✓      |   ✓    | format-narrowing `[wasi]`/`[emscripten]`                      |
| `isValid`          |  ✓   |     ✓      |   —    | wasi-host (wasi) + taglib.test (emscripten); unpaired         |
| `isMP4`            | unit |     ✗      |   —    | wasi-adapter-unit only                                        |
| `properties`       |  ✓   |     ✓      |   ✓    | cross-backend-parity, tag-roundtrip-property                  |
| `getProperty`      |  ✓   |     ✓      |   ✓    | format-narrowing (typed); string-overload single-backend each |
| `setProperty`      |  ✓   |     ✓      |   ✓    | wasi-adapter-unit + extended-metadata                         |
| `setProperties`    |  ✓   |     ✓      |   ✓    | audio-file-save loops both (REPLACE vs MERGE semantics)       |
| `audioProperties`  |  ✓   |     ✓      |   ✓    | audio-properties (`forEachBackend`)                           |
| `tag()` read       |  ✓   |     ✓      |   ✓    | basic-tags (`forEachBackend`)                                 |
| `tag()` write      |  ✓   |     ✓      |   ✓    | basic-tags, BackendAdapter.writeTags                          |
| `save`             |  ✓   |     ✓      |   ✓    | audio-file-save, all `forEachBackend` suites                  |
| `getFileBuffer`    |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                    |
| `saveToFile`       |  ✓   |     ✓      |   —    | each backend tests a DIFFERENT path (see Gaps)                |
| `getPictures`      |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                |
| `setPictures`      | unit |     ✓      |   —    | emscripten public (picture-api); WASI handle-level only       |
| `addPicture`       |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                |
| `removePictures`   |  ✓   |     ✓      |   ✓    | audio-file-save nc5 (clearTags) loops both                    |
| `getRatings`       |  ✓   |     ✓      |   ✓    | nc5 + cross-backend-parity readRatingCount                    |
| `setRatings`       |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                |
| `getRating`        |  ✗   |     ✓      |   —    | rating-api (emscripten only)                                  |
| `setRating`        |  ✗   |     ✓      |   —    | rating-api (emscripten only)                                  |
| `getLyrics`        |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                    |
| `setLyrics`        |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                    |
| `getChapters`      |  ✓   |     ✓      |   ✓    | chapters loops both                                           |
| `setChapters`      |  ✓   |     ✓      |   ✓    | chapters loops both                                           |
| `getBext`          |  ✓   |     ✓      |   ✓    | bwf loops both                                                |
| `setBext`          |  ✓   |     ✓      |   ✓    | bwf loops both                                                |
| `getBextData`      |  ✓   |     ✓      |   ✓    | bwf loops both                                                |
| `setBextData`      |  ✓   |     ✓      |   ✓    | bwf loops both                                                |
| `getIxml`          |  ✓   |     ✓      |   ✓    | bwf loops both                                                |
| `setIxml`          |  ✓   |     ✓      |   ✓    | bwf loops both                                                |
| `getMP4Item`       | unit |   error    |   —    | wasi-adapter-unit + error-handling; no round-trip             |
| `setMP4Item`       | unit |   error    |   —    | wasi-adapter-unit + error-handling; no round-trip             |
| `removeMP4Item`    | unit |     ✗      |   —    | wasi-adapter-unit only                                        |
| `hasId3Tags`       |  ✓   |     ✓      |   ✓    | strip-id3-flac loops both                                     |
| `stripId3Tags`     |  ✓   |     ✓      |   ✓    | strip-id3-flac loops both                                     |
| `dispose`          |  ✓   |     ✓      |   ✓    | ubiquitous (try/finally)                                      |
| `[Symbol.dispose]` |  ✓   |     ✓      |   ✓    | strip-id3-flac (`using`)                                      |

## Parity gaps (filed as sub-issues of taglib-7ek)

1. **MP4 items — no functional round-trip on EITHER backend.**
   `getMP4Item`/`setMP4Item`/`removeMP4Item` are only exercised at the
   `WasiFileHandle` unit level (WASI) and on an error path (Emscripten). No test
   opens a real M4A through the public API, sets an item, saves, reopens, and
   verifies it — on either backend. Highest risk (the Apple Sound Check /
   `iTunNORM` path rides MP4 items). → **taglib-1qn**
2. **`setPictures` cross-backend parity.** Emscripten is covered via the public
   API (picture-api); WASI only at the handle level (wasi-host). No paired test
   sets pictures via `AudioFile` on WASI and verifies a round-trip. → **taglib-1dr**
3. **`saveToFile` Emscripten full-load path.** Emscripten is tested only via the
   partial-load reconstruct; the plain full-load `saveToFile` (buffer → write
   target) has no dedicated test. WASI tests the path-mode "save as" path. The
   two backends test DIFFERENT paths, so neither path is cross-checked. → **taglib-0iq**
4. **`getRating`/`setRating` (singular) on WASI.** Emscripten-only (rating-api).
   Thin wrappers over `getRatings`/`setRatings` (which ARE paired), so low risk,
   but still one-backend-only. → **taglib-86z**

Minor/unpaired (tracked here, not filed): `isValid` (covered both, unpaired);
`isMP4` (WASI unit only); `getProperty` string-overload (single-backend each).
