# Unify Dual Mapping Systems Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the parallel `VORBIS_TO_CAMEL`/`CAMEL_TO_VORBIS` mapping system by making `toTagLibKey`/`fromTagLibKey` (from PROPERTIES) the single source of truth for ALL_CAPS↔camelCase translation.

**Architecture:** The C++ FIELD_MAP in `taglib_shim.cpp` already converts most PropertyMap keys to camelCase in the msgpack output. The JS decoder's `normalizeTagKeys` and WasiFileHandle's translation are only needed for keys NOT in the C++ FIELD_MAP. By adding 3 missing entries to PROPERTIES and replacing all `VORBIS_TO_CAMEL`/`CAMEL_TO_VORBIS` imports with `toTagLibKey`/`fromTagLibKey`, we get a single mapping source. The `year`/`date` and `track`/`trackNumber` vocabulary difference (ExtendedTag vs PropertyMap) is handled by forward-only aliases in `toTagLibKey`.

**Tech Stack:** TypeScript, Deno test runner

**Resolves:** `taglib-wasm-dni` (this issue), unblocks `taglib-wasm-hge` and `taglib-wasm-n40`

---

## Background: Data Flow

Understanding the data flow is essential. There are two paths:

### Read Path (C++ → JS)

1. C++ `encode_file_to_msgpack` reads TagLib PropertyMap (ALL_CAPS keys)
2. For each key, looks up C++ `FIELD_MAP`: if found, writes **camelCase** key to msgpack; if not found, writes **ALL_CAPS** as-is
3. JS `decodeTagData` → `normalizeTagKeys` converts remaining ALL_CAPS keys to camelCase
4. WasiFileHandle stores as internal `tagData` (camelCase keys)
5. `getProperties()` converts camelCase → ALL_CAPS for the FileHandle interface
6. `BaseAudioFileImpl.properties()` converts ALL_CAPS → camelCase via `fromTagLibKey`

### Write Path (JS → C++)

1. `BaseAudioFileImpl.setProperty(key)` converts camelCase → ALL_CAPS via `toTagLibKey`
2. WasiFileHandle `setProperty()` converts ALL_CAPS → camelCase for internal storage
3. On `save()`, `encodeTagData` converts camelCase → ALL_CAPS for msgpack
4. C++ `decode_msgpack_to_propmap` converts: camelCase via `map_camel_to_prop` (FIELD_MAP), or passes through ALL_CAPS keys

### Key Insight

The C++ FIELD_MAP handles `year`↔`DATE` and `track`↔`TRACKNUMBER` natively. The msgpack never contains `DATE` or `TRACKNUMBER` as keys — they arrive as `year` and `track`. So switching from `VORBIS_TO_CAMEL` to `fromTagLibKey` in the decoder has no effect on these keys (both pass through camelCase unchanged).

### The year/date and track/trackNumber Difference

- **PROPERTIES vocabulary** (PropertyMap): `date` ↔ DATE, `trackNumber` ↔ TRACKNUMBER
- **ExtendedTag vocabulary**: `year`, `track` (numbers, from C++ basic tag)

These are different API layers. The conversion between them (`year`↔`date`, `track`↔`trackNumber`) happens in `tag-mapping.ts` via `BASIC_PROPERTY_KEYS` — that's intentional and stays.

We add forward-only aliases (`toTagLibKey("year")` → DATE) so code that has "year" can translate it. The reverse (`fromTagLibKey("DATE")`) stays as "date" since that's the canonical PropertyMap key.

---

## Task 1: Add Missing Properties Entries

**Files:**

- Modify: `src/constants/general-extended-properties.ts`
- Test: `tests/constants.test.ts`

**Step 1: Write failing tests**

In `tests/constants.test.ts`, add to the existing `describe("PROPERTIES")` block:

