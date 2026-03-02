# Unified camelCase Property API

## Problem

The `AudioFile` interface has 52 methods and growing. 26 are convenience getter/setter pairs (`getMusicBrainzTrackId()`, `setReplayGainTrackGain()`, etc.) that delegate to `getProperty()`/`setProperty()`. These are redundant given the typed `PropertyKey` overloads already provide IDE autocomplete and type safety.

Additionally, the codebase has three vocabularies for the same fields:

| Source                         | Key for MusicBrainz Track ID |
| ------------------------------ | ---------------------------- |
| `PROPERTIES` constant          | `MUSICBRAINZ_TRACKID`        |
| `ExtendedTag` / `TagInput`     | `musicbrainzTrackId`         |
| `AudioFile` convenience method | `getMusicBrainzTrackId()`    |

## Decision

1. Remove all 26 convenience methods from the `AudioFile` interface
2. Unify on camelCase property keys derived from a single source of truth (`PROPERTIES`)
3. Translate keys at the Wasm boundary (camelCase <-> ALL_CAPS)
4. Derive `ExtendedTag` and `TagInput` field types from `PROPERTIES`

## Design

### Single source of truth: PROPERTIES

Change `PROPERTIES` object keys from ALL_CAPS to camelCase. Each entry retains a `key` field with the TagLib wire name:

```typescript
export const PROPERTIES = {
  title:              { key: "TITLE", ... },
  artist:             { key: "ARTIST", ... },
  musicbrainzTrackId: { key: "MUSICBRAINZ_TRACKID", ... },
  replayGainTrackGain:{ key: "REPLAYGAIN_TRACK_GAIN", ... },
  appleSoundCheck:    { key: "ITUNNORM", ... },
  ...
} as const;
```

`PropertyKey` remains `keyof typeof PROPERTIES` but now produces camelCase literals.

### Complete key mapping

| camelCase (public API)      | TagLib wire key (internal)   | Notes                        |
| --------------------------- | ---------------------------- | ---------------------------- |
| `title`                     | `TITLE`                      |                              |
| `artist`                    | `ARTIST`                     |                              |
| `album`                     | `ALBUM`                      |                              |
| `date`                      | `DATE`                       |                              |
| `trackNumber`               | `TRACKNUMBER`                |                              |
| `genre`                     | `GENRE`                      |                              |
| `comment`                   | `COMMENT`                    |                              |
| `albumArtist`               | `ALBUMARTIST`                |                              |
| `composer`                  | `COMPOSER`                   |                              |
| `copyright`                 | `COPYRIGHT`                  |                              |
| `encodedBy`                 | `ENCODEDBY`                  |                              |
| `discNumber`                | `DISCNUMBER`                 |                              |
| `bpm`                       | `BPM`                        |                              |
| `titleSort`                 | `TITLESORT`                  |                              |
| `artistSort`                | `ARTISTSORT`                 |                              |
| `albumSort`                 | `ALBUMSORT`                  |                              |
| `lyricist`                  | `LYRICIST`                   |                              |
| `conductor`                 | `CONDUCTOR`                  |                              |
| `remixedBy`                 | `REMIXEDBY`                  |                              |
| `language`                  | `LANGUAGE`                   |                              |
| `publisher`                 | `PUBLISHER`                  |                              |
| `mood`                      | `MOOD`                       |                              |
| `media`                     | `MEDIA`                      |                              |
| `grouping`                  | `GROUPING`                   |                              |
| `work`                      | `WORK`                       |                              |
| `lyrics`                    | `LYRICS`                     |                              |
| `isrc`                      | `ISRC`                       |                              |
| `catalogNumber`             | `CATALOGNUMBER`              |                              |
| `barcode`                   | `BARCODE`                    |                              |
| `musicbrainzArtistId`       | `MUSICBRAINZ_ARTISTID`       |                              |
| `musicbrainzReleaseId`      | `MUSICBRAINZ_ALBUMID`        | Uses MusicBrainz terminology |
| `musicbrainzTrackId`        | `MUSICBRAINZ_TRACKID`        |                              |
| `musicbrainzReleaseGroupId` | `MUSICBRAINZ_RELEASEGROUPID` |                              |
| `replayGainTrackGain`       | `REPLAYGAIN_TRACK_GAIN`      |                              |
| `replayGainTrackPeak`       | `REPLAYGAIN_TRACK_PEAK`      |                              |
| `replayGainAlbumGain`       | `REPLAYGAIN_ALBUM_GAIN`      |                              |
| `replayGainAlbumPeak`       | `REPLAYGAIN_ALBUM_PEAK`      |                              |
| `acoustidFingerprint`       | `ACOUSTID_FINGERPRINT`       |                              |
| `acoustidId`                | `ACOUSTID_ID`                |                              |
| `appleSoundCheck`           | `ITUNNORM`                   | Friendly name                |

