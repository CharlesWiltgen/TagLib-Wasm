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

| Method              | WASI | Emscripten | Paired | Where                                                                                                           |
| ------------------- | :--: | :--------: | :----: | --------------------------------------------------------------------------------------------------------------- |
| `getFormat`         |  ✓   |     ✓      |   ✓    | format-detection, id3-format-detection (`forEachBackend`)                                                       |
| `isFormat`          |  ✓   |     ✓      |   ✓    | format-narrowing `[wasi]`/`[emscripten]`                                                                        |
| `isValid`           |  ✓   |     ✓      |   —    | wasi-host (wasi) + taglib.test (emscripten); unpaired                                                           |
| `isMP4`             | unit |     ✗      |   —    | wasi-adapter-unit only                                                                                          |
| `properties`        |  ✓   |     ✓      |   ✓    | cross-backend-parity, tag-roundtrip-property, property-raw-values (qpl, yc1x)                                   |
| `getProperty`       |  ✓   |     ✓      |   ✓    | format-narrowing (typed); remap fallback for MP4 atom keys (bnhl)                                               |
| `setProperty`       |  ✓   |     ✓      |   ✓    | wasi-adapter-unit + extended-metadata                                                                           |
| `removeProperty`    |  ✓   |     ✓      |   ✓    | property-raw-values (qyw2; empty-string clearing contract, buffer mode)                                         |
| `setProperties`     |  ✓   |     ✓      |   ✓    | audio-file-save (REPLACE vs MERGE); property-raw-values (qpl); mp4 casing (bnhl)                                |
| `audioProperties`   |  ✓   |     ✓      |   ✓    | audio-properties (`forEachBackend`)                                                                             |
| `tag()` read        |  ✓   |     ✓      |   ✓    | basic-tags (`forEachBackend`)                                                                                   |
| `tag()` write       |  ✓   |     ✓      |   ✓    | basic-tags, BackendAdapter.writeTags; setTrack keeps the total (eq3)                                            |
| `save`              |  ✓   |     ✓      |   ✓    | audio-file-save, all `forEachBackend` suites; MPEG ID3v1 sync must not delete a TRCK/TDRC narrowing to 0 (9m0w) |
| `getFileBuffer`     |  ✓   |     ✓      |   ✓    | audio-file-save loops both; 0sv read-failure throws (WASI) vs in-memory (EM)                                    |
| `saveToFile`        |  ✓   |     ✓      |   —    | backend-specific paths: EM full-load (0iq) + EM partial + WASI save-as                                          |
| `getPictures`       |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both; MP4 covr→FrontCover (cvr, WASI boundary maps missing pictureType for MP4)       |
| `setPictures`       |  ✓   |     ✓      |   ✓    | picture-api 1dr loops both (replace round-trip)                                                                 |
| `addPicture`        |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                                                                  |
| `removePictures`    |  ✓   |     ✓      |   ✓    | audio-file-save nc5 (clearTags) loops both                                                                      |
| `getRatings`        |  ✓   |     ✓      |   ✓    | nc5 + cross-backend-parity readRatingCount                                                                      |
| `setRatings`        |  ✓   |     ✓      |   ✓    | audio-file-save nc5 loops both                                                                                  |
| `getRating`         |  ✓   |     ✓      |   ✓    | rating-api 86z loops both                                                                                       |
| `setRating`         |  ✓   |     ✓      |   ✓    | rating-api 86z loops both                                                                                       |
| `getLyrics`         |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                                                                      |
| `setLyrics`         |  ✓   |     ✓      |   ✓    | audio-file-save loops both                                                                                      |
| `getChapters`       |  ✓   |     ✓      |   ✓    | chapters loops both                                                                                             |
| `setChapters`       |  ✓   |     ✓      |   ✓    | chapters loops both                                                                                             |
| `getBext`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                                                  |
| `setBext`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                                                  |
| `getBextData`       |  ✓   |     ✓      |   ✓    | bwf loops both                                                                                                  |
| `setBextData`       |  ✓   |     ✓      |   ✓    | bwf loops both                                                                                                  |
| `getIxml`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                                                  |
| `setIxml`           |  ✓   |     ✓      |   ✓    | bwf loops both                                                                                                  |
| `getMP4Item`        |  ✓   |     ✓      |   ✓    | mp4-items loops both: freeform, standard + int-pair atoms (uj2b); foreign-mean round-trip (5ibr)                |
| `setMP4Item`        |  ✓   |     ✓      |   ✓    | mp4-items: arbitrary names on file bytes (bnhl); item types (uj2b)                                              |
| `removeMP4Item`     |  ✓   |     ✓      |   ✓    | mp4-items loops both: freeform + standard atoms (0piv)                                                          |
| `hasId3Tags`        |  ✓   |     ✓      |   ✓    | strip-id3-flac loops both                                                                                       |
| `stripId3Tags`      |  ✓   |     ✓      |   ✓    | strip-id3-flac loops both                                                                                       |
| `dispose`           |  ✓   |     ✓      |   ✓    | ubiquitous (try/finally)                                                                                        |
| `getId3v2Frames`    |  ✓   |     ✓      |   ✓    | id3v2-frames.test.ts seed-then-assert loop                                                                      |
| `setId3v2Frames`    |  ✓   |     ✓      |   ✓    | id3v2-frames.test.ts byte-identity round-trips                                                                  |
| `removeId3v2Frames` |  ✓   |     ✓      |   ✓    | id3v2-frames.test.ts per-ID removal                                                                             |
| `[Symbol.dispose]`  |  ✓   |     ✓      |   ✓    | strip-id3-flac (`using`)                                                                                        |

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

