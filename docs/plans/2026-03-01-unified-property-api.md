# Unified camelCase Property API — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace 26 convenience methods with typed camelCase `getProperty()`/`setProperty()`, unifying all property key vocabularies under a single `PROPERTIES` source of truth.

**Architecture:** Rename PROPERTIES object keys from ALL_CAPS to camelCase (keeping `key` field as TagLib wire name). Generate bidirectional translation maps from PROPERTIES. Add translation in BaseAudioFileImpl's four property methods. Delete ExtendedAudioFileImpl and all convenience methods from the AudioFile interface. Update `Tags` constant, `tag-mapping.ts`, and WASI adapter to use the new maps. Update all tests.

**Tech Stack:** TypeScript, Deno

**Design doc:** `docs/plans/2026-03-01-unified-property-api-design.md`

---

### Task 1: Rename PROPERTIES keys to camelCase and generate translation maps

**Files:**

- Modify: `src/constants/basic-properties.ts`
- Modify: `src/constants/general-extended-properties.ts`
- Modify: `src/constants/specialized-properties.ts`
- Modify: `src/constants/properties.ts`
- Test: `tests/constants.test.ts`

**Step 1: Write failing test for translation maps**

Add to `tests/constants.test.ts`:

```typescript
import {
  fromTagLibKey,
  PROPERTIES,
  type PropertyKey,
  toTagLibKey,
} from "../src/constants/properties.ts";

describe("Property key translation", () => {
  it("toTagLibKey translates known camelCase keys to ALL_CAPS", () => {
    assertEquals(toTagLibKey("title"), "TITLE");
    assertEquals(toTagLibKey("musicbrainzTrackId"), "MUSICBRAINZ_TRACKID");
    assertEquals(toTagLibKey("replayGainTrackGain"), "REPLAYGAIN_TRACK_GAIN");
    assertEquals(toTagLibKey("appleSoundCheck"), "ITUNNORM");
    assertEquals(toTagLibKey("musicbrainzReleaseId"), "MUSICBRAINZ_ALBUMID");
  });

  it("fromTagLibKey translates ALL_CAPS to camelCase", () => {
    assertEquals(fromTagLibKey("TITLE"), "title");
    assertEquals(fromTagLibKey("MUSICBRAINZ_TRACKID"), "musicbrainzTrackId");
    assertEquals(fromTagLibKey("REPLAYGAIN_TRACK_GAIN"), "replayGainTrackGain");
    assertEquals(fromTagLibKey("ITUNNORM"), "appleSoundCheck");
    assertEquals(fromTagLibKey("MUSICBRAINZ_ALBUMID"), "musicbrainzReleaseId");
  });

  it("unknown keys pass through untranslated", () => {
    assertEquals(toTagLibKey("MY_CUSTOM_TAG"), "MY_CUSTOM_TAG");
    assertEquals(fromTagLibKey("MY_CUSTOM_TAG"), "MY_CUSTOM_TAG");
  });

  it("PROPERTIES keys are camelCase", () => {
    for (const key of Object.keys(PROPERTIES)) {
      assertEquals(
        key[0],
        key[0].toLowerCase(),
        `Key "${key}" should start lowercase`,
      );
      assertEquals(
        key.includes("_"),
        false,
        `Key "${key}" should not contain underscores`,
      );
    }
  });

  it("every PROPERTIES entry has a key field with ALL_CAPS TagLib wire name", () => {
    for (const [camelKey, meta] of Object.entries(PROPERTIES)) {
      assertExists(
        (meta as { key: string }).key,
        `${camelKey} missing key field`,
      );
      assertEquals(
        (meta as { key: string }).key,
        (meta as { key: string }).key.toUpperCase(),
        `${camelKey}.key should be ALL_CAPS`,
      );
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `deno test tests/constants.test.ts`
Expected: FAIL — `toTagLibKey` and `fromTagLibKey` not exported, PROPERTIES keys still ALL_CAPS.

**Step 3: Rename keys in all three property files**

In `src/constants/basic-properties.ts`, rename object keys:

| Old key       | New key       |
| ------------- | ------------- |
| `TITLE`       | `title`       |
| `ARTIST`      | `artist`      |
| `ALBUM`       | `album`       |
| `DATE`        | `date`        |
| `TRACKNUMBER` | `trackNumber` |
| `GENRE`       | `genre`       |
| `COMMENT`     | `comment`     |

In `src/constants/general-extended-properties.ts`:

| Old key         | New key         |
| --------------- | --------------- |
| `ALBUMARTIST`   | `albumArtist`   |
| `COMPOSER`      | `composer`      |
| `COPYRIGHT`     | `copyright`     |
| `ENCODEDBY`     | `encodedBy`     |
| `DISCNUMBER`    | `discNumber`    |
| `BPM`           | `bpm`           |
| `TITLESORT`     | `titleSort`     |
| `ARTISTSORT`    | `artistSort`    |
| `ALBUMSORT`     | `albumSort`     |
| `LYRICIST`      | `lyricist`      |
| `CONDUCTOR`     | `conductor`     |
| `REMIXEDBY`     | `remixedBy`     |
| `LANGUAGE`      | `language`      |
| `PUBLISHER`     | `publisher`     |
| `MOOD`          | `mood`          |
| `MEDIA`         | `media`         |
| `GROUPING`      | `grouping`      |
| `WORK`          | `work`          |
| `LYRICS`        | `lyrics`        |
| `ISRC`          | `isrc`          |
| `CATALOGNUMBER` | `catalogNumber` |
| `BARCODE`       | `barcode`       |

In `src/constants/specialized-properties.ts`:

| Old key                      | New key                     |
| ---------------------------- | --------------------------- |
| `MUSICBRAINZ_ARTISTID`       | `musicbrainzArtistId`       |
| `MUSICBRAINZ_ALBUMID`        | `musicbrainzReleaseId`      |
| `MUSICBRAINZ_TRACKID`        | `musicbrainzTrackId`        |
| `MUSICBRAINZ_RELEASEGROUPID` | `musicbrainzReleaseGroupId` |
| `REPLAYGAIN_TRACK_GAIN`      | `replayGainTrackGain`       |
| `REPLAYGAIN_TRACK_PEAK`      | `replayGainTrackPeak`       |
| `REPLAYGAIN_ALBUM_GAIN`      | `replayGainAlbumGain`       |
| `REPLAYGAIN_ALBUM_PEAK`      | `replayGainAlbumPeak`       |
| `ACOUSTID_FINGERPRINT`       | `acoustidFingerprint`       |
| `ACOUSTID_ID`                | `acoustidId`                |
| `ITUNNORM`                   | `appleSoundCheck`           |

**Important:** Each entry retains its `key` field with the original ALL_CAPS TagLib wire name. Example:

```typescript
musicbrainzReleaseId: {
    key: "MUSICBRAINZ_ALBUMID",  // TagLib wire name unchanged
    description: "MusicBrainz Release ID (UUID)",
    type: "string" as const,
    // ...
},
```

**Step 4: Add translation functions to `src/constants/properties.ts`**

```typescript
// Build bidirectional lookup maps from PROPERTIES
const _toTagLib: Record<string, string> = {};
const _fromTagLib: Record<string, string> = {};
for (const [camelKey, meta] of Object.entries(PROPERTIES)) {
  const wireKey = (meta as { key: string }).key;
  _toTagLib[camelKey] = wireKey;
  _fromTagLib[wireKey] = camelKey;
}

