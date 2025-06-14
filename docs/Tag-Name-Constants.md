# TagLib Tag Name Constants and Cross-Format Mapping

This document provides a comprehensive reference for TagLib's standard tag names and how they map across different audio formats.

## Overview

TagLib uses a PropertyMap system to provide format-independent tag access. This allows you to use consistent tag names across different audio formats (MP3, MP4, FLAC, OGG, WAV, etc.).

## TypeScript Constants

taglib-wasm provides type-safe constants for all standard tag names via the `Tags` object:

```typescript
import { Tags } from "taglib-wasm";

// Use constants instead of strings for better IDE support
const title = properties[Tags.Title]?.[0];        // Instead of properties["TITLE"]
const artist = properties[Tags.Artist]?.[0];      // Instead of properties["ARTIST"]
const bpm = properties[Tags.Bpm]?.[0];           // Instead of properties["BPM"]

// Constants map to the standard property names
console.log(Tags.Title);         // "TITLE"
console.log(Tags.AlbumArtist);   // "ALBUMARTIST"
console.log(Tags.TrackGain);     // "REPLAYGAIN_TRACK_GAIN"
```

See the [tag-constants.ts example](../examples/tag-constants.ts) for a complete demonstration.

## Standard Property Names

These are the well-known property names defined in TagLib's PropertyMap (`tpropertymap.h`):

### Basic Tags

| Property Name | Description | Example |
|--------------|-------------|---------|
| `TITLE` | Track title | "Bohemian Rhapsody" |
| `ARTIST` | Track artist | "Queen" |
| `ALBUM` | Album name | "A Night at the Opera" |
| `ALBUMARTIST` | Album artist (for compilations) | "Various Artists" |
| `SUBTITLE` | Track subtitle | "Live Version" |
| `TRACKNUMBER` | Track number | "11" or "11/12" |
| `DISCNUMBER` | Disc number | "1" or "1/2" |
| `DATE` | Release date | "1975" or "1975-10-31" |
| `ORIGINALDATE` | Original release date | "1975" |
| `GENRE` | Musical genre | "Rock" |
| `COMMENT` | General comment | "Remastered edition" |

### Sort Names

| Property Name | Description |
|--------------|-------------|
| `TITLESORT` | Title for sorting |
| `ALBUMSORT` | Album name for sorting |
| `ARTISTSORT` | Artist name for sorting |
| `ALBUMARTISTSORT` | Album artist for sorting |
| `COMPOSERSORT` | Composer name for sorting |

### Credits

| Property Name | Description |
|--------------|-------------|
| `COMPOSER` | Track composer |
| `LYRICIST` | Lyrics writer |
| `CONDUCTOR` | Orchestra conductor |
| `REMIXER` | Track remixer |
| `PERFORMER:<instrument>` | Performer with instrument (e.g., `PERFORMER:VOCALS`) |

### Additional Metadata

| Property Name | Description |
|--------------|-------------|
| `ISRC` | International Standard Recording Code |
| `ASIN` | Amazon Standard Identification Number |
| `BPM` | Beats per minute |
| `COPYRIGHT` | Copyright notice |
| `ENCODEDBY` | Person/software that encoded the file |
| `MOOD` | Track mood |
| `MEDIA` | Original media type |
| `LABEL` | Record label |
| `CATALOGNUMBER` | Label catalog number |
| `BARCODE` | Release barcode (UPC/EAN) |
| `RELEASECOUNTRY` | Country of release |
| `RELEASESTATUS` | Release status (official, bootleg, etc.) |
| `RELEASETYPE` | Release type (album, single, EP, etc.) |
| `LANGUAGE` | Language of lyrics/content |
| `WORK` | Larger work (e.g., "Symphony No. 5") |
| `MOVEMENTNAME` | Movement name within a work |
| `MOVEMENTNUMBER` | Movement number/index |
| `LENGTH` | Track length in milliseconds |
| `COMPILATION` | Part of a compilation (1 = yes, 0 = no) |
| `ORIGINALALBUM` | Original album name |
| `ORIGINALARTIST` | Original artist name |
| `ORIGINALLYRICIST` | Original lyricist |
| `OWNER` | File owner/purchaser |

