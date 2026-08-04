# Changelog

## Unreleased

### Added

- **Album grouping: `scanAlbums()` and `groupAlbums()`** (folder API). Scan a
  folder and get albums with disc subdivisions, using embedded tags as
  authority and folder/filename structure as evidence. Every result item
  carries its own resolution (`albumDir`, `discNumber`); albums expose
  `directory`, `compilation` (tag-flag agreement), discs with `totalDiscs`
  (tag → `of N` → max sibling), `tagDiscNumber`/`folderDiscNumber`/`confidence`;
  1-file albums are `singles`, untaggable files are `unmatched`, scan errors
  are `errors` (disjoint partition). Pure, synchronous `groupAlbums` runs
  anywhere; `scanAlbums` wraps `scanFolder`. Recognizers cover exact/embedded/
  volume/bonus/bare disc names with sibling corroboration and flat filename
  prefixes (`1-01`, `101`); plain `Bonus`/`Extras` are never discs.

### Fixed

- **WMA multi-value attributes now round-trip in the caller's order instead
  of being rotated by one.** TagLib 2.3.1's ASF render splits a multi-value
  attribute across the Extended Content Description and Metadata Library
  objects, and the header parses them back in an order that left-rotates the
  values — `["Pop", "Rock"]` was written and read back as `["Rock", "Pop"]`,
  and because the split happens at render time, even a no-op save flipped the
  order on every write. Both backends now right-rotate multi-value attributes
  immediately before `save()` renders (and restore them after), so writes and
  no-op saves are stable and order-exact for any number of values
  (`src/capi/taglib_asf_multi_value.h`). This is a deliberate compensation
  for a TagLib defect, guarded by tests that assert 2- and 3-value round-trip
  and no-op-save stability on both backends; if a TagLib bump fixes the
  render, the guard must be deleted, not adjusted (taglib-ilrg). Files
  written by other taggers are read exactly as TagLib merges them, unchanged.

- **Property values containing an embedded NUL are no longer truncated on the
  WASI backend (parity divergence).** The WASI msgpack decoder built
  `TagLib::String` from a null-terminated C buffer, so any value containing a
  `\0` byte (the ID3v2.4 null-separated multi-value form, e.g. `"Pop\0Rock"`
  written as a single string) was silently cut at the first NUL — the TCON
  frame landed with only the first genre, and the file differed from what the
  Emscripten backend wrote for the same API call. All decode sites now use the
  length-aware `std::string` constructor: property maps, iXML, chapter titles,
  lyrics text/description/language, and picture MIME type/description. The
  array form (`setProperties({ genre: ["Pop", "Rock"] })`) was never affected.

- **A frame holding an empty value is no longer deleted on save (data loss).**
  On the WASI backend, any ID3v2 frame whose PropertyMap projection is an empty
  string was destroyed by a save — including a save that changed nothing. A
  frame that exists holding an empty string is a different state from no frame
  at all, but WASI's read collapsed both into "absent", so the value never
  reached the snapshot, `setProperties()` saw the field as missing, and TagLib
  removed the frame. The canonical case is a numeric `TCON`: `ID3v2::Tag::genre()`
  maps a bare number through `ID3v1::genre(n)`, which answers `""` for any index
  outside the ID3v1 list, so a genre of `"255"` reads back empty while the frame
  is plainly there. It was not limited to genre — measured on one real MP3
  library, the affected keys were `barcode`, `label` and `replayGainTrackGain`.
  Emscripten was never affected.

  Two earlier attempts tried to infer whether a caller's `""` meant "delete" or
  "empty value", which cannot be answered: both arrive as identical bytes in the
  same argument, and the documented `readTags()` → `applyTags()` flow turns one
  into the other. The fix asks a different question — whether the value differs
  from what the file already holds — which needs no knowledge of intent. An
  empty value equal to the file's own is a round-trip echo and is left alone.

  `properties()` on WASI now reports `[""]` for such a field, matching what
  Emscripten already returned. If you enumerate `properties()`, expect keys that
  did not previously appear. That visibility is also what makes the field
  clearable: `clearTags()` builds its map from `properties()`, so a field it
  cannot name is one it cannot remove.

  Writing an empty value **on purpose**, distinct from deleting the field, is
  still unsupported: `""` means delete. The one exception, which predates this
  change and is now consistent across both backends, is a field whose stored
  value _already_ projects to empty — writing `""` there is a no-op rather than
  a delete, because the two are indistinguishable at the API boundary. Use
  `setProperties({ key: [] })`, `clearTags()` or `removeId3v2Frames()` to remove
  such a field.

  Formats differ in whether they can store an empty value at all, and both
  backends agree per format: MP3, MP4 and WAV round-trip it; FLAC and Ogg drop
  it, because a Xiph comment has no representation for an empty field.

## 1.6.1

### Fixed

