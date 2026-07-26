# Extended Metadata with PropertyMap API

`taglib-wasm` provides a **PropertyMap API** for handling extended metadata
fields beyond the basic tags (title, artist, album, etc.). This allows you to
access format-specific fields and custom metadata.

## 🎯 The PropertyMap API

The PropertyMap API provides a unified interface for reading and writing
extended metadata:

```typescript
// Read all properties (keys are camelCase)
const properties = file.properties();
console.log(properties); // { albumArtist: ["Various Artists"], bpm: ["120"], ... }

// Get a specific property
const acoustidId = file.getProperty("ACOUSTID_ID");

// Set a property
file.setProperty("ACOUSTID_FINGERPRINT", fingerprint);

// Set multiple properties at once
file.setProperties({
  ALBUMARTIST: ["Various Artists"],
  COMPOSER: ["Composer Name"],
  BPM: ["120"],
});
```

### Using the PROPERTIES Constant for Type-Safe Access

The library provides a comprehensive `PROPERTIES` constant with metadata for all
known properties:

```typescript
import { PROPERTIES, PropertyKey } from "taglib-wasm";

// Access property metadata (keys are camelCase; `.key` is the ALL_CAPS wire name)
const titleProp = PROPERTIES.title;
console.log(titleProp.description); // "The title of the track"
console.log(titleProp.type); // "string"
console.log(titleProp.supportedFormats); // ["ID3v2", "MP4", "Vorbis", "WAV"]

// Use for type-safe property access
const title = file.getProperty(PROPERTIES.title.key);
const trackNumber = file.getProperty(PROPERTIES.trackNumber.key);

// Iterate through all known properties
Object.values(PROPERTIES).forEach((prop) => {
  const value = file.getProperty(prop.key);
  if (value !== undefined) {
    console.log(`${prop.key}: ${value} (${prop.description})`);
  }
});
```

## 📝 Important Notes

- Property keys use camelCase (e.g., "albumArtist", "replayGainTrackGain");
  `getProperty`/`setProperty`/`setProperties` also accept the ALL_CAPS TagLib
  wire names (e.g., "ALBUMARTIST")
- Property values in `setProperties()` must be arrays of strings
- The `PROPERTIES` constant from `taglib-wasm` provides:
  - Type-safe property keys
  - Rich metadata including descriptions and supported formats
  - Format-specific mappings (ID3v2 frames, Vorbis comments, MP4 atoms)
- Use utility functions for property discovery:
  - `isValidProperty(key)` - Check if a property key is valid
  - `getAllPropertyKeys()` - Get all available property keys
  - `getPropertiesByFormat(format)` - Get properties supported by a format
- For MP4-specific metadata, use the `setMP4Item()` method
- **Values are returned verbatim.** `properties()` is the raw text surface, so a
  `trackNumber` of `"03"` or `"3/12"` comes back exactly as stored rather than
  normalised to `"3"`. Zero-padding, a `"n/total"` pair and any other formatting
  the file uses are preserved, which is what lets a read-modify-write leave
  untouched fields byte-identical.
- **A combined pair is not split.** For a `trackNumber` of `"3/12"`,
  `properties()` reports the pair and does **not** synthesise a separate
  `totalTracks`. The typed surfaces do the narrowing instead — `readTags()`
  answers `trackNumber: "3/12"`, `track: 3` and `totalTracks: 12`, and
  `tag().track` answers `3`. Both backends behave identically here.
- **MP4 freeform atom casing is preserved.** Apple's atoms are written as
  `iTunNORM` and `iTunSMPB` rather than upper-cased, so other tools recognise
  them, and a save does not leave a duplicate under a second spelling.
- **Known limitation:** a freeform atom whose `mean` is not
  `com.apple.iTunes` (e.g. `----:com.acme.tool:MyTag`) is rewritten into the
  Apple namespace with an upper-cased name on the WASI backend. Emscripten
  handles it correctly. See `taglib-wkyi`.
- See [Tag Constants](./tag-constants.md) for the complete PROPERTIES reference

## 📋 Format-Specific Storage Reference

### AcoustID Fields

| Field           | MP3 (ID3v2)                                             | FLAC/OGG (Vorbis)      | MP4/M4A (Atoms)                              |
| --------------- | ------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| **Fingerprint** | `TXXX` frame with description: `"Acoustid Fingerprint"` | `ACOUSTID_FINGERPRINT` | `----:com.apple.iTunes:Acoustid Fingerprint` |
| **AcoustID**    | `TXXX` frame with description: `"Acoustid Id"`          | `ACOUSTID_ID`          | `----:com.apple.iTunes:Acoustid Id`          |

### MusicBrainz Fields

| Field                | MP3 (ID3v2)                                    | FLAC/OGG (Vorbis)            | MP4/M4A (Atoms)                                      |
| -------------------- | ---------------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| **Track ID**         | `UFID` frame: `"http://musicbrainz.org"`       | `MUSICBRAINZ_TRACKID`        | `----:com.apple.iTunes:MusicBrainz Track Id`         |
| **Release ID**       | `TXXX` frame: `"MusicBrainz Album Id"`         | `MUSICBRAINZ_ALBUMID`        | `----:com.apple.iTunes:MusicBrainz Album Id`         |
| **Artist ID**        | `TXXX` frame: `"MusicBrainz Artist Id"`        | `MUSICBRAINZ_ARTISTID`       | `----:com.apple.iTunes:MusicBrainz Artist Id`        |
| **Release Group ID** | `TXXX` frame: `"MusicBrainz Release Group Id"` | `MUSICBRAINZ_RELEASEGROUPID` | `----:com.apple.iTunes:MusicBrainz Release Group Id` |

