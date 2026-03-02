# normalizeTagInput camelCase Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `normalizeTagInput` output consistent camelCase PropertyMap keys instead of ALL_CAPS for extended fields.

**Architecture:** Remove key translation (`toTagLibKey`) from `normalizeTagInput` so it becomes a pure value transformer. Key translation to ALL_CAPS already happens in `setProperties` (audio-file-base.ts:150-156). Clean up dead code (`TAG_FIELD_TO_PROPERTY` table, unused import).

**Tech Stack:** TypeScript, Deno test runner

**Design doc:** `docs/plans/2026-03-02-normalize-tag-input-camelcase-design.md`

---

### Task 1: Update tests to expect camelCase keys

**Files:**

- Modify: `src/utils/tag-mapping.test.ts:114-173`

**Step 1: Update test assertions for extended string fields**

Change the test at line 114 from asserting ALL_CAPS keys to camelCase keys:

```typescript
it("should map extended string fields to camelCase PropertyMap keys", () => {
  const result = normalizeTagInput({
    albumArtist: "VA",
    composer: ["Bach", "Handel"],
    conductor: "Karajan",
    lyricist: ["A", "B"],
  });
  assertEquals(result.albumArtist, ["VA"]);
  assertEquals(result.composer, ["Bach", "Handel"]);
  assertEquals(result.conductor, ["Karajan"]);
  assertEquals(result.lyricist, ["A", "B"]);
});
```

**Step 2: Update test assertions for numeric extended fields**

Change the test at line 127:

```typescript
it("should map numeric extended fields as string arrays", () => {
  const result = normalizeTagInput({
    discNumber: 2,
    totalTracks: 12,
    totalDiscs: 3,
    bpm: 128,
  });
  assertEquals(result.discNumber, ["2"]);
  assertEquals(result.totalTracks, ["12"]);
  assertEquals(result.totalDiscs, ["3"]);
  assertEquals(result.bpm, ["128"]);
});
```

**Step 3: Update numeric zero values test**

Change the test at line 140:

```typescript
it("should handle numeric 0 values", () => {
  const result = normalizeTagInput({ bpm: 0, discNumber: 0 });
  assertEquals(result.bpm, ["0"]);
  assertEquals(result.discNumber, ["0"]);
});
```

**Step 4: Update compilation tests**

Change the tests at lines 146-154:

```typescript
it("should map compilation true to '1'", () => {
  const result = normalizeTagInput({ compilation: true });
  assertEquals(result.compilation, ["1"]);
});

it("should map compilation false to '0'", () => {
  const result = normalizeTagInput({ compilation: false });
  assertEquals(result.compilation, ["0"]);
});
```

**Step 5: Update empty array pass-through test**

Change the test at line 156:

```typescript
it("should pass through empty arrays", () => {
  const result = normalizeTagInput({ albumArtist: [] });
  assertEquals(result.albumArtist, []);
});
```

**Step 6: Update MusicBrainz and ReplayGain test**

Change the test at line 166:

```typescript
it("should map MusicBrainz and ReplayGain fields", () => {
  const result = normalizeTagInput({
    musicbrainzTrackId: "abc-123",
    replayGainTrackGain: "-6.54 dB",
  });
  assertEquals(result.musicbrainzTrackId, ["abc-123"]);
  assertEquals(result.replayGainTrackGain, ["-6.54 dB"]);
});
```

**Step 7: Run tests to verify they fail**

Run: `deno test src/utils/tag-mapping.test.ts`
Expected: FAIL — tests expect camelCase keys but `normalizeTagInput` still outputs ALL_CAPS.

**Step 8: Commit failing tests**

```bash
git add src/utils/tag-mapping.test.ts
git commit -m "test: expect camelCase keys from normalizeTagInput (failing)"
```

---

### Task 2: Fix normalizeTagInput to output camelCase keys

**Files:**

- Modify: `src/utils/tag-mapping.ts:91-133`

**Step 1: Simplify the basic string fields loop**

Replace line 106 (`const propKey = TAG_FIELD_TO_PROPERTY[field];`) and line 107 (`props[propKey] = ...`) with:

```typescript
props[field] = Array.isArray(val) ? val : [val];
```

The `TAG_FIELD_TO_PROPERTY` lookup is identity for these 5 fields (title, artist, album, comment, genre), so use `field` directly.

**Step 2: Fix the extended fields loop**

Replace lines 116-130 with:

```typescript
for (const [field, val] of Object.entries(input)) {
  if (BASIC_FIELDS.has(field) || val === undefined) continue;

  if (field === "compilation") {
    props[field] = [val ? "1" : "0"];
  } else if (NUMERIC_FIELDS.has(field)) {
    props[field] = [String(val)];
  } else if (typeof val === "string") {
    props[field] = [val];
  } else if (Array.isArray(val)) {
    props[field] = val;
  }
}
```

Changes from original:

- Removed `const propKey = toTagLibKey(field);` — no more ALL_CAPS translation
- Removed `if (propKey === field) continue;` — no more silent field dropping
- Changed `props[propKey]` to `props[field]` in all branches — keep camelCase

**Step 3: Run tests to verify they pass**

Run: `deno test src/utils/tag-mapping.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/utils/tag-mapping.ts
git commit -m "fix: normalizeTagInput outputs camelCase PropertyMap keys"
```

---

### Task 3: Remove dead code

**Files:**

- Modify: `src/utils/tag-mapping.ts:1-23`

**Step 1: Remove TAG_FIELD_TO_PROPERTY**

Delete lines 15-23 (the `TAG_FIELD_TO_PROPERTY` constant). It is no longer referenced anywhere.

**Step 2: Remove toTagLibKey from import**

Change line 3 from:

```typescript
import { fromTagLibKey, toTagLibKey } from "../constants/properties.ts";
```

to:

```typescript
import { fromTagLibKey } from "../constants/properties.ts";
```

`toTagLibKey` is no longer used in this file. `fromTagLibKey` is still used by `mapPropertiesToExtendedTag` (line 67).

**Step 3: Run tests**

Run: `deno test src/utils/tag-mapping.test.ts`
Expected: All tests PASS

**Step 4: Run full test suite**

Run: `deno task test`
Expected: All checks pass (format, lint, typecheck, all tests)

**Step 5: Commit**

```bash
git add src/utils/tag-mapping.ts
git commit -m "refactor: remove dead TAG_FIELD_TO_PROPERTY table and unused import"
```

---

### Task 4: Format, lint, final verification

**Step 1: Format**

Run: `deno task fmt`

**Step 2: Lint**

Run: `deno task lint`

**Step 3: Full test suite**

Run: `deno task test`
Expected: All checks pass

**Step 4: Commit any formatting changes**

```bash
git add src/utils/tag-mapping.ts src/utils/tag-mapping.test.ts
git commit -m "chore: format normalizeTagInput changes"
```