- **A freeform MP4 atom keeps its own namespace, and reads back.** On the WASI
  backend an atom whose `mean` is not `com.apple.iTunes` was relocated into
  Apple's namespace and upper-cased, so `----:com.acme.tool:MyTag` became
  `----:com.apple.iTunes:MYTAG` — the caller's atom gone and a wrong one in its
  place. WASI routes MP4 items through TagLib's PropertyMap, which knows only
  one freeform namespace; the exact name the caller supplied is now reinstated
  after the write. Reading had the same gap in the other direction: WASI
  resolved every `----:` key through that same PropertyMap, which never carries
  a foreign `mean`, so `getMP4Item()` answered `undefined` for an atom the
  library had itself just written — or one any other tool wrote (`taglib-5ibr`).
  Foreign-`mean` atoms now travel in the WASI snapshot under their full atom
  names and `getMP4Item()` resolves them first. Emscripten always read them
  correctly.
- **A described `COMM` frame no longer attracts a duplicate.** An MP3 whose only
  comment frame carries a description (the usual iTunes `iTunNORM` shape) and
  which also has an ID3v1 comment gained a second, bare `COMM` on save. The
  property map has to carry the ID3v1 value — withholding it clears ID3v1 — so
  the spurious frame is withdrawn afterwards instead, and only when it provably
  holds that merged value. A comment the caller sets is untouched.
- **Opening a file no longer corrupts the Wasm heap (crash).** On the Emscripten
  backend, any file TagLib could not open on its first attempt took a fallback
  branch that handed a `TagLib::File` to `FileRef` while a `unique_ptr` still
  owned it. `FileRef` takes ownership too, so the file was freed twice on
  teardown. The corruption was latent: opening and every read **succeeded**, and
  the abort surfaced later as a Wasm `unreachable` trap during `dispose()`. A
  trap is not a JavaScript exception, so callers could not catch it. Measured on
  one real 384-file MP3 library, 12.5% of files were unusable. The smallest
  reproducer was 43 bytes. WASI was never affected.
- **Partial loading no longer misreads files with large metadata.**
  `TagLib.open(path)` defaults to reading a file's first 1 MB plus its last
  128 KB and discarding the middle. When metadata exceeded the header window that
  cut the tag mid-structure and spliced unrelated bytes onto the cut, so TagLib
  parsed whatever landed there — 18 of 40 large MP3s in a real library read back
  **different metadata** than a full load, silently. Partial loading is now used
  only when the metadata is provably contained in the header window. That extent
  is measured for ID3v2, FLAC, MP4 and Ogg, and an MP3 with no ID3v2 tag
  qualifies outright because its metadata is an ID3v1 trailer the footer window
  already covers. The trailer is checked too: an APE tag is unbounded (it can
  carry cover art), and one larger than the footer window loses EVERY tag value
  silently, so that also falls back. Anything else — an unrecognised container, a
  truncated or malformed header, an MP4 whose `moov` sits behind the media data,
  or FLAC-in-Ogg, whose comment block is not required to be the second packet —
  reads in full rather than answering wrongly. An ID3v2 tag sitting in FRONT of
  another container (TagLib allows this for FLAC) no longer short-circuits the
  check: the container behind it is probed too. RIFF (WAV/AIFF) always reads in
  full, because its metadata chunks may sit after the audio data.
- **Saving an MP3 no longer deletes a non-numeric track or date (data loss).**
  Opening an MP3 and saving it — changing nothing at all — silently dropped a
  `TRCK` or `TDRC` frame whose value does not begin with a nonzero integer. A
  vinyl track number of `"A1"`, a `"Side A"`, a literal `"0"`, or a date of
  `"unknown"` all vanished; `"03"`, `"3/12"`, `"7"` and `"1986-03-25"` were never
  affected. `properties()` reported the value correctly right up until the save,
  so nothing signalled the loss, and it applied to every MP3 save on both
  backends — any read-modify-write of an unrelated field took the value with it.
  Writing such a value was equally impossible.

  `ID3v2::Tag::track()` narrows the frame text with `toInt()`, so `"A1"` reads
  back `0` — indistinguishable from an absent frame. `MPEG::File::save()`'s
  ID3v1 duplication pass acts on that `0` and calls `setTrack(0)`, which TagLib
  defines as _remove the frame_. And because `MPEG::File::read()` always creates
  an ID3v1 tag object, that pass ran on every save even for files with no ID3v1
  tag at all. taglib-wasm now performs the ID3v1 sync itself, skipping only the
  two guards that destroy, so both directions of the sync still happen. Non-MPEG
  containers (FLAC, AIFF, WAV) were never affected.
- **`properties()` now reports MP3 values held only in ID3v1, and a save no
  longer erases them (data loss).** A field in a file's ID3v1 tag but not its
  ID3v2 tag was invisible to `properties()`, because `TagUnion::properties()`
  returns the first non-empty tag's map and never merges ID3v1. Everything else
  followed from that one fact: the declarative save could not carry what it
  could not see, so any property write wiped it — on WASI that meant EVERY save.
  Measured: an ID3v1 track of `5` became `0` on a save that changed nothing.

  Fixing it on the write side alone proved unsound — it made a deliberate clear
  inexpressible, since `clearTags()` builds its map from `properties()` and so
  could never name the field it needed to remove, and the value came back as a
  ghost in ID3v2. The READ now fills those gaps instead, which settles both
  directions: a round-trip carries the value like any other property, and a
  clear can address it. ID3v2 stays authoritative; this only fills fields it
  does not have. Both backends agree, and an ID3v1-only value is promoted into
  ID3v2 on save, as TagLib's own duplication has always done on Emscripten.

  If you enumerate `properties()` on MP3s, expect keys that did not previously
  appear for files carrying both tag versions.

