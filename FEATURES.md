# Features

## Audio Format Support

TagLib-Wasm supports **21 audio formats** with automatic detection via magic bytes:

| Format     | Extensions      | Container | Codec(s)          |
| ---------- | --------------- | --------- | ----------------- |
| MP3        | `.mp3`          | MP3       | MP3               |
| MP4/M4A    | `.mp4`, `.m4a`  | MP4       | AAC, ALAC         |
| FLAC       | `.flac`         | FLAC      | FLAC              |
| Ogg Vorbis | `.ogg`          | OGG       | Vorbis            |
| Ogg Opus   | `.opus`         | OGG       | Opus              |
| Ogg FLAC   | `.oga`          | OGG       | FLAC              |
| Speex      | `.spx`          | OGG       | Speex             |
| WAV        | `.wav`          | WAV       | PCM, IEEE Float   |
| AIFF       | `.aiff`, `.aif` | AIFF      | PCM               |
| ASF/WMA    | `.wma`, `.asf`  | ASF       | WMA, WMA Lossless |
| APE        | `.ape`          | APE       | APE               |
| DSF        | `.dsf`          | DSF       | DSD               |
| DSDIFF     | `.dff`          | DSDIFF    | DSD               |
| WavPack    | `.wv`           | WavPack   | WavPack           |
| Musepack   | `.mpc`          | MPC       | MPC               |
| TrueAudio  | `.tta`          | TTA       | TTA               |
| Shorten    | `.shn`          | Shorten   | Shorten           |
| MOD        | `.mod`          | MOD       | MOD               |
| S3M        | `.s3m`          | S3M       | S3M               |
| IT         | `.it`           | IT        | IT                |
| XM         | `.xm`           | XM        | XM                |

## Metadata Read/Write

### Basic Tags

`title`, `artist`, `album`, `genre`, `year`, `track`, `comment`

### Extended Tags (PropertyMap)

| Field                       | PropertyMap Key            | Formats |
| --------------------------- | -------------------------- | ------- |
| `albumArtist`               | ALBUMARTIST                | All     |
| `albumSort`                 | ALBUMSORT                  | All     |
| `artistSort`                | ARTISTSORT                 | All     |
| `titleSort`                 | TITLESORT                  | All     |
| `composer`                  | COMPOSER                   | All     |
| `conductor`                 | CONDUCTOR                  | All     |
| `copyright`                 | COPYRIGHT                  | All     |
| `discNumber`                | DISCNUMBER                 | All     |
| `totalDiscs`                | DISCTOTAL                  | All     |
| `totalTracks`               | TRACKTOTAL                 | All     |
| `bpm`                       | BPM                        | All     |
| `compilation`               | COMPILATION                | All     |
| `encodedBy`                 | ENCODEDBY                  | All     |
| `isrc`                      | ISRC                       | All     |
| `lyricist`                  | LYRICIST                   | All     |
| `musicbrainzTrackId`        | MUSICBRAINZ_TRACKID        | All     |
| `musicbrainzReleaseId`      | MUSICBRAINZ_ALBUMID        | All     |
| `musicbrainzArtistId`       | MUSICBRAINZ_ARTISTID       | All     |
| `musicbrainzReleaseGroupId` | MUSICBRAINZ_RELEASEGROUPID | All     |
| `acoustidId`                | ACOUSTID_ID                | All     |
| `acoustidFingerprint`       | ACOUSTID_FINGERPRINT       | All     |
| `replayGainTrackGain`       | REPLAYGAIN_TRACK_GAIN      | All     |
| `replayGainTrackPeak`       | REPLAYGAIN_TRACK_PEAK      | All     |
| `replayGainAlbumGain`       | REPLAYGAIN_ALBUM_GAIN      | All     |
| `replayGainAlbumPeak`       | REPLAYGAIN_ALBUM_PEAK      | All     |

### Complex Properties

| Property   | Description                               | Formats                  |
| ---------- | ----------------------------------------- | ------------------------ |
| `pictures` | Embedded album art (APIC/covr)            | MP3, FLAC, MP4, Ogg, ASF |
| `lyrics`   | Synchronized/unsynchronized lyrics (USLT) | MP3, FLAC, Ogg           |
| `chapters` | Chapter markers (CHAP frames)             | MP3 (ID3v2)              |

## Audio Properties

### Common Properties

`length`, `bitrate`, `sampleRate`, `channels`, `bitsPerSample`, `codec`, `containerFormat`, `isLossless`

### Format-Specific Properties

| Property        | Description             | Formats           |
| --------------- | ----------------------- | ----------------- |
| `mpegVersion`   | MPEG version (1 or 2)   | MP3               |
| `mpegLayer`     | MPEG layer (1, 2, or 3) | MP3               |
| `isEncrypted`   | DRM encryption flag     | MP4, ASF          |
| `formatVersion` | Format version number   | APE, WavPack, TTA |

## Build Features

- **WITH_ZLIB**: Compressed ID3v2 frame support (enabled for both Wasm and WASI builds)
- **Wasm Exception Handling**: EH-enabled sysroot for full C++ exception support
- **Reactor model**: Library exports via `_initialize` for proper static constructor execution