/** Translate a camelCase property key to TagLib's ALL_CAPS wire key. Unknown keys pass through. */
export function toTagLibKey(key: string): string {
  return _toTagLib[key] ?? key;
}

/** Translate a TagLib ALL_CAPS wire key to a camelCase property key. Unknown keys pass through. */
export function fromTagLibKey(key: string): string {
  return _fromTagLib[key] ?? key;
}
```

**Step 5: Update `src/constants/utilities.ts`**

Any references to PROPERTIES keys (e.g., in `isValidProperty`) should work unchanged since `PropertyKey` is derived from `keyof typeof PROPERTIES`.

**Step 6: Run tests to verify they pass**

Run: `deno test tests/constants.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
deno task fmt && deno task lint
git add src/constants/ tests/constants.test.ts
git commit -m "refactor!: rename PROPERTIES keys to camelCase, add translation maps"
```

---

### Task 2: Add key translation to BaseAudioFileImpl

**Files:**

- Modify: `src/taglib/audio-file-base.ts`

**Step 1: Write failing test for camelCase property access**

Add to `tests/extended-metadata.test.ts` (temporarily alongside existing tests):

```typescript
it("getProperty/setProperty accept camelCase keys", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.mp3);
  const file = await taglib.open(buffer);

  file.setProperty(
    "musicbrainzTrackId",
    TEST_EXTENDED_METADATA.musicbrainzTrackId,
  );
  file.save();

  assertEquals(
    file.getProperty("musicbrainzTrackId"),
    TEST_EXTENDED_METADATA.musicbrainzTrackId,
  );

  file.dispose();
});