### Internal

- **The Deno compatibility patcher fails loudly instead of half-patching.**
  `fix-deno-compat.js` applies five regex patches to Emscripten's generated
  glue, but each was optional and one shared `modified` flag was set if any of
  them matched — so it could apply one of five, print success and exit 0. That
  combination is worse than applying none: the instantiation patch inserts
  references to `ENVIRONMENT_IS_DENO`, which the detection patch is what
  defines, so the result threw `ReferenceError: ENVIRONMENT_IS_DENO is not
  defined` before doing anything. Each patch is now required, a miss names the
  patch and leaves the file untouched, and the patterns tolerate the comments
  and quoted keys an unminified (`-g2`) build emits — so a debuggable module
  with a Wasm name section can now actually be built and run under Deno.

## 1.6.0

### Fixed

- **Raw tag values are no longer coerced to integers (data loss).** On the WASI
  backend, `TRACKNUMBER`, `TRACKTOTAL`, `DISCNUMBER`, `DISCTOTAL` and `BPM` were
  narrowed through `toInt()` when crossing the Wasm boundary, so `properties()`
  answered `"3"` for an on-disk `"03"` — and `"3"` for `"3/12"`, **destroying the
  track total**. On FLAC, Ogg and WAV a title-only edit was enough to lose it,
  because nothing else carried the total. A BPM of `"120.5"` lost its precision
  the same way. The property surface now carries the string TagLib holds, and
  numeric narrowing happens only on the typed surfaces (`tag().track`,
  `readTags()`), which still answer numbers.
- **`readTags()` -> `applyTags()` no longer destroys a track total.** The typed
  layer kept only the numeric `track`, so the documented copy-tags-between-formats
  flow wrote back a bare `"3"`. `ExtendedTag`/`TagInput` gained `trackNumber` (see
  Added) and it wins over `track` when both are set.
- **`tag().setTrack()` no longer destroys an existing track total.** Setting the
  number on a file whose `TRCK` was `"3/12"` wrote `"7"` under Emscripten, because
  `ID3v2::Tag::setTrack` replaces the whole frame. It now writes `"7/12"` when a
  total is present. `setTrack(0)` still clears the field.
- **MP4 freeform atoms keep their exact names.** Saving an M4A wrote Apple's
  atoms upper-cased — `ITUNNORM` instead of `iTunNORM` — so a file that already
  had one ended up with both spellings, and a file that did not got only the
  upper-cased name. ExifTool and other readers do not recognise the upper-cased
  form. Six further properties were affected on both backends:
  `replayGain{Track,Album}{Gain,Peak}` (the ecosystem spells these lowercase) and
  `acoustid{Fingerprint,Id}`.
- **`removeMP4Item()` works for standard atoms on WASI.** `trkn`, `disk`, `©nam`
  and every other non-freeform atom name resolved to nothing, so removal was a
  silent no-op while Emscripten removed them correctly.
- **`setMP4Item()` can write `trkn` and `disk` on Emscripten.** The item type was
  guessed from the value string, so an integer value became an `Int` item where
  those atoms need an int PAIR, and the write silently did nothing. A text atom
  whose value happened to be all digits was mis-typed the same way.
- **`date`/`year` now obey the same rules as `trackNumber`/`track`.** On WASI,
  `setProperty("date", "unknown")` left a stale `year`, and
  `setProperty("date", "")` did not clear the field at all.

### Added

- **`trackNumber` on `ExtendedTag` and `TagInput`.** The raw track field as
  stored — `"03"`, `"3/12"` — alongside the numeric `track`, mirroring how `date`
  sits alongside `year`. When both are provided on write, `trackNumber` wins.
- **`appleGaplessInfo` property** for the `iTunSMPB` atom (gapless playback:
  encoder delay and padding). `properties()` previously answered the friendly
  `appleSoundCheck` for `iTunNORM` but the raw `ITUNSMPB` for its sibling; both
  now use friendly names.

### Known limitations

- **MP4 freeform atoms whose `mean` is not `com.apple.iTunes`** are still
  rewritten into the Apple namespace with an upper-cased name on the WASI
  backend, so a `----:com.acme.tool:MyTag` does not survive a save there.
  Emscripten handles them correctly. Reach such atoms by exact name with
  `getMP4Item()` / `setMP4Item()` on Emscripten; tracked as `taglib-wkyi`.

### Changed

- **A combined `"n/total"` track or disc field is no longer split on the
  PropertyMap surface.** The WASI backend used to rewrite a `TRACKNUMBER` of
  `"3/12"` into `trackNumber` + `totalTracks` for MP3 and MP4 while Emscripten
  reported the raw string, so the same file read differently per backend and — once
  `trackNumber` became a typed field — the same input produced different files.
  `properties()` now reports the pair verbatim on every format and both backends.
  The typed surface is unaffected: `readTags()` still answers `trackNumber:
  "3/12"`, `track: 3` and `totalTracks: 12`. If you read `totalTracks` from
  `properties()` on an MP3 or MP4 with a combined field, read it from `readTags()`
  instead, or parse the suffix.

