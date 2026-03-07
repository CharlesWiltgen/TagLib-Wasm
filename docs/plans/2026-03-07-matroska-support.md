# Matroska/WebM Format Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose TagLib 2.2.1's Matroska/WebM support through TagLib-Wasm's C and TypeScript APIs.

**Architecture:** TagLib's FileRef already handles Matroska transparently — no C++ shim changes needed. We add format enum, magic byte detection, TypeScript types, and test fixtures. Single `"MATROSKA"` FileType covers .mkv/.mka/.webm.

**Tech Stack:** C (boundary layer), TypeScript (types/constants), Deno (tests)

---

### Task 1: C enum — Add TL_FORMAT_MATROSKA

**Files:**

- Modify: `src/capi/core/taglib_core.h:58-61`

**Step 1: Add enum variant**

In `taglib_core.h`, add `TL_FORMAT_MATROSKA` after `TL_FORMAT_SPEEX` (line 60):

```c
    TL_FORMAT_OGG_FLAC,
    TL_FORMAT_SPEEX,
    TL_FORMAT_MATROSKA
} tl_format;
```

**Step 2: Rebuild WASI binary to verify compilation**

Run: `bash build/build-wasi.sh 2>&1 | tail -5`
Expected: `✅ WASI SDK build successful`

**Step 3: Commit**

```bash
git add src/capi/core/taglib_core.h
git commit -m "feat: add TL_FORMAT_MATROSKA enum variant"
```

---

### Task 2: C detection — Add EBML magic bytes and format name

**Files:**

- Modify: `src/capi/taglib_boundary.c:210-213` (detect) and `267` (name)

**Step 1: Add EBML detection in tl_detect_format()**

After the Shorten detection block (line 213), before the IT block (line 215), add:

```c
// Matroska/WebM: EBML signature (0x1A 0x45 0xDF 0xA3)
if (buf[0] == 0x1A && buf[1] == 0x45 && buf[2] == 0xDF && buf[3] == 0xA3) {
    return TL_FORMAT_MATROSKA;
}
```

**Step 2: Add format name in tl_format_name()**

After the `TL_FORMAT_SPEEX` case (line 267), add:

```c
case TL_FORMAT_MATROSKA: return "Matroska";
```

**Step 3: Rebuild and verify**

Run: `bash build/build-wasi.sh 2>&1 | tail -5`
Expected: `✅ WASI SDK build successful`

**Step 4: Commit**

```bash
git add src/capi/taglib_boundary.c
git commit -m "feat: add EBML magic byte detection for Matroska"
```

---

### Task 3: TypeScript types — Add Matroska to FileType and ContainerFormat

**Files:**

- Modify: `src/types/audio-formats.ts:38-41` and `73-74`
- Modify: `src/types/format-property-keys.ts:19`

**Step 1: Add to FileType union**

In `audio-formats.ts`, add `"MATROSKA"` before `"unknown"` (after line 40):

```typescript
| "SPEEX"
| "MATROSKA"
| "unknown";
```

**Step 2: Add to ContainerFormat union**

After `"XM"` (line 73), add:

```typescript
| "XM" // Extended Module
| "Matroska" // Matroska container (MKA, MKV, WebM)
| "unknown";
```

**Step 3: Map Matroska to Vorbis tag format**

In `format-property-keys.ts` line 19, add `"MATROSKA"` to the Vorbis branch:

```typescript
: F extends "FLAC" | "OGG" | "OPUS" | "OggFLAC" | "SPEEX" | "MATROSKA" ? "Vorbis"
```

**Step 4: Verify typecheck**

Run: `deno task fmt && deno task lint`
Expected: Clean output

**Step 5: Commit**

```bash
git add src/types/audio-formats.ts src/types/format-property-keys.ts
git commit -m "feat: add Matroska to FileType, ContainerFormat, and tag format mapping"
```

---

### Task 4: Constants — Add to SUPPORTED_FORMATS and folder extensions

**Files:**