```typescript
it("should include totalTracks, totalDiscs, and compilation", () => {
  assertEquals(PROPERTIES.totalTracks.key, "TRACKTOTAL");
  assertEquals(PROPERTIES.totalDiscs.key, "DISCTOTAL");
  assertEquals(PROPERTIES.compilation.key, "COMPILATION");
});

it("should translate totalTracks, totalDiscs, compilation via toTagLibKey", () => {
  assertEquals(toTagLibKey("totalTracks"), "TRACKTOTAL");
  assertEquals(toTagLibKey("totalDiscs"), "DISCTOTAL");
  assertEquals(toTagLibKey("compilation"), "COMPILATION");
});

it("should reverse-translate TRACKTOTAL, DISCTOTAL, COMPILATION via fromTagLibKey", () => {
  assertEquals(fromTagLibKey("TRACKTOTAL"), "totalTracks");
  assertEquals(fromTagLibKey("DISCTOTAL"), "totalDiscs");
  assertEquals(fromTagLibKey("COMPILATION"), "compilation");
});
```

**Step 2: Run tests to verify failure**

Run: `deno test tests/constants.test.ts --filter "totalTracks|totalDiscs|compilation"`
Expected: FAIL — properties don't exist yet

**Step 3: Add entries to general-extended-properties.ts**

Add after the `bpm` entry (around line 67), before the Sorting Properties comment:

```typescript
totalTracks: {
  key: "TRACKTOTAL",
  description: "Total number of tracks on the album",
  type: "string" as const,
  supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
  mappings: {
    id3v2: { frame: "TRCK" },
    vorbis: "TRACKTOTAL",
    mp4: "trkn",
  },
},
totalDiscs: {
  key: "DISCTOTAL",
  description: "Total number of discs in the set",
  type: "string" as const,
  supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
  mappings: {
    id3v2: { frame: "TPOS" },
    vorbis: "DISCTOTAL",
    mp4: "disk",
  },
},
compilation: {
  key: "COMPILATION",
  description: "Whether the album is a compilation (various artists)",
  type: "boolean" as const,
  supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
  mappings: {
    id3v2: { frame: "TCMP" },
    vorbis: "COMPILATION",
    mp4: "cpil",
  },
},
```

**Step 4: Run tests to verify they pass**

Run: `deno test tests/constants.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/constants/general-extended-properties.ts tests/constants.test.ts
git commit -m "feat: add totalTracks, totalDiscs, compilation to PROPERTIES"
```

---

## Task 2: Add Forward-Only Aliases for year/track

**Files:**

- Modify: `src/constants/properties.ts`
- Test: `tests/constants.test.ts`

**Step 1: Write failing tests**

```typescript
it("should translate year to DATE via toTagLibKey (forward alias)", () => {
  assertEquals(toTagLibKey("year"), "DATE");
});

it("should translate track to TRACKNUMBER via toTagLibKey (forward alias)", () => {
  assertEquals(toTagLibKey("track"), "TRACKNUMBER");
});

it("should still translate date to DATE via toTagLibKey (canonical)", () => {
  assertEquals(toTagLibKey("date"), "DATE");
});

it("should still reverse DATE to date via fromTagLibKey (canonical stays)", () => {
  assertEquals(fromTagLibKey("DATE"), "date");
});
```

**Step 2: Run tests to verify failure**

Run: `deno test tests/constants.test.ts --filter "year to DATE|track to TRACKNUMBER"`
Expected: FAIL — `toTagLibKey("year")` currently returns "year" (pass-through)

**Step 3: Add forward aliases in properties.ts**

After the `for` loop that builds `_toTagLib` and `_fromTagLib` (around line 46), add:

```typescript
// Forward-only aliases: ExtendedTag field names that map to the same wire keys
// as their PropertyMap equivalents. Only added to _toTagLib (not _fromTagLib)
// so that fromTagLibKey("DATE") still returns "date" (the canonical PropertyMap key).
_toTagLib["year"] = "DATE";
_toTagLib["track"] = "TRACKNUMBER";
```

**Step 4: Run tests to verify they pass**