- **Minimum Node.js is now 24.** `engines.node` moves from `>=22.6.0` to
  `>=24.0.0`, matching the Active LTS line. The old floor was an untested
  claim rather than verified support: CI has only ever run Node 24
  (`ci.yml:118,157,207` — Node 22 appears nowhere in the matrix), and the
  codebase relies on `using`/`Symbol.dispose` whose behavior on 22 was never
  exercised. Node 22 entered maintenance in October 2025. `@types/node` moves
  to `^24.13.3` so the types describe the supported floor rather than a newer
  one — pinning types ahead of `engines` would let the compiler accept APIs
  that throw for users on the declared minimum. Docs, README and CONTRIBUTING
  are synced to the new floor.

### Internal

- **`wasm-freshness` now tracks C++ sources, not just the submodule.** As first
  shipped it triggered only on `lib/taglib`, but both binaries also compile
  from `src/capi/` — so editing the WASI shim without rebuilding still shipped
  a binary built from older C++ than the source beside it. Input sets are now
  per-backend and match what each script actually compiles: WASI gets
  `lib/taglib`, `lib/mpack`, `src/capi/*`; Emscripten gets `lib/taglib`,
  `build/taglib_embind.cpp`, `src/capi/formats/*` (it links only
  `taglib_lame.cpp` from `src/capi`, not the WASI shim). Replayed over the last
  80 commits: zero false positives. The earlier over-broad set would have
  failed 8 of them.
- **`test-wasi` now tests the binary it built.** The job downloaded the fresh
  WASI artifact into `dist/wasi/` but the loader reads `build/taglib-wasi.wasm`
  (`src/runtime/wasi-host-loader.ts:50`), so it tested the committed binary and
  the fresh build was only size-reported. It now copies the artifact into
  `build/` first. The committed binary is still covered by the main `test` job,
  which defaults to the WASI backend — so `test` covers what ships and
  `test-wasi` covers what current source produces.

## 1.5.3

### Changes

- **Upgraded the bundled TagLib to 2.3.1** (from 2.3). Both Wasm backends were
  rebuilt. Upstream is a bug-fix release, and several fixes land on formats
  taglib-wasm exposes:
  - **Matroska** (MKA/MKV/WebM): fixed a crash when the seek head is invalid or
    missing, added element-length checks, support for unknown-size elements,
    and skipping of invalid elements. These are malformed-input paths, where a
    C++ crash traps the whole Wasm instance.
  - **MP4**: avoids excessive sample allocation with an invalid `stsc` for
    QuickTime chapters; fixed `MP4::Chapter` destructor and assignment
    operator; `cnID` widened to 64-bit for large Apple Music catalog IDs;
    support for NI STEM atoms with 64-bit length; raised the top-level atom
    limit.
  - **XM**: fixed the save path to skip sample data after sample headers,
    correcting tracker files written with samples.
  - **ID3v2**: fixed the data-length-indicator check for compressed frames.
- **FLAC `bext`/iXML presence now reflects on-disk state.** Upstream changed
  `FLAC::File::hasiXMLData()`/`hasBEXTData()` to track whether the APPLICATION
  block exists in the file rather than whether an in-memory payload is set,
  matching the model `RIFF::WAV::File` already used. Reading `bext`/iXML back
  from a FLAC file after `setBext()`/`setIxml()` but _before_ `save()` now
  reports absent; reopening after save is unaffected, as is WAV. This removes a
  FLAC-vs-WAV divergence rather than introducing one.

### Internal

- **`build:wasm` now builds both Wasm backends.** It previously ran only the
  Emscripten build, so `build/taglib-wasi.wasm` — the committed, published WASI
  binary — changed only when someone remembered to run `build/build-wasi.sh` by
  hand. Bumping `lib/taglib` and running the documented build command would
  ship Emscripten built from the new TagLib and WASI from the old one, with CI
  green: CI builds the WASI binary fresh but the loader reads the committed one
  (`src/runtime/wasi-host-loader.ts:50`), and publish only checks that the file
  exists. Split into `build:wasm:emscripten` / `build:wasm:wasi`, with
  `build:wasm` running both; CI jobs that provision only one SDK now name the
  specific variant.
- **New `wasm-freshness` CI job** fails if a commit moves the `lib/taglib`
  gitlink without rebuilding both wasm binaries.
- **The release preflight now builds the npm package before linting it.**
  `publint`, `arethetypeswrong`, and `npm pack --dry-run` lint the packed
  tarball, but the release script only ran `deno task build`, whose `build:ts`
  emits `.js` only — the `.d.ts` files come from `tsc` in the npm `build:ts`.
  Those checks were therefore validating whatever stale `dist/` happened to be
  present locally, and reported missing types once `dist/` was cleaned.
- **The release gate now actually verifies the WASI binary.** `release.sh` and
  `release-safe.sh` compared `build/taglib-wasi.wasm` against
  `dist/wasi/taglib-wasi.wasm`, which could never fail — `build-wasi.sh` writes
  both paths from the same run — and fell back to an exists-and-over-100KB
  warning when `dist/wasi/` was absent. Both now use the same
  `git diff --quiet` staleness check already applied to the Emscripten binary,
  which works because `deno task build` rebuilds both backends and same-machine
  rebuilds are byte-identical.