- Modify: `src/errors/base.ts:4-11`
- Modify: `src/folder-api/types.ts:22-36`

**Step 1: Add to SUPPORTED_FORMATS**

In `base.ts`, add `"MATROSKA"` to the array:

```typescript
export const SUPPORTED_FORMATS = [
  "MP3",
  "MP4",
  "M4A",
  "FLAC",
  "OGG",
  "WAV",
  "MATROSKA",
] as const;
```

**Step 2: Add extensions to DEFAULT_AUDIO_EXTENSIONS**

In `folder-api/types.ts`, add after `".wma"` (line 35):

```typescript
  ".wma",
  ".mkv",
  ".mka",
  ".webm",
];
```

**Step 3: Verify**

Run: `deno task fmt && deno task lint`
Expected: Clean output

**Step 4: Commit**

```bash
git add src/errors/base.ts src/folder-api/types.ts
git commit -m "feat: add Matroska to SUPPORTED_FORMATS and folder scan extensions"
```

---

### Task 5: Test fixture — Copy test file and add to fixtures

**Files:**

- Create: `tests/test-files/matroska/no-tags.mka` (copy from `lib/taglib/tests/data/no-tags.mka`)
- Modify: `tests/shared-fixtures.ts:10-22`, `28-40`, `42-54`, `62-161`
- Modify: `tests/test-utils.ts:9-15`, `18-24`

**Step 1: Copy test file**

```bash
mkdir -p tests/test-files/matroska
cp lib/taglib/tests/data/no-tags.mka tests/test-files/matroska/no-tags.mka
```

**Step 2: Add "mka" to FORMATS tuple**

In `shared-fixtures.ts`, add `"mka"` to the FORMATS array (after `"wma"`, line 22):

```typescript
export const FORMATS = [
  "mp3",
  "flac",
  "ogg",
  "m4a",
  "wav",
  "opus",
  "mp4",
  "oga",
  "wv",
  "tta",
  "wma",
  "mka",
] as const;
```

**Step 3: Add fixture paths**

Add to `FIXTURE_PATH` record:

```typescript
mka: resolve(TEST_FILES_DIR, "matroska/no-tags.mka"),
```

Add to `WASI_VIRTUAL_PATH` record:

```typescript
mka: "/test/matroska/no-tags.mka",
```

**Step 4: Add expected audio properties**

Add to `EXPECTED_AUDIO_PROPS` record. The `no-tags.mka` file contains Vorbis audio:

```typescript
mka: {
  sampleRate: 44100,
  channels: 1,
  bitrateMin: 50,
  bitrateMax: 500,
  lengthMin: 0,
  lengthMax: 30,
},
```

Note: The `no-tags.mka` file may have different properties — run tests and adjust values based on actual output.

**Step 5: Add to test-utils.ts**

Add to `TEST_FILES`:

```typescript
mka: "./tests/test-files/matroska/no-tags.mka",
```

Add to `EXPECTED_FORMATS`:

```typescript
mka: "MATROSKA",
```

**Step 6: Run tests**

Run: `deno task test 2>&1 | tail -5`
Expected: All tests pass. If mka tests fail due to wrong expected audio property values, adjust the values in `EXPECTED_AUDIO_PROPS` based on the actual output.

**Step 7: Commit**

```bash
git add tests/test-files/matroska/ tests/shared-fixtures.ts tests/test-utils.ts
git commit -m "test: add Matroska test fixture and format expectations"
```

---

### Task 6: Rebuild both binaries and run full test suite

**Step 1: Rebuild WASI**

Run: `bash build/build-wasi.sh 2>&1 | tail -5`
Expected: `✅ WASI SDK build successful`

**Step 2: Rebuild Emscripten**

Run: `bash build/build-emscripten.sh 2>&1 | tail -20`
Expected: `✅ Emscripten build successful`

**Step 3: Run full test suite**

Run: `deno task test`
Expected: All tests pass (184+ tests)

**Step 4: Commit any remaining changes and push**

```bash
git push
```