Run: `deno test tests/constants.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/constants/properties.ts tests/constants.test.ts
git commit -m "feat: add year/track forward aliases in toTagLibKey"
```

---

## Task 3: Replace VORBIS_TO_CAMEL/CAMEL_TO_VORBIS in Msgpack Codec

**Files:**

- Modify: `src/msgpack/decoder.ts`
- Modify: `src/msgpack/encoder.ts`
- Test: `src/msgpack/encoder.test.ts` (existing tests should still pass)

**Step 1: Run existing encoder/decoder tests as baseline**

Run: `deno test src/msgpack/encoder.test.ts`
Expected: All PASS (baseline)

**Step 2: Update decoder.ts**

Replace the import:

```typescript
// REMOVE:
import { VORBIS_TO_CAMEL } from "../types/metadata-mappings.ts";
// ADD:
import { fromTagLibKey } from "../constants/properties.ts";
```

Replace `normalizeTagKeys` function body (around line 134):

```typescript
function normalizeTagKeys(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    normalized[fromTagLibKey(key)] = value;
  }
  return normalized;
}
```

**Step 3: Update encoder.ts**

Replace the import:

```typescript
// REMOVE:
import { CAMEL_TO_VORBIS } from "../types/metadata-mappings.ts";
// ADD:
import { toTagLibKey } from "../constants/properties.ts";
```

Replace the key mapping in `encodeTagData` (around line 31):

```typescript
// REMOVE:
remapped[CAMEL_TO_VORBIS[key] ?? key] = value;
// ADD:
remapped[toTagLibKey(key)] = value;
```

**Step 4: Run tests**

Run: `deno test src/msgpack/encoder.test.ts`
Expected: All PASS

Run: `deno test tests/wasi-host.test.ts`
Expected: All 75 steps PASS (this exercises the full read/write roundtrip)

**Step 5: Commit**

```bash
git add src/msgpack/decoder.ts src/msgpack/encoder.ts
git commit -m "refactor: replace VORBIS_TO_CAMEL/CAMEL_TO_VORBIS with toTagLibKey/fromTagLibKey in msgpack codec"
```

---

## Task 4: Replace VORBIS_TO_CAMEL/CAMEL_TO_VORBIS in WasiFileHandle

**Files:**

- Modify: `src/runtime/wasi-adapter/file-handle.ts`
- Test: `tests/wasi-host.test.ts`, `tests/wasi-adapter-unit.test.ts`

**Step 1: Run baseline tests**

Run: `deno test tests/wasi-host.test.ts tests/wasi-adapter-unit.test.ts`
Expected: All PASS (baseline)

**Step 2: Update imports in file-handle.ts**

```typescript
// REMOVE:
import {
  CAMEL_TO_VORBIS,
  VORBIS_TO_CAMEL,
} from "../../types/metadata-mappings.ts";
// ADD:
import { fromTagLibKey, toTagLibKey } from "../../constants/properties.ts";
```

**Step 3: Replace all usages**

In `getProperties()` (line 197):

```typescript
// REMOVE:
const propKey = CAMEL_TO_VORBIS[key] ?? key;
// ADD:
const propKey = toTagLibKey(key);
```

In `setProperties()` (line 214):

```typescript
// REMOVE:
const camelKey = VORBIS_TO_CAMEL[key] ?? key;
// ADD:
const camelKey = fromTagLibKey(key);
```

In `getProperty()` (line 227):

```typescript
// REMOVE:
const mappedKey = VORBIS_TO_CAMEL[key] ?? key;
// ADD:
const mappedKey = fromTagLibKey(key);
```

In `setProperty()` (line 233):

```typescript
// REMOVE:
const mappedKey = VORBIS_TO_CAMEL[key] ?? key;
// ADD:
const mappedKey = fromTagLibKey(key);
```

In `removeMP4Item()` (line 269):

```typescript
// REMOVE:
delete this.tagData[VORBIS_TO_CAMEL[key] ?? key];
// ADD:
delete this.tagData[fromTagLibKey(key)];
```