### MusicBrainz Identifiers

| Property Name | Description |
|--------------|-------------|
| `MUSICBRAINZ_TRACKID` | MusicBrainz track ID |
| `MUSICBRAINZ_ALBUMID` | MusicBrainz release ID |
| `MUSICBRAINZ_RELEASEGROUPID` | MusicBrainz release group ID |
| `MUSICBRAINZ_RELEASETRACKID` | MusicBrainz release track ID |
| `MUSICBRAINZ_WORKID` | MusicBrainz work ID |
| `MUSICBRAINZ_ARTISTID` | MusicBrainz artist ID |
| `MUSICBRAINZ_ALBUMARTISTID` | MusicBrainz album artist ID |
| `ACOUSTID_ID` | AcoustID audio fingerprint ID |
| `ACOUSTID_FINGERPRINT` | AcoustID audio fingerprint data |
| `MUSICIP_PUID` | MusicIP PUID (deprecated) |

### Podcast Properties

| Property Name | Description |
|--------------|-------------|
| `PODCAST` | Podcast flag (1 = yes, 0 = no) |
| `PODCASTCATEGORY` | Podcast category |
| `PODCASTDESC` | Podcast description |
| `PODCASTID` | Podcast identifier |
| `PODCASTURL` | Podcast feed URL |

## Format-Specific Tag Mapping

### ID3v2 (MP3) Frame Mapping

ID3v2 uses 4-character frame IDs that map to property names:

| Frame ID | Property Name | Description |
|----------|--------------|-------------|
| `TIT2` | `TITLE` | Title |
| `TPE1` | `ARTIST` | Lead artist/performer |
| `TALB` | `ALBUM` | Album |
| `TPE2` | `ALBUMARTIST` | Album artist |
| `TRCK` | `TRACKNUMBER` | Track number |
| `TPOS` | `DISCNUMBER` | Disc number |
| `TDRC` | `DATE` | Recording date (ID3v2.4) |
| `TDOR` | `ORIGINALDATE` | Original release date |
| `TCON` | `GENRE` | Content type (genre) |
| `COMM` | `COMMENT` | Comments |
| `TCOM` | `COMPOSER` | Composer |
| `TEXT` | `LYRICIST` | Lyricist |
| `TPE3` | `CONDUCTOR` | Conductor |
| `TPE4` | `REMIXER` | Remixer |
| `TBPM` | `BPM` | Beats per minute |
| `TCOP` | `COPYRIGHT` | Copyright |
| `TENC` | `ENCODEDBY` | Encoded by |
| `TMOO` | `MOOD` | Mood |
| `TMED` | `MEDIA` | Media type |
| `TPUB` | `LABEL` | Publisher |
| `TSRC` | `ISRC` | ISRC |
| `TLAN` | `LANGUAGE` | Language |
| `TIT1` | `WORK` | Content group (work) |
| `TIT3` | `SUBTITLE` | Subtitle |
| `TSOA` | `ALBUMSORT` | Album sort order |
| `TSOP` | `ARTISTSORT` | Performer sort order |
| `TSOT` | `TITLESORT` | Title sort order |
| `TSO2` | `ALBUMARTISTSORT` | Album artist sort (iTunes) |
| `TSOC` | `COMPOSERSORT` | Composer sort order |
| `TCMP` | `COMPILATION` | Compilation (iTunes) |
| `PCST` | `PODCAST` | Podcast (iTunes) |
| `TCAT` | `PODCASTCATEGORY` | Podcast category (iTunes) |
| `TDES` | `PODCASTDESC` | Podcast description (iTunes) |
| `TGID` | `PODCASTID` | Podcast ID (iTunes) |
| `WFED` | `PODCASTURL` | Podcast URL (iTunes) |