it("properties() returns camelCase keys", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.flac);
  const file = await taglib.open(buffer);

  file.setProperty(
    "musicbrainzTrackId",
    TEST_EXTENDED_METADATA.musicbrainzTrackId,
  );
  file.save();

  const props = file.properties();
  assertEquals(props["musicbrainzTrackId"], [
    TEST_EXTENDED_METADATA.musicbrainzTrackId,
  ]);
  assertEquals(props["MUSICBRAINZ_TRACKID"], undefined);

  file.dispose();
});

it("setProperties() accepts camelCase keys", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.flac);
  const file = await taglib.open(buffer);

  file.setProperties({
    title: ["Test Title"],
    musicbrainzTrackId: [TEST_EXTENDED_METADATA.musicbrainzTrackId],
  });
  file.save();

  assertEquals(file.getProperty("title"), "Test Title");
  assertEquals(
    file.getProperty("musicbrainzTrackId"),
    TEST_EXTENDED_METADATA.musicbrainzTrackId,
  );

  file.dispose();
});
```

**Step 2: Run test to verify it fails**

Run: `deno test tests/extended-metadata.test.ts`
Expected: FAIL — `getProperty("musicbrainzTrackId")` returns `undefined` (no translation layer yet).

**Step 3: Add translation to BaseAudioFileImpl**

In `src/taglib/audio-file-base.ts`, import `toTagLibKey` and `fromTagLibKey`:

```typescript
import { fromTagLibKey, toTagLibKey } from "../constants/properties.ts";
```

Update the four property methods:

```typescript
getProperty(key: string): string | undefined {
  const value = this.handle.getProperty(toTagLibKey(key));
  return value === "" ? undefined : value;
}

setProperty(key: string, value: string): void {
  this.handle.setProperty(toTagLibKey(key), value);
}

properties(): PropertyMap {
  const jsObj = this.handle.getProperties();
  const result: PropertyMap = {};
  for (const key of Object.keys(jsObj)) {
    result[fromTagLibKey(key)] = jsObj[key];
  }
  return result;
}