**Step 4: Run tests**

Run: `deno test tests/wasi-host.test.ts tests/wasi-adapter-unit.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/runtime/wasi-adapter/file-handle.ts
git commit -m "refactor: replace VORBIS_TO_CAMEL/CAMEL_TO_VORBIS with toTagLibKey/fromTagLibKey in WasiFileHandle"
```

---

## Task 5: Replace VORBIS_TO_CAMEL/CAMEL_TO_VORBIS in tag-mapping.ts

**Files:**

- Modify: `src/utils/tag-mapping.ts`
- Test: `src/utils/tag-mapping.test.ts`

This task also partially addresses `taglib-wasm-hge` — `normalizeTagInput` will now produce ALL_CAPS keys via `toTagLibKey` instead of `CAMEL_TO_VORBIS`. The behavior is the same for fields in both maps, but `toTagLibKey` additionally handles fields only in PROPERTIES (remixedBy, language, publisher, etc.).

**Step 1: Run baseline tests**

Run: `deno test src/utils/tag-mapping.test.ts`
Expected: All PASS

**Step 2: Update imports**

```typescript
// REMOVE:
import {
  CAMEL_TO_VORBIS,
  VORBIS_TO_CAMEL,
} from "../types/metadata-mappings.ts";
// ADD:
import { fromTagLibKey, toTagLibKey } from "../constants/properties.ts";
```

**Step 3: Update mapPropertiesToExtendedTag**

Replace the mapping in the extended fields loop (around line 70):

```typescript
// REMOVE:
const camelKey = VORBIS_TO_CAMEL[key] ?? key;
// ADD:
const camelKey = fromTagLibKey(key);
```

**Step 4: Update normalizeTagInput**

Replace the key mapping in the extended fields loop (around line 122):

```typescript
// REMOVE:
const propKey = CAMEL_TO_VORBIS[field];
if (!propKey) continue;
// ADD:
const propKey = toTagLibKey(field);
if (
  propKey === field && !NUMERIC_FIELDS.has(field) && field !== "compilation"
) continue;
```

The guard `propKey === field` means the key wasn't translated (unknown field) — skip it. We also need to keep numeric fields and compilation that were previously in CAMEL_TO_VORBIS and are now in toTagLibKey.

Wait — after adding totalTracks, totalDiscs, compilation to PROPERTIES, `toTagLibKey("totalTracks")` returns "TRACKTOTAL" (not "totalTracks"), so `propKey !== field` and the guard passes. Same for discNumber, bpm, compilation. So the simpler guard works:

```typescript
const propKey = toTagLibKey(field);
if (propKey === field) continue;
```

This skips fields where toTagLibKey didn't translate (truly unknown). All known ExtendedTag fields are either in PROPERTIES or have a forward alias (year, track), so they translate.

**Step 5: Run tests**

Run: `deno test src/utils/tag-mapping.test.ts`
Expected: All PASS

Note: The test at line 114 ("should map extended string fields via CAMEL_TO_VORBIS") should be renamed to reflect the new implementation. Update the test description:

```typescript
// REMOVE:
it("should map extended string fields via CAMEL_TO_VORBIS", () => {
// ADD:
it("should map extended string fields to ALL_CAPS PropertyMap keys", () => {
```

**Step 6: Run full test suite**