### MP4/M4A Atom Mapping

MP4 uses atom codes (often 4 characters starting with ©):

| Atom | Property Name | Description |
|------|--------------|-------------|
| `©nam` | `TITLE` | Name/Title |
| `©ART` | `ARTIST` | Artist |
| `©alb` | `ALBUM` | Album |
| `aART` | `ALBUMARTIST` | Album artist |
| `trkn` | `TRACKNUMBER` | Track number |
| `disk` | `DISCNUMBER` | Disc number |
| `©day` | `DATE` | Year/Date |
| `©gen` | `GENRE` | Genre |
| `©cmt` | `COMMENT` | Comment |
| `©wrt` | `COMPOSER` | Writer/Composer |
| `©lyr` | `LYRICS` | Lyrics |
| `tmpo` | `BPM` | Tempo |
| `cprt` | `COPYRIGHT` | Copyright |
| `©too` | `ENCODING` | Encoding tool |
| `©enc` | `ENCODEDBY` | Encoded by |
| `©grp` | `GROUPING` | Grouping |
| `cpil` | `COMPILATION` | Compilation |
| `soal` | `ALBUMSORT` | Sort album |
| `soar` | `ARTISTSORT` | Sort artist |
| `sonm` | `TITLESORT` | Sort name |
| `soaa` | `ALBUMARTISTSORT` | Sort album artist |
| `soco` | `COMPOSERSORT` | Sort composer |
| `©wrk` | `WORK` | Work name |
| `©mvn` | `MOVEMENTNAME` | Movement name |
| `©mvi` | `MOVEMENTNUMBER` | Movement number |
| `©mvc` | `MOVEMENTCOUNT` | Movement count |
| `pcst` | `PODCAST` | Podcast |
| `catg` | `PODCASTCATEGORY` | Category |
| `desc` | `PODCASTDESC` | Description |
| `egid` | `PODCASTID` | Episode ID |
| `purl` | `PODCASTURL` | Podcast URL |

MP4 also supports freeform atoms using the `----:com.apple.iTunes:` prefix:

| Freeform Atom | Property Name |
|--------------|---------------|
| `----:com.apple.iTunes:MusicBrainz Track Id` | `MUSICBRAINZ_TRACKID` |
| `----:com.apple.iTunes:MusicBrainz Album Id` | `MUSICBRAINZ_ALBUMID` |
| `----:com.apple.iTunes:MusicBrainz Artist Id` | `MUSICBRAINZ_ARTISTID` |
| `----:com.apple.iTunes:ACOUSTID_ID` | `ACOUSTID_ID` |
| `----:com.apple.iTunes:ACOUSTID_FINGERPRINT` | `ACOUSTID_FINGERPRINT` |
| `----:com.apple.iTunes:ISRC` | `ISRC` |
| `----:com.apple.iTunes:LABEL` | `LABEL` |
| `----:com.apple.iTunes:CATALOGNUMBER` | `CATALOGNUMBER` |
| `----:com.apple.iTunes:BARCODE` | `BARCODE` |

### Vorbis Comments (OGG, FLAC)

Vorbis Comments generally use the property names directly as field names, making them the most straightforward:

- `TITLE` → `TITLE`
- `ARTIST` → `ARTIST`
- `ALBUM` → `ALBUM`
- `ALBUMARTIST` → `ALBUMARTIST`
- `TRACKNUMBER` → `TRACKNUMBER`
- `DATE` → `DATE`
- `GENRE` → `GENRE`
- `COMMENT` → `COMMENT`
- etc.

Vorbis Comments are case-insensitive but conventionally use uppercase.

### RIFF INFO (WAV)

WAV files use INFO chunks with specific FourCC codes:

