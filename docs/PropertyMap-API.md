# Extended Metadata with PropertyMap API

`taglib-wasm` provides a **PropertyMap API** for handling extended metadata fields beyond the basic tags (title, artist, album, etc.). This allows you to access format-specific fields and custom metadata.

## 🎯 The PropertyMap API

The PropertyMap API provides a unified interface for reading and writing extended metadata:

```typescript
// Read all properties
const properties = file.properties();
console.log(properties); // { ALBUMARTIST: ["Various Artists"], BPM: ["120"], ... }

// Get a specific property
const acoustidId = file.getProperty("ACOUSTID_ID");

// Set a property
file.setProperty("ACOUSTID_FINGERPRINT", fingerprint);

// Set multiple properties at once
file.setProperties({
  ALBUMARTIST: ["Various Artists"],
  COMPOSER: ["Composer Name"],
  BPM: ["120"]
});
```

## 📝 Important Notes

- Property keys are typically uppercase (e.g., "ALBUMARTIST", "REPLAYGAIN_TRACK_GAIN")
- Property values in `setProperties()` must be arrays of strings
- Property keys may vary by format - check existing properties with `file.properties()`
- For MP4-specific metadata, use the `setMP4Item()` method

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

## 🚀 Usage Examples

### Basic AcoustID Handling

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
const file = taglib.openFile(audioBuffer);

// Set AcoustID data (works for ANY format)
file.setAcoustidFingerprint("AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");
file.setAcoustidId("e7359e88-f1f7-41ed-b9f6-16e58e906997");

// Read AcoustID data (works for ANY format)
const fingerprint = file.getAcoustidFingerprint();
const acoustidId = file.getAcoustidId();

console.log("AcoustID:", acoustidId);
console.log("Fingerprint:", fingerprint);
```

### MusicBrainz Integration

```typescript
// Set MusicBrainz identifiers
file.setMusicBrainzTrackId("f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab");
file.setMusicBrainzReleaseId("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
file.setMusicBrainzArtistId("12345678-90ab-cdef-1234-567890abcdef");

// These are automatically stored in the correct format-specific location
```

### Bulk Extended Metadata

```typescript
// Set multiple fields at once
file.setExtendedTag({
  // Basic fields
  title: "Song Title",
  artist: "Artist Name",
  album: "Album Name",

  // Advanced fields
  acoustidFingerprint: "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...",
  acoustidId: "e7359e88-f1f7-41ed-b9f6-16e58e906997",
  musicbrainzTrackId: "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
  albumArtist: "Album Artist",
  composer: "Composer Name",
  bpm: 120,
  compilation: true,
});

// Read all extended metadata
const extendedTags = file.extendedTag();
console.log("All metadata:", extendedTags);
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

The library automatically detects the audio format and uses the appropriate storage method:

1. **Format Detection**: Determine if file is MP3, FLAC, OGG, MP4, etc.
2. **Mapping Lookup**: Find the correct field mapping for that format
3. **Storage**: Use format-specific TagLib methods to store the data

### TagLib PropertyMap Integration

Advanced metadata uses TagLib's `PropertyMap` system for format-agnostic field access:

```cpp
// C++ implementation (conceptual)
TagLib::PropertyMap propertyMap = file->properties();
propertyMap["ACOUSTID_FINGERPRINT"] = TagLib::StringList(fingerprint);
file->setProperties(propertyMap);
```

## 🚧 Current Implementation Status

### ✅ Completed

- **Type Definitions**: Complete `ExtendedTag` interface
- **Mapping Configuration**: Full `METADATA_MAPPINGS` for all formats
- **API Design**: Format-agnostic method signatures
- **Documentation**: Complete usage examples and reference

### 🚧 In Progress

- **C++ PropertyMap Integration**: Requires additional C++ wrapper functions
- **Format-Specific Writers**: Need C++ functions for advanced field writing
- **Format-Specific Readers**: Need C++ functions for advanced field reading

### 📋 Next Steps

1. **Extend C++ Wrapper**: Add PropertyMap access functions
2. **Implement Field Writers**: Format-specific writing logic
3. **Implement Field Readers**: Format-specific reading logic
4. **Add WASM Exports**: Export new C++ functions to JavaScript
5. **Complete TypeScript Integration**: Wire up API methods to C++ calls

## 🎯 Benefits

### For Developers

- **Single API**: One method call works for all formats
- **No Format Knowledge**: Don't need to know ID3 frame names, Vorbis fields, etc.
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

This automatic tag mapping system represents **professional-grade audio metadata handling** that works seamlessly across all major audio formats. The format-agnostic approach eliminates the complexity of dealing with different metadata systems while ensuring proper, standards-compliant storage.