- `prepareWasmForEmbedding()` now searches `build/` before `dist/`. `dist/` is
  gitignored and refreshed only by the npm chain (`build:copy-wasm`/
  `postbuild`), so in a working checkout a months-old copy there silently
  shadowed the committed, freshly built binary in `build/`. Published packages
  ship no `build/` and are unaffected — resolution falls through to `dist/` as
  before. The search order is now a named constant with a regression test.
- The npm `build` script now cleans `dist/` first, so local builds match the
  clean-checkout guarantee CI gets instead of relying on every writer to
  overwrite its own stale output. `dist/wasi/` is deliberately preserved: it is
  written by `build/build-wasi.sh`, which `npm run build` does not invoke, so
  the packaging chain has no business deleting another build's output.
- `tests/offline-support.test.ts` reads the Emscripten binary from `build/`
  rather than `dist/`. Its whole Emscripten suite was gated on a file in a
  gitignored directory, so 10 test steps had been skipping silently in this
  repo since the stale copy was written, and would skip on any fresh clone.

## 1.5.2

### Fixes

- **Emscripten backend: resizable-heap posture rolled back.** The toolchain is
  now pinned to Emscripten 6.0.3, whose `GROWABLE_ARRAYBUFFERS` default was
  reverted to off upstream after Web API compatibility issues — and which also
  fixed an upstream `UTF8ToString` bug on resizable heaps. Builds since 1.4.1
  had the resizable heap auto-enabled (6.0.2 default with
  `ALLOW_MEMORY_GROWTH`), putting both issues in the string-decoding hot path
  once the wasm heap grew. Memory growth returns to copy-on-grow (the
  pre-1.4.1 behavior); the WASI backend is unaffected. A regression test now
  forces heap growth past the initial 16MB and round-trips multibyte tags on
  both backends.

### Internal

- CI: `bun-version` pinned to 1.3.14 in the Package Compatibility job —
  `latest` resolved tags via a GitHub API call from the runner on every run,
  which intermittently returned 503.
- Repository history was rewritten to remove editor settings and an internal
  planning document; all commit SHAs changed. Existing clones and forks must
  be re-cloned (published npm/JSR packages and GitHub Releases are
  unaffected).

## 1.5.1

### Fixes