| INFO Tag | Property Name | Description |
|----------|--------------|-------------|
| `INAM` | `TITLE` | Name (Title) |
| `IART` | `ARTIST` | Artist |
| `IPRD` | `ALBUM` | Product (Album) |
| `ICMT` | `COMMENT` | Comment |
| `ICRD` | `DATE` | Creation date |
| `IGNR` | `GENRE` | Genre |
| `ICOP` | `COPYRIGHT` | Copyright |
| `ISFT` | `ENCODEDBY` | Software |
| `ITRK` | `TRACKNUMBER` | Track number |

## Usage Examples

### Reading Tags (TypeScript)

```typescript
import { TagLib, Tags } from 'taglib-wasm';

const taglib = await TagLib.initialize();
const file = taglib.openFile(audioBuffer);

// Using tag constants (recommended for type safety)
const properties = file.properties();
const title = properties[Tags.Title]?.[0];
const artist = properties[Tags.Artist]?.[0];
const album = properties[Tags.Album]?.[0];
const musicBrainzId = properties[Tags.MusicBrainzTrackId]?.[0];

// Or using string property names directly
const title2 = properties['TITLE']?.[0];
const artist2 = properties['ARTIST']?.[0];
```

### Writing Tags (TypeScript)

```typescript
// Set properties using tag constants (recommended)
file.setProperties({
  [Tags.Title]: ['My Song Title'],
  [Tags.Artist]: ['Artist Name'],
  [Tags.AlbumArtist]: ['Album Artist'],
  [Tags.MusicBrainzTrackId]: ['123e4567-e89b-12d3-a456-426614174000']
});

// Or using string property names
file.setProperty('TITLE', 'My Song Title');
file.setProperty('ARTIST', 'Artist Name');

// Save changes
file.save();
const outputBuffer = file.toBuffer();
```

### Cross-Format Compatibility

When using the PropertyMap interface, TagLib automatically handles the format-specific mappings:

```typescript
// This works the same for MP3, MP4, FLAC, OGG, and WAV files
file.tag.properties.set('TITLE', 'Universal Title');
file.tag.properties.set('COMPOSER', 'Universal Composer');

// TagLib converts these to:
// - MP3: TIT2 and TCOM frames
// - MP4: ©nam and ©wrt atoms
// - FLAC/OGG: TITLE and COMPOSER vorbis comments
// - WAV: INAM INFO chunk (COMPOSER may not be supported)
```

## Special Considerations

### Unsupported Properties

Not all formats support all properties. When a property is not supported:
- Reading returns an empty value
- Writing is ignored or stored in format-specific extension mechanisms
- Use `file.tag.properties.unsupportedData()` to see what couldn't be mapped

### Multiple Values

Some formats support multiple values for a single property:
- Vorbis Comments naturally support multiple values
- ID3v2 can have multiple frames of the same type
- MP4 generally supports only single values

### Case Sensitivity

- Property names in the PropertyMap are case-sensitive
- Vorbis Comments are case-insensitive but conventionally uppercase
- ID3v2 frame IDs are always uppercase
- MP4 atoms are case-sensitive

### Complex Properties

Some properties require special handling:
- `PICTURE`: Embedded album art (use `complexProperties()`)
- `LYRICS`: May include synchronized lyrics in some formats
- `PERFORMER:<instrument>`: Instrument-specific performer credits

## Best Practices

1. **Use Standard Names**: Always use the standard property names from this document for maximum compatibility.

2. **Check Format Support**: Be aware that not all formats support all properties.

3. **Handle Missing Values**: Always check if a property exists before using its value.

4. **Preserve Unknown Tags**: Use `properties()` and `setProperties()` to preserve tags you don't explicitly handle.

5. **Test Across Formats**: If your application needs to work with multiple formats, test tag operations with each format.

## References

- [ID3v2 Specification](https://id3.org/id3v2.4.0-frames)
- [Vorbis Comment Specification](https://xiph.org/vorbis/doc/v-comment.html)
- [MP4 Metadata Atoms](https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/Metadata/Metadata.html)
- [RIFF INFO Specification](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/Docs/riffmci.pdf)