setProperties(properties: PropertyMap): void {
  const translated: PropertyMap = {};
  for (const [key, values] of Object.entries(properties)) {
    translated[toTagLibKey(key)] = values;
  }
  this.handle.setProperties(translated);
}
```

**Step 4: Run tests to verify they pass**

Run: `deno test tests/extended-metadata.test.ts`
Expected: New tests PASS. Some old tests may fail (they use ALL_CAPS keys in assertions like `properties["MUSICBRAINZ_TRACKID"]`) — that's expected, we fix them in Task 5.

**Step 5: Commit**

```bash
deno task fmt
git add src/taglib/audio-file-base.ts tests/extended-metadata.test.ts
git commit -m "feat!: add camelCase key translation in getProperty/setProperty/properties"
```

---

### Task 3: Remove convenience methods and ExtendedAudioFileImpl

**Files:**

- Modify: `src/taglib/audio-file-interface.ts` — remove 26 convenience methods
- Delete: `src/taglib/audio-file-extended.ts`
- Modify: `src/taglib/audio-file-impl.ts` — extend `BaseAudioFileImpl` directly

**Step 1: Remove convenience methods from AudioFile interface**

In `src/taglib/audio-file-interface.ts`, delete lines 105-181 (all `getMusicBrainz*`, `setMusicBrainz*`, `getAcoustId*`, `setAcoustId*`, `getReplayGain*`, `setReplayGain*`, `getTotalTracks`, `setTotalTracks`, `getTotalDiscs`, `setTotalDiscs`, `getAppleSoundCheck`, `setAppleSoundCheck`).

**Step 2: Delete `src/taglib/audio-file-extended.ts`**

This file is no longer needed — all 26 methods are removed.

**Step 3: Update AudioFileImpl to extend BaseAudioFileImpl**

In `src/taglib/audio-file-impl.ts`:

- Change import: remove `ExtendedAudioFileImpl`, keep other imports
- Change class declaration: `extends BaseAudioFileImpl implements AudioFile`

```typescript
import { BaseAudioFileImpl } from "./audio-file-base.ts";
// ... (remove ExtendedAudioFileImpl import)