Run: `deno test`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/utils/tag-mapping.ts src/utils/tag-mapping.test.ts
git commit -m "refactor: replace VORBIS_TO_CAMEL/CAMEL_TO_VORBIS with toTagLibKey/fromTagLibKey in tag-mapping"
```

---

## Task 6: Remove VORBIS_TO_CAMEL/CAMEL_TO_VORBIS Exports

**Files:**

- Modify: `src/types/metadata-mappings.ts`
- Test: Verify no remaining imports

**Step 1: Verify no remaining consumers**

Run: `grep -r "VORBIS_TO_CAMEL\|CAMEL_TO_VORBIS" src/ --include="*.ts" -l`
Expected: Only `src/types/metadata-mappings.ts` itself

If other files still import these, fix them first.

**Step 2: Remove the exports from metadata-mappings.ts**

Remove lines 232-249 (the VORBIS_TO_CAMEL/CAMEL_TO_VORBIS construction and the legacy "disc" alias):

```typescript
// REMOVE all of:
/** UPPERCASE PropertyMap key → camelCase ExtendedTag key */
export const VORBIS_TO_CAMEL: Record<string, string> = {};
/** camelCase ExtendedTag key → UPPERCASE PropertyMap key */
export const CAMEL_TO_VORBIS: Record<string, string> = {};
for (
  const [camel, mapping] of Object.entries(METADATA_MAPPINGS) as [
    string,
    { vorbis?: string },
  ][]
) {
  if (mapping.vorbis) {
    VORBIS_TO_CAMEL[mapping.vorbis] = camel;
    CAMEL_TO_VORBIS[camel] = mapping.vorbis;
  }
}
// C++ FIELD_MAP now sends DISCNUMBER as "discNumber" directly.
// Keep legacy "disc" → "discNumber" mapping for backwards compatibility with older binaries.
VORBIS_TO_CAMEL["disc"] = "discNumber";
```

Keep `METADATA_MAPPINGS` and `FieldMapping` — they're still useful for format-specific mapping data (id3v2 frames, mp4 atoms, etc.).

Add the legacy "disc" alias to `src/constants/properties.ts` (after the year/track aliases):

```typescript
// Legacy: older C++ binaries sent "disc" instead of "discNumber"
_fromTagLib["disc"] = "discNumber";
```

**Step 3: Run full test suite**

Run: `deno test`
Expected: All PASS

**Step 4: Run format and lint**

Run: `deno task fmt && deno task lint`
Expected: Clean

**Step 5: Commit**

```bash
git add src/types/metadata-mappings.ts src/constants/properties.ts
git commit -m "refactor!: remove VORBIS_TO_CAMEL/CAMEL_TO_VORBIS — single mapping source via PROPERTIES"
```

---

## Task 7: Update Tags Constant for New Properties

**Files:**

- Modify: `src/constants/tags.ts`
- Test: `tests/constants.test.ts`

Now that totalTracks, totalDiscs, and compilation are in PROPERTIES with proper translation, update their Tags entries from ALL_CAPS pass-through to camelCase.

**Step 1: Check current Tags values**

Currently in tags.ts, these fields don't exist or use ALL_CAPS. After this task, they should use camelCase PropertyKeys matching their PROPERTIES entries.

**Step 2: Add or update Tags entries**

If `TotalTracks`, `TotalDiscs`, `Compilation` entries don't exist in Tags, add them. If they exist with ALL_CAPS values, update:

```typescript
TotalTracks: "totalTracks",
TotalDiscs: "totalDiscs",
Compilation: "compilation",
```

**Step 3: Run tests**

Run: `deno test tests/constants.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/constants/tags.ts tests/constants.test.ts
git commit -m "feat: add TotalTracks, TotalDiscs, Compilation to Tags constant"
```

---

## Verification

After all tasks, run:

```bash
deno task test        # Full check: format, lint, typecheck, tests
```

All tests must pass. Then verify the mapping unification:

```bash
# Should return NO results (all consumers removed)
grep -r "VORBIS_TO_CAMEL\|CAMEL_TO_VORBIS" src/ --include="*.ts" | grep -v metadata-mappings.ts
```

### Downstream Issues Unblocked

- **taglib-wasm-hge**: `normalizeTagInput` now uses `toTagLibKey` (Task 5). The remaining work is to make it produce camelCase keys for ALL fields (not just basic ones).
- **taglib-wasm-n40**: WasiFileHandle now uses `fromTagLibKey`/`toTagLibKey` (Task 4). The double-translation can be optimized by having BaseAudioFileImpl pass camelCase keys directly when it knows the handle supports them.