5. ~~**ID3v1-only track/year is not promoted into ID3v2 on WASI.**~~ **RESOLVED
   (taglib-nft5).** The framing was wrong twice over. WASI was not failing to
   promote, it was ERASING: its declarative save routes the snapshot through
   `MPEG::File::setProperties()`, which rewrites the ID3v1 tag too
   (`mpegfile.cpp:191-192`), and the generic `Tag::setProperties()` zeroes every
   field the map omits. And the map only ever described ID3v2 —
   `TagUnion::properties()` returns the first non-empty tag's map without merging
   — so an ID3v1-only value was destroyed by a save that never meant to touch it
   (measured: track 5 → 0).

   The first fix preserved those fields down in C++, and code review showed that
   unsound: it made a deliberate clear **inexpressible**, because `clearTags()`
   builds its map from `properties()` and so could never name the field, and the
   value returned as a ghost in ID3v2. The read now merges ID3v1-only values
   instead (`merge_id3v1_only_properties`), which settles both directions and let
   the write-side preservation be deleted rather than special-cased further.
   Every C++ site that round-trips the map needs the merge — `getProperties`,
   `getProperty` and `setProperty`, not just the snapshot encoder.

6. ~~**An empty-valued property is invisible on WASI and destroyed on save.**~~
   **RESOLVED (taglib-yc1x).** A frame that exists holding an empty string is a
   different state from no frame at all. WASI collapsed both into `undefined`,
   so the value never reached the snapshot, `setProperties()` saw the field as
   absent, and TagLib deleted a frame the caller never touched — on any save,
   including one that changed nothing. Emscripten reported `[""]` and was
   unaffected. It generalised past the numeric `TCON` in the original report to
   ANY frame whose PropertyMap projection is empty; measured on the reference
   library, the keys that actually occur are `barcode` / `label` /
   `replayGainTrackGain`.

   Two attempts before this one tried to resolve it by inferring the CALLER's
   intent (is this `""` a delete or an empty value?), which is unresolvable —
   both arrive as identical bytes in the same argument, and the documented
   `readTags()` → `applyTags()` flow turns one into the other. The fix compares
   against the FILE instead: an empty value equal to what the file already held
   is a round-trip echo, not an instruction, so the typed mirror is skipped.
   That question is answerable, and only in `apply_propmap`, which holds both
   the incoming map and the open file.

   Writing an empty value _on purpose_, distinct from delete, remains
   unsupported: it needs a delete sentinel that is not `""` (`null`, or a
   dedicated remove API) applied to all ~25 string fields at once, because a
   a caller's `""` and a `""` read back from a file are identical bytes in the
   same argument. One consequence is already visible: writing `""` to a field
   whose stored value _already_ projects to empty is a no-op rather than a
   delete, on both backends. Use `setProperties({ key: [] })`, `clearTags()` or
   `removeId3v2Frames()` there.

7. ~~**MP4 covr reads back as `"Other"` on WASI.**~~ **RESOLVED (taglib-cvr).**
   An MP4 covr atom has no per-atom picture type; TagLib's
   `MP4::Tag::complexProperties("PICTURE")` emits only `data` + `mimeType`, no
   `pictureType` key. The WASI encoder defaulted the missing key to 0
   ("Other"), so every m4a picture read back as Other regardless of what was
   written, while Emscripten hardcoded type 3 ("FrontCover for MP4"). The
   encoder now maps the missing key to Front Cover when the file is an MP4,
   matching the Emscripten backend and every other format's convention (covr
   is album art by definition). Pinned by `picture-api.test.ts` "MP4 covr
   picture-type parity (taglib-cvr)", which loops both backends through
   write→save→reopen; the WASI instance was observed failing before the fix
   (`["Other", "Other"]`). Within one session the backends still answer
   differently for staged writes (WASI reads its cache, Emscripten the live
   object) — assert only on the reopened file. The write side is unaffected:
   MP4 `setComplexProperties` ignores `pictureType`, so BackCover/Media
   distinctions remain unrepresentable in m4a by design.

   **Boundary, not vendored (taglib-ri4b):** the fix lives in the WASI
   encoder (`encode_pictures` maps the missing key to Front Cover when the
   file is an MP4); the submodule stays at upstream taglib v2.3.1 — no
   vendored fork. Proposed upstream as taglib-ri4b; if merged, the boundary
   fallback can be deleted. Behavior is byte-identical; this parity test
   remains the guard.

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