export class AudioFileImpl extends BaseAudioFileImpl implements AudioFile {
```

**Step 4: Run typecheck to verify no type errors**

Run: `deno task lint` (includes typecheck)
Expected: PASS — no references to deleted methods remain in the interface.

**Step 5: Commit**

```bash
deno task fmt
git add src/taglib/audio-file-interface.ts src/taglib/audio-file-impl.ts
git rm src/taglib/audio-file-extended.ts
git commit -m "refactor!: remove 26 convenience methods, delete ExtendedAudioFileImpl"
```

---

### Task 4: Update Tags constant and tag-mapping.ts

**Files:**

- Modify: `src/constants/tags.ts` — values become camelCase PropertyKeys
- Modify: `src/utils/tag-mapping.ts` — use `toTagLibKey`/`fromTagLibKey` instead of hand-rolled maps
- Modify: `src/types/metadata-mappings.ts` — replace `VORBIS_TO_CAMEL`/`CAMEL_TO_VORBIS` with `toTagLibKey`/`fromTagLibKey`

**Step 1: Update `src/constants/tags.ts`**

Change `Tags` constant values from ALL_CAPS TagLib keys to camelCase PropertyKeys:

```typescript
export const Tags = {
  Title: "title",
  Artist: "artist",
  Album: "album",
  Date: "date",
  TrackNumber: "trackNumber",
  Genre: "genre",
  Comment: "comment",
  AlbumArtist: "albumArtist",
  Composer: "composer",
  // ... etc
  MusicBrainzTrackId: "musicbrainzTrackId",
  MusicBrainzReleaseId: "musicbrainzReleaseId",
  // ... etc
} as const;
```

**Step 2: Update `src/utils/tag-mapping.ts`**

Replace `BASIC_PROPERTY_KEYS`, `TAG_FIELD_TO_PROPERTY` hand-rolled maps and `VORBIS_TO_CAMEL`/`CAMEL_TO_VORBIS` imports with `toTagLibKey`/`fromTagLibKey` from the PROPERTIES module.

In `mapPropertiesToExtendedTag()`: keys coming from `properties()` are already camelCase (Task 2 handles that), so `VORBIS_TO_CAMEL` lookup is no longer needed. The function reads camelCase keys directly.

In `normalizeTagInput()`: translate camelCase keys to TagLib wire keys using `toTagLibKey()` before building the PropertyMap.

**Step 3: Update `src/types/metadata-mappings.ts`**

Remove `VORBIS_TO_CAMEL` and `CAMEL_TO_VORBIS` exports. These are replaced by `toTagLibKey`/`fromTagLibKey` from `properties.ts`. Keep `METADATA_MAPPINGS` if still used elsewhere.

**Step 4: Update WASI adapter `src/runtime/wasi-adapter/file-handle.ts`**

Replace `VORBIS_TO_CAMEL` imports with `toTagLibKey`/`fromTagLibKey`. The WASI adapter's `getProperty`/`setProperty`/`getProperties`/`setProperties` methods need the same translation logic. Since the WASI adapter stores data internally in camelCase (from msgpack), check whether translation is still needed or if it becomes a no-op.

**Step 5: Run tests**

Run: `deno test`
Expected: Many test failures from ALL_CAPS key usage in tests — that's expected, fixed in Task 5.

**Step 6: Commit**

```bash
deno task fmt && deno task lint
git add src/constants/tags.ts src/utils/tag-mapping.ts src/types/metadata-mappings.ts src/runtime/wasi-adapter/file-handle.ts
git commit -m "refactor!: unify tag-mapping and Tags constant to use camelCase PropertyKeys"
```

---

### Task 5: Update all tests to use camelCase keys

**Files:**

- Modify: `tests/extended-metadata.test.ts`
- Modify: `tests/wasi-host.test.ts`
- Modify: `tests/wasi-adapter-unit.test.ts`
- Modify: `tests/multi-value-tags.test.ts`
- Modify: `tests/taglib.test.ts`
- Modify: `tests/taglib-class-coverage.test.ts`
- Modify: `tests/tag-operations-errors.test.ts`
- Modify: `tests/simple-api-unit.test.ts`
- Modify: `tests/constants.test.ts`
- Modify: `src/msgpack/encoder.test.ts`
- Modify: `src/msgpack/decoder.test.ts`
- Modify: `tests/backend-adapter.ts`

**Step 1: Update `tests/extended-metadata.test.ts`**

Replace all convenience method calls with `getProperty()`/`setProperty()`:

| Old                                   | New                                                    |
| ------------------------------------- | ------------------------------------------------------ |
| `file.setMusicBrainzTrackId(v)`       | `file.setProperty("musicbrainzTrackId", v)`            |
| `file.getMusicBrainzTrackId()`        | `file.getProperty("musicbrainzTrackId")`               |
| `file.setReplayGainTrackGain(v)`      | `file.setProperty("replayGainTrackGain", v)`           |
| `file.getReplayGainTrackGain()`       | `file.getProperty("replayGainTrackGain")`              |
| `file.setAcoustIdFingerprint(v)`      | `file.setProperty("acoustidFingerprint", v)`           |
| `file.getAcoustIdFingerprint()`       | `file.getProperty("acoustidFingerprint")`              |
| `file.setTotalTracks(12)`             | `file.setProperty("totalTracks", "12")`                |
| `file.getTotalTracks()`               | `file.getProperty("totalTracks")` (returns string now) |
| `file.setAppleSoundCheck(v)`          | `file.setProperty("appleSoundCheck", v)`               |
| `file.getAppleSoundCheck()`           | `file.getProperty("appleSoundCheck")`                  |
| `properties["MUSICBRAINZ_TRACKID"]`   | `properties["musicbrainzTrackId"]`                     |
| `properties["REPLAYGAIN_TRACK_GAIN"]` | `properties["replayGainTrackGain"]`                    |
| `properties["ACOUSTID_FINGERPRINT"]`  | `properties["acoustidFingerprint"]`                    |
| `properties["ITUNESOUNDCHECK"]`       | `properties["appleSoundCheck"]`                        |

**Note on totalTracks/totalDiscs:** The convenience methods did numeric parsing (`getTotalTracks()` returned `number | undefined`). With `getProperty()`, the return is `string | undefined`. Tests should compare against `"12"` not `12`. Users who need numeric values use `parseInt(file.getProperty("totalTracks"))`.

**Note on Apple Sound Check:** The convenience method had special MP4 handling (using `getMP4Item("iTunNORM")`). After removal, `getProperty("appleSoundCheck")` goes through the standard property path. Verify this works for M4A files — the translation maps `appleSoundCheck` → `ITUNNORM` which TagLib handles. The MP4-specific `iTunNORM` atom path was a workaround that may no longer be needed. If M4A Sound Check tests fail, add the special handling in the translation layer.

**Step 2: Update remaining test files**

Replace ALL_CAPS keys with camelCase in:

- `tests/wasi-host.test.ts`: `{ TITLE: ["New Title"] }` → `{ title: ["New Title"] }` etc.
- `tests/wasi-adapter-unit.test.ts`: same pattern
- `tests/multi-value-tags.test.ts`: property key assertions
- `tests/taglib.test.ts`: property key assertions
- `tests/taglib-class-coverage.test.ts`: property key assertions
- `tests/simple-api-unit.test.ts`: property key assertions
- `tests/backend-adapter.ts`: property key assertions
- `src/msgpack/encoder.test.ts`: property key assertions
- `src/msgpack/decoder.test.ts`: property key assertions

**Step 3: Update examples**

- `examples/common/replaygain-soundcheck.ts`
- `examples/common/tag-constants.ts`
- `examples/common/automatic-tag-mapping.ts`
- `examples/bun/basic-usage.ts`
- `examples/fixed_show_tags_folder.ts`

**Step 4: Run full test suite**

Run: `deno task test`
Expected: ALL PASS

**Step 5: Commit**

```bash
deno task fmt && deno task lint
git add tests/ src/msgpack/*.test.ts examples/
git commit -m "test!: update all tests and examples to use camelCase property keys"
```

---

### Task 6: Clean up and verify

**Step 1: Run full check suite**

Run: `deno task test`
Expected: ALL PASS (format, lint, typecheck, tests)

**Step 2: Verify no ALL_CAPS property keys remain in public API**

Search for stale references:

```bash
# Should return only: PROPERTIES .key fields, C++ shim, TagLib wire format references
grep -rn '"MUSICBRAINZ_\|"REPLAYGAIN_\|"ACOUSTID_\|"ITUNNORM"\|"ITUNESOUNDCHECK"\|"TRACKTOTAL"\|"DISCTOTAL"' src/ tests/
```

Any matches outside of PROPERTIES `.key` fields and the C++ shim indicate missed updates.

**Step 3: Verify no references to deleted convenience methods**

```bash
grep -rn 'getMusicBrainz\|setMusicBrainz\|getAcoustId\|setAcoustId\|getReplayGain\|setReplayGain\|getTotalTracks\|setTotalTracks\|getTotalDiscs\|setTotalDiscs\|getAppleSoundCheck\|setAppleSoundCheck' src/ tests/
```

Expected: No matches.

**Step 4: Verify no references to deleted file**

```bash
grep -rn 'audio-file-extended\|ExtendedAudioFileImpl' src/ tests/
```

Expected: No matches.

**Step 5: Commit final cleanup**

```bash
deno task fmt && deno task lint
git add -A
git commit -m "chore: final cleanup for unified camelCase property API"
```

---

### Summary of breaking changes

| What changed                                                  | Migration                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `getMusicBrainzTrackId()` → removed                           | Use `getProperty("musicbrainzTrackId")`                                |
| All 26 convenience methods → removed                          | Use `getProperty()`/`setProperty()` with camelCase keys                |
| `properties()` returns camelCase keys                         | Change `props["MUSICBRAINZ_TRACKID"]` to `props["musicbrainzTrackId"]` |
| `setProperties()` accepts camelCase keys                      | Change `{ TITLE: ["..."] }` to `{ title: ["..."] }`                    |
| `Tags.MusicBrainzTrackId` value changed                       | Was `"MUSICBRAINZ_TRACKID"`, now `"musicbrainzTrackId"`                |
| `getTotalTracks()`/`getTotalDiscs()` numeric return → removed | Use `getProperty("totalTracks")` (returns string), parse manually      |