- **Windows: all drives now preopen on Node.js and Electron** (#24). The
  loader's drive detection used `new Function("return require('node:fs')")()`,
  which evaluates in the global scope where `require` never exists in standard
  module files (ESM _or_ CJS) — so only `C:\` was registered as a WASI preopen
  and files on other drives failed with error `-4`. node:fs is now acquired via
  `process.getBuiltinModule("node:fs")` (Node ≥ 20.16 / Electron ≥ 32), with
  the legacy hack kept only for global-`require` contexts.
- **`getFileBuffer()` no longer silently returns wrong data** — two data-loss
  vectors closed. On WASI path-mode it returned an **empty** buffer when the
  disk read-back failed (e.g. source moved/deleted), and a **stale pre-save**
  buffer when it had been called before `save()`/`saveToFile()`; consumers
  writing the returned buffer back to disk would truncate or revert their
  files. Read failures now throw `FileOperationError` (with the source path),
  and the path-mode cache is invalidated on every save path.
- `getRating()` now returns the branded `NormalizedRating` type, so the
  documented `RatingUtils` pairing (`toStars(file.getRating()!)`) type-checks.
  Type-level only — the value is still a plain number at runtime, and the
  branded type remains assignable to `number`.

### Internal

- Browser bundles (`index.browser.js`, `simple.browser.js`) no longer contain
  `new Function` source — strict-CSP consumers (e.g. MV3 extensions) reject it.
- Deno detection deduplicated behind a shared `isDeno()`.
- Docs: `getFileBuffer()`'s throw contract documented (API reference,
  troubleshooting, AGENTS.md); nine stale code examples fixed via a
  type-checked docs preflight.

## 1.5.0

### Features

- **Raw ID3v2 frame API** (MP3): `getId3v2Frames(id?)`, `setId3v2Frames(id,
  bodies)`, `removeId3v2Frames(id)` — an escape hatch for vendor/rare frames
  (RGAD, NCON, custom TXXX, …) with byte round-trip fidelity and cross-backend
  parity.

### Fixes

- `wasmBinary` is deterministic: Emscripten-only, and never silently ignored
  when another backend is selected.
- `forceWasmType: "wasi"` fails loudly when the WASI backend cannot load
  instead of silently falling back to Emscripten.
- Raw ID3v2 frame correctness: MPEG `save()` no longer clobbers raw-written
  typed-ID frames; the ID3v1 duplicate-sync gate is scoped to raw-written
  mapped frame IDs and mirrored into the WASI save path; staged frame bodies
  are copied on WASI reads.

## 1.4.3

### Fixes

- Fix `TagLib.initialize()` failing on **Deno / JSR** for both the Emscripten and
  the default WASI backend. `deno publish` (Deno ≥ 2.8.2, denoland/deno#34549)
  rewrites the import module names inside the published wasm to relative
  specifiers (`a` → `./a`, `wasi_snapshot_preview1` → `./wasi_snapshot_preview1`),
  which no longer match the glue's import object, throwing
  `WebAssembly.instantiate(): Import #0 "./a": module is not an object or function`.
  The runtime now provides its wasm imports under both the bare and `./`-prefixed
  names, so the JSR-published wasm instantiates correctly. The wasm bytes are
  unchanged. **npm was unaffected; 1.4.1 and 1.4.2 are broken on Deno/JSR — use
  1.4.3.**

### Internal

- Add a post-publish CI gate that instantiates the actual published JSR package
  (both backends) — the only check that can catch this publish-time corruption,
  since the build-time guard runs before `deno publish` rewrites the wasm.

## 1.4.2

### Fixes

- Fix the Emscripten backend failing to instantiate on Deno (regression in
  1.4.1). The published wasm imported module `./a` while its glue provided
  `{a: …}` — a wasm/glue mismatch caused by a stray `wasm-opt` (Binaryen) on the
  CI runner minifying the wasm's import module names inconsistently with the
  glue. `TagLib.initialize()` threw
  `WebAssembly.instantiate(): Import #0 "./a": module is not an object or function`
  on Deno. **1.4.1 is broken on Deno — use 1.4.2.**

### Internal

- Pin `BINARYEN_ROOT` to Emscripten's own vendored `wasm-opt` in the build so a
  stray PATH `wasm-opt` cannot desync the wasm from the glue.
- Add a build guard that fails the build if the wasm's import module name does
  not match the glue's import-object key, plus a hard Deno instantiation smoke
  test in CI (the unit suite only skips the Emscripten backend on load-failure,
  so a broken wasm previously stayed green).

## 1.4.1

### Fixes

- Emscripten backend: re-add `wasmBinary` (and `locateFile`) to the linker's
  `INCOMING_MODULE_JS_API`. Emscripten 6.0.2 drops `wasmBinary` from the default
  set, so under release builds (`ASSERTIONS=0`) an explicitly provided Wasm
  binary was silently ignored — affecting the `wasmBinary` option and
  Deno-compiled/embedded loading. No public API change.

### Internal

- Bump the Emscripten toolchain pin from 6.0.1 to 6.0.2 (developer setup and
  CI). The Emscripten backend now uses `GROWABLE_ARRAYBUFFERS` (resizable-buffer
  memory growth), auto-enabled in 6.0.2 with `ALLOW_MEMORY_GROWTH`.
- Add a regression test guarding against a provided `wasmBinary` being silently
  dropped by a future toolchain or flag change.
- Document the remaining public exports; docs-coverage backlog is now zero.

## 1.4.0

### Features

- Simple read API now returns structured metadata: `readTags()`,
  `readTagsBatch()`, `readMetadata()`, and `readMetadataBatch()` populate the
  `ExtendedTag` fields `pictures`, `ratings`, `lyrics`, `chapters`, `bext`,
  `bextData`, and `ixml`. Previously these were declared on `ExtendedTag` but
  only reachable through the `AudioFile.getX()` methods.

### Fixes

- `clearTags()` now reliably removes all metadata on both backends. It was
  effectively a no-op on the WASI backend (the default in Deno/Node) and left
  structured fields (ratings, chapters, `bext`, iXML) behind on Emscripten.
- Partial-load save now propagates a text-property deletion instead of silently
  restoring it from the full-file reload (Emscripten partial loads).
- MP4 freeform items (`----:com.apple.iTunes:*`, including the Apple Sound Check
  `iTunNORM` atom) now round-trip through save on the WASI backend; they were
  previously dropped.

### Types

- `ExtendedTag.ratings` and `ExtendedTag.lyrics` now use the canonical `Rating[]`
  and `UnsyncedLyrics[]` types so `readTags()` matches `getRatings()` /
  `getLyrics()`. Their sub-fields (`email`/`counter`, `description`/`language`)
  are now optional, reflecting what the library actually returns. These fields
  were never populated before, so existing code is unaffected.

### Toolchain

- Emscripten backend upgraded to 6.0.1 and switched to Wasm exception handling,
  which raises the minimum supported browser versions (see docs). The WASI
  backend is unaffected.

### Internal

- Cross-backend parity audit: added `tests/PARITY-COVERAGE.md` (a per-method ×
  backend coverage matrix), a mandatory parity-test convention, and both-backend
  parity tests across the `AudioFile` surface.

## 1.3.1

### Features

- Unsynchronized lyrics: public `AudioFile.getLyrics()` / `setLyrics()`. Lyrics
  are now a structured field (like pictures/ratings/chapters) and are excluded
  from the text `properties()` map on both backends.

### Fixes

- `clearTags()` removes lyrics on clear.

### Internal

- CI runs `build:ts` in a `check:all` task plus a fast bundle job to catch
  bundler-resolution regressions that pass tests but break the shipped bundle.

## 1.3.0

### Features

- `file.tag()` (MutableTag) gains a `date` getter and `setDate()`, preserving
  full ISO date precision; `setDate("")` coherently clears both date and year.

### Fixes

- Lyrics persist on the WASI backend via the `LYRICS` text property.
- WASI `saveToFile(target)` no longer mutates the source file.
- Partial-load `saveToFile` carries chapters and ratings through the reconstruct.
- MP4 chapter style and partial-property merge corrected from code review.
- Drop a `@std/path` import so the browser/npm bundle builds.

### Internal

- Save reconstruct extracted into `save-reconstruct.ts` and driven from a shared
  field-copy registry so a structured field can't be silently dropped on save.

## 1.2.2

### Fixes

- `setYear()` is authoritative over a stored full date, and full ISO `DATE`
  strings are preserved with cross-backend parity.
- Release pipeline hardened against flaky legs and double publishes; Deno pinned
  to 2.8.0.

### Dependencies

- WASI SDK upgraded to 33; the custom exception-handling sysroot was retired in
  favor of the stock SDK 33 `eh/` multilib.
- msgpack-c (`lib/msgpack`) bumped cpp-6.1.0 → cpp-8.0.0; esbuild 0.28 and
  TypeScript 6.0.

### Internal

- Removed an orphan dual-build Emscripten C-API path.

## 1.2.1

### Features

- FLAC: `AudioFile.hasId3Tags()` / `stripId3Tags()` to detect and remove
  spurious ID3v1/ID3v2 tags while preserving Vorbis Comments and audio.

### Fixes

- Correct same-handle state after `stripId3Tags`, and harden mpack parsing.
- Resolve a duplicate `Chapter` interface across the public API.

### Internal

- Adopt knip for opt-in dead-code detection (`deno task knip`); dead-code sweep.
- ADR-0001 documenting the dual Wasm/JS boundary protocols.

## 1.2.0

### Features

- Chapters: `AudioFile.getChapters()` / `setChapters()` for MP3 (ID3v2 `CHAP`)
  and MP4 (QuickTime chapter track and/or Nero `chpl` atom, selectable via
  `SetChaptersOptions.mp4ChapterStyle`). Adds the `Chapter` and
  `SetChaptersOptions` types and `ExtendedTag.chapters`.
- Broadcast metadata (BWF): `AudioFile.getBext()` / `setBext()` parse and write
  the `bext` chunk (EBU Tech 3285) on WAV and FLAC, with `getBextData()` /
  `setBextData()` for raw chunk bytes and `getIxml()` / `setIxml()` for the iXML
  chunk. Adds the `BroadcastAudioExtension` type, `ExtendedTag.bext` /
  `bextData` / `ixml`, and a standalone `bwf.decodeBext` / `bwf.encodeBext`
  codec.
- Opus: `audioProperties()` exposes `outputGainDb` — the OpusHead output gain in
  decibels (RFC 7845).

### Dependencies

- Update TagLib from 2.2.1 to 2.3 (released 2026-05-10). Inherited fixes that
  ride along: correct ADTS/ESDS AAC bitrate reporting; fixed `MP4::ItemFactory`
  data race; bounded EBML/MP4 atom recursion and atom-count caps; `stco`/`co64`
  chunk-offset fix; more tolerant RIFF / ID3v2 / Matroska parsing; no false
  positives in MPEG detection; faster Matroska seek-head handling.

### Internal

- Remove a stale `git subtree` copy of TagLib (`CMakeLists.txt`, `taglib/`,
  `bindings/`) from the repo root — unused by the build (which uses the
  `lib/taglib` submodule) and only ever leaked into the JSR tarball. Tightened
  `deno.json` `publish.exclude` and rewrote `scripts/update-taglib.sh` to use
  the submodule flow instead of `git subtree`.

## 1.0.6

### Features

- Add Matroska/WebM (.mka, .mkv, .webm) format support across all backends
- Add Matroska format detection via EBML magic bytes

### CI

- Consolidate test.yml and dual-build.yml into single ci.yml pipeline

### Dependencies

- Update TagLib from 2.1.1 to 2.2.1 (Matroska/WebM support, Ogg FLAC fixes, stricter ID3v2 verification)

## 1.0.5

### Performance

- Eliminate COW memory multiplication during save()
- Increase MAXIMUM_MEMORY from 1GB to 2GB

## 1.0.4

### Performance

- Eliminate redundant buffer copy in loadFromBuffer
- Optimize Emscripten buffer transfers with typed_memory_view

## 1.0.2

### Bug Fixes

- Merge TRACKTOTAL/DISCTOTAL into IntPair format for MP4 and MP3

## 1.0.1

### Features

- Add browser conditional exports for Vite compatibility

### Bug Fixes

- Revert global.d.ts types to `any` for Node.js tsc compatibility
- Remove nonexistent mod.ts from sonar.sources

### Refactoring

- Replace `any` with `Record<string, unknown>` in module loader
- Remove forceBufferMode in favor of forceWasmType
- Remove vestigial mod.ts in favor of single index.ts entry point
- Rename writeTagsToFile to applyTagsToFile

## 1.0.0-beta.13

### Features

- Detect missing exnref support and warn Node.js users on WASI fallback

### Bug Fixes

- Add fast-check to devDependencies for Windows CI
- Make error message assertions platform-agnostic for Windows
- Use internal path utils instead of @std/path in src/
- Use fromFileUrl and @std/path for Windows compatibility
- Resolve cross-backend parity bugs for WV/TTA/WMA/Opus formats

## 1.0.0-beta.12

### Breaking Changes

- Unified camelCase property API replaces mixed-case keys
- Removed 26 convenience methods and ExtendedAudioFileImpl

### Features

- Add branded NormalizedRating and PopmRating types to RatingUtils
- Add runtime Node.js version check with clear error message
- Add format-specific type narrowing for property keys
- Unified camelCase property API with translation maps
- Add TotalTracks, TotalDiscs, Compilation to Tags constant

### Bug Fixes

- Fix CI: copy wasm artifacts to dist/ before TypeScript build
- Fix CI: remove runtime initialization from package-compat import tests
- Update test expectations for unified PropertyMap key vocabulary

## 1.0.0-beta.11

### Refactoring

- Extract ratings, pictures, and audio props from C++ shim

## 1.0.0-beta.10

### Bug Fixes

- Return null from getAudioProperties() when audio data absent
- Pass raw msgpack to C++ shim for full PropertyMap write support

## 1.0.0-beta.9

### Bug Fixes

- Implement buffer-to-buffer write via ByteVectorStream in WASI shim
- Surface audio properties from WASI decoded tag data

## 1.0.0-beta.8

### Bug Fixes

- Correct tl_read_tags return value interpretation and add e2e tests

## 1.0.0-beta.7

### Bug Fixes

- Publish WASM binaries to JSR and resolve import paths

## 1.0.0-beta.6

### Bug Fixes

- Use explicit file discovery in build script for bash compatibility
- Fix Deno compile wasm path resolution and dead code cleanup

### Refactoring

- Comprehensive quality remediation across codebase

## 1.0.0-beta.5

### Breaking Changes

- Removed deprecated simple API aliases (`getFormat`, `getTags`, `getProperties`, `setTags`, `getCoverArt`, `setCoverArt`)
- Minimum Node.js requirement: v22+ with `--experimental-wasm-exnref` flag

### Features

- **Fluent `edit()` API** for tag modifications with method chaining
- **`Symbol.dispose` support** across Full and Workers APIs for `using` pattern
- **RAII memory management** with `WasmAlloc` and `WasmArena` for leak-free Wasm operations
- **Runtime-agnostic WASI host** supporting Deno, Node.js, and Bun via `FileSystemProvider` DI
- **Realigned API naming**: `readTags`, `readProperties`, `readFormat`, `readCoverArt`, `applyCoverArt`, `readPictureMetadata`
- **Batch metadata API**: `readMetadataBatch` for efficient multi-file processing with cover art and dynamics data
- **Folder scanning API** for recursive directory metadata extraction

### Bug Fixes

- Fixed memory cleanup in `open()` error paths and `isValidAudioFile()`
- Fixed progress tracking and type-safe error tags in folder-api
- Hardened worker pool with proper try-finally cleanup
- Fixed negative seek position handling in WASI adapter

### Internal

- Migrated all tests to BDD syntax (135 tests passing)
- Split 10 oversized source files into directory modules
- Deduplicated batch operation scaffolding with shared `executeBatch` helper
- Removed stale build scripts and migration guides

## 1.0.0-beta.4

### Features

- Make WASI host runtime-agnostic for Node.js and Bun support

### Bug Fixes

- Freeze EMPTY_TAG and use atomic progress capture in folder-api
- Suppress S2187 false positives and reduce cognitive complexity

### Refactoring

- Migrate all test files from Deno.test() to BDD syntax

## 1.0.0-beta.3

### Breaking Changes

- Removed deprecated aliases for renamed simple API functions

### Features

- Realign API naming and add edit() method with fluent setters
- Make WASI host runtime-agnostic with FileSystemProvider DI

### Bug Fixes

- Throw on negative seek position
- Detect Bun runtime and lazy-load wasmer-sdk to prevent loader errors

## 1.0.0-beta.2

### Features

- Add Symbol.dispose to Full API with `using` pattern support

### Refactoring

- Migrate Emscripten Workers API to RAII memory management
- Use minimal WorkerSelf interface instead of webworker lib

## 1.0.0-beta.1

### Features

- WASI in-process filesystem access via WASI host
- FileRef with EH-enabled sysroot (removes format-specific workarounds)
- FileStream for efficient seek-based path I/O
- Sidecar routing for path-based access in Simple API

### Bug Fixes

- Build as reactor module for proper static constructor initialization
- Harden WASI host security and resource management
- Use valid SPDX license identifier for JSR/NPM publishing

### Refactoring

- Split oversized source files into directory modules
- Extract shared test helpers, deduplicate bench loops

## 1.0.0

### Features

- Stable release of taglib-wasm
- Dual-build architecture: WASI (Deno/Node.js/Bun) and Emscripten (browser)
- Full API, Simple API, and Workers API surfaces
- Complex properties, rating API, and cover art support
- RAII memory management with `Symbol.dispose`
- Comprehensive property system with rich metadata
- Worker pool for parallel audio processing
- Folder scanning and batch processing APIs
- Smart partial loading for large files
- Deno compile support with embedded WASM
- SonarCloud integration

## Pre-1.0 (0.4.0 - 0.9.0)

Early development releases establishing the core architecture:

- **0.9.0** — TagLib/mpack as git submodules, Phase 4 WASI exception handling, unified loader
- **0.5.x** — Worker pool, property system, batch processing, folder API, partial loading
- **0.4.x** — Deno compile support, codec detection, extended metadata, cover art, Embind migration, Cloudflare Workers/Bun support, format-agnostic metadata with ReplayGain and Sound Check