### Extended Fields

| Field            | MP3 (ID3v2) | FLAC/OGG (Vorbis) | MP4/M4A (Atoms) |
| ---------------- | ----------- | ----------------- | --------------- |
| **Album Artist** | `TPE2`      | `ALBUMARTIST`     | `aART`          |
| **Composer**     | `TCOM`      | `COMPOSER`        | `©wrt`          |
| **BPM**          | `TBPM`      | `BPM`             | `tmpo`          |
| **Compilation**  | `TCMP`      | `COMPILATION`     | `cpil`          |

### Apple Fields

Both are freeform atoms on MP4, written with Apple's exact casing.

| Field                | MP3 (ID3v2)                | FLAC/OGG (Vorbis) | MP4/M4A (Atoms)                  |
| -------------------- | -------------------------- | ----------------- | -------------------------------- |
| **appleSoundCheck**  | `TXXX` frame: `"iTunNORM"` | `ITUNNORM`        | `----:com.apple.iTunes:iTunNORM` |
| **appleGaplessInfo** | `TXXX` frame: `"iTunSMPB"` | `ITUNSMPB`        | `----:com.apple.iTunes:iTunSMPB` |

`appleSoundCheck` carries Sound Check volume-normalization data;
`appleGaplessInfo` carries gapless-playback data (encoder delay and padding).

## 🚀 Usage Examples

### Basic AcoustID Handling

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open(audioBuffer);

// Set AcoustID data (works for ANY format)
file.setProperty("acoustidFingerprint", "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setProperty("acoustidId", "e7359e88-f1f7-41ed-b9f6-16e58e906997");

// Read AcoustID data (works for ANY format)
const fingerprint = file.getProperty("acoustidFingerprint");
const acoustidId = file.getProperty("acoustidId");

console.log("AcoustID:", acoustidId);
console.log("Fingerprint:", fingerprint);
```

### MusicBrainz Integration

```typescript
// Set MusicBrainz identifiers
file.setProperty("musicbrainzTrackId", "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");
file.setProperty(
  "musicbrainzReleaseId",
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
);
file.setProperty("musicbrainzArtistId", "12345678-90ab-cdef-1234-567890abcdef");

// These are automatically stored in the correct format-specific location
```

### Bulk Extended Metadata

```typescript
// Set many extended fields at once (values are string arrays)
file.setProperties({
  acoustidFingerprint: ["AQADtMmybfGO8NCNEESLnzHyXNOHeHnG..."],
  acoustidId: ["e7359e88-f1f7-41ed-b9f6-16e58e906997"],
  musicbrainzTrackId: ["f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab"],
  albumArtist: ["Album Artist"],
  composer: ["Composer Name"],
  bpm: ["120"],
  compilation: ["1"],
});

// Basic fields use the tag() setters
const tag = file.tag();
tag.setTitle("Song Title");
tag.setArtist("Artist Name");
tag.setAlbum("Album Name");

// Read all metadata back (camelCase keys)
const allProperties = file.properties();
console.log("All metadata:", allProperties);
```

## 🔧 Implementation Details

### Metadata Mapping System

The library uses a comprehensive mapping system defined in `METADATA_MAPPINGS`:

```typescript
export const METADATA_MAPPINGS: Record<keyof ExtendedTag, FieldMapping> = {
  acoustidFingerprint: {
    id3v2: { frame: "TXXX", description: "Acoustid Fingerprint" },
    vorbis: "ACOUSTID_FINGERPRINT",
    mp4: "----:com.apple.iTunes:Acoustid Fingerprint",
  },
  // ... more mappings
};
```

### Format Detection

The library automatically detects the audio format and uses the appropriate
storage method:

1. **Format Detection**: Determine if file is MP3, FLAC, OGG, MP4, etc.
2. **Mapping Lookup**: Find the correct field mapping for that format
3. **Storage**: Use format-specific TagLib methods to store the data

### TagLib PropertyMap Integration

Advanced metadata uses TagLib's `PropertyMap` system for format-agnostic field
access:

```cpp
// C++ implementation (conceptual)
TagLib::PropertyMap propertyMap = file->properties();
propertyMap["ACOUSTID_FINGERPRINT"] = TagLib::StringList(fingerprint);
file->setProperties(propertyMap);
```

## 🎯 Benefits

### For Developers

- **Single API**: One method call works for all formats
- **No Format Knowledge**: Don't need to know ID3 frame names, Vorbis fields,
  etc.
- **Consistent Behavior**: Same API regardless of audio format
- **Type Safety**: Full TypeScript support with auto-completion

### For Applications

- **Professional Metadata**: Proper storage following format conventions
- **MusicBrainz Compatible**: Follows MusicBrainz Picard conventions
- **AcoustID Ready**: Built-in support for audio fingerprinting
- **Future Proof**: Easy to add new advanced fields

## 📚 References

- [MusicBrainz Picard Tag Mappings](https://picard.musicbrainz.org/docs/mappings/)
- [ID3v2.4 Specification](https://id3.org/id3v2.4.0-frames)
- [Vorbis Comment Specification](https://xiph.org/vorbis/doc/v-comment.html)
- [MP4 Metadata Specification](https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/Metadata/Metadata.html)
- [AcoustID Documentation](https://acoustid.org/webservice)

---

This automatic tag mapping system represents **professional-grade audio metadata
handling** that works seamlessly across all major audio formats. The
format-agnostic approach eliminates the complexity of dealing with different
metadata systems while ensuring proper, standards-compliant storage.
