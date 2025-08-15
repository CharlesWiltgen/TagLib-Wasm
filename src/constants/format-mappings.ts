/**
 * Format-specific tag mappings (for reference only - TagLib handles these automatically)
 * This shows how standard property names map to format-specific identifiers.
 */
export const FormatMappings = {
  Title: {
    id3v2: "TIT2",
    mp4: "©nam",
    vorbis: "TITLE",
    ape: "Title",
    riff: "INAM",
  },
  Artist: {
    id3v2: "TPE1",
    mp4: "©ART",
    vorbis: "ARTIST",
    ape: "Artist",
    riff: "IART",
  },
  Album: {
    id3v2: "TALB",
    mp4: "©alb",
    vorbis: "ALBUM",
    ape: "Album",
    riff: "IPRD",
  },
  Date: {
    id3v2: "TDRC",
    mp4: "©day",
    vorbis: "DATE",
    ape: "Year",
    riff: "ICRD",
  },
  Genre: {
    id3v2: "TCON",
    mp4: "©gen",
    vorbis: "GENRE",
    ape: "Genre",
    riff: "IGNR",
  },
  Comment: {
    id3v2: "COMM",
    mp4: "©cmt",
    vorbis: "COMMENT",
    ape: "Comment",
    riff: "ICMT",
  },
  TrackNumber: {
    id3v2: "TRCK",
    mp4: "trkn",
    vorbis: "TRACKNUMBER",
    ape: "Track",
    riff: "ITRK",
  },
} as const;