### Translation layer

Two lookup maps, generated once from `PROPERTIES` at module load:

```typescript
// Generated from PROPERTIES
const toTagLib: Record<string, string>; // musicbrainzTrackId -> MUSICBRAINZ_TRACKID
const fromTagLib: Record<string, string>; // MUSICBRAINZ_TRACKID -> musicbrainzTrackId
```

Applied in all four property methods:

- `getProperty(key)` — translate key to ALL_CAPS before Wasm call
- `setProperty(key, value)` — translate key to ALL_CAPS before Wasm call
- `properties()` — translate returned keys from ALL_CAPS to camelCase
- `setProperties(map)` — translate input keys from camelCase to ALL_CAPS before Wasm call

Unknown/custom keys pass through untranslated in both directions.

### Derived types

`ExtendedTag` and `TagInput` should derive their field names from `PropertyKey` rather than being hand-maintained interfaces. This eliminates drift between the vocabularies.

### AudioFile interface after (26 methods, down from 52)

```typescript
interface AudioFile {
  // Core (7)
  getFormat(): FileType;
  tag(): MutableTag;
  audioProperties(): AudioProperties | undefined;
  isValid(): boolean;
  dispose(): void;
  [Symbol.dispose](): void;

  // Properties (4)
  getProperty<K extends PropertyKey>(key: K): PropertyValue<K> | undefined;
  getProperty(key: string): string | undefined;
  setProperty<K extends PropertyKey>(key: K, value: PropertyValue<K>): void;
  setProperty(key: string, value: string): void;
  properties(): PropertyMap;
  setProperties(properties: PropertyMap): void;

  // MP4-specific (4)
  isMP4(): boolean;
  getMP4Item(key: string): string | undefined;
  setMP4Item(key: string, value: string): void;
  removeMP4Item(key: string): void;

  // File I/O (3)
  save(): boolean;
  getFileBuffer(): Uint8Array;
  saveToFile(path?: string): Promise<void>;

  // Pictures (4)
  getPictures(): Picture[];
  setPictures(pictures: Picture[]): void;
  addPicture(picture: Picture): void;
  removePictures(): void;

  // Ratings (4)
  getRatings(): Rating[];
  setRatings(ratings: Rating[]): void;
  getRating(): number | undefined;
  setRating(rating: number, email?: string): void;
}
```

### What doesn't change

- `MutableTag` (`.tag()`) — basic tag access, 7 fields, independent of PropertyKey
- `readTags()` / `writeTags()` — already returns ExtendedTag with camelCase
- MP4 item methods — format-specific atom keys, separate concern
- Pictures/ratings methods — not property-key-based
- C++ shim — already has the field_map with both vocabularies

### Known discrepancies to resolve during implementation

1. `MUSICBRAINZ_ALBUMID` maps to `musicbrainzReleaseId` (not `musicbrainzAlbumId`) — intentional, uses MusicBrainz terminology
2. `ITUNNORM` maps to `appleSoundCheck` — intentional, user-friendly name
3. 9 PROPERTIES fields missing from ExtendedTag/TagInput (REMIXEDBY, LANGUAGE, PUBLISHER, MOOD, MEDIA, GROUPING, WORK, CATALOGNUMBER, BARCODE) — will be added when types are derived from PROPERTIES
4. 18 fields in `tags.ts` convenience constants not yet in PROPERTIES — out of scope for this change, tracked separately

## Files changed

| File                                           | Change                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `src/constants/basic-properties.ts`            | Rename keys to camelCase                                                |
| `src/constants/general-extended-properties.ts` | Rename keys to camelCase                                                |
| `src/constants/specialized-properties.ts`      | Rename keys to camelCase                                                |
| `src/constants/properties.ts`                  | Add translation map generation                                          |
| `src/taglib/audio-file-interface.ts`           | Remove 26 convenience methods                                           |
| `src/taglib/audio-file-extended.ts`            | Delete file                                                             |
| `src/taglib/audio-file-base.ts`                | Add key translation in getProperty/setProperty/properties/setProperties |
| `src/taglib/audio-file-impl.ts`                | Extend BaseAudioFileImpl directly                                       |
| `src/types/tags.ts`                            | Derive ExtendedTag/TagInput from PROPERTIES                             |
| Tests                                          | Update to use camelCase keys, remove convenience method tests           |
