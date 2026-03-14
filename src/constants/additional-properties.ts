/**
 * Additional audio metadata properties not covered by basic, general-extended,
 * or specialized property files. Includes sorting extensions, identifiers,
 * podcast metadata, original-release info, and miscellaneous properties.
 *
 * Wire names and format mappings sourced from TagLib's propertymapping.dox.
 */
export const ADDITIONAL_PROPERTIES = {
  albumArtistSort: {
    key: "ALBUMARTISTSORT",
    description: "Sort name for album artist (for alphabetization)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TSO2" },
      vorbis: "ALBUMARTISTSORT",
      mp4: "soaa",
    },
  },
  composerSort: {
    key: "COMPOSERSORT",
    description: "Sort name for composer (for alphabetization)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TSOC" },
      vorbis: "COMPOSERSORT",
      mp4: "soco",
    },
  },
  subtitle: {
    key: "SUBTITLE",
    description: "Subtitle or description refinement",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TIT3" },
      vorbis: "SUBTITLE",
      mp4: "----:com.apple.iTunes:SUBTITLE",
    },
  },
  label: {
    key: "LABEL",
    description: "Record label name",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TPUB" },
      vorbis: "LABEL",
      mp4: "----:com.apple.iTunes:LABEL",
      wav: "IPUB",
    },
  },
  producer: {
    key: "PRODUCER",
    description: "Producer of the recording",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "PRODUCER" },
      vorbis: "PRODUCER",
      mp4: "----:com.apple.iTunes:PRODUCER",
    },
  },
  radioStationOwner: {
    key: "RADIOSTATIONOWNER",
    description: "Owner of the radio station",
    type: "string" as const,
    supportedFormats: ["ID3v2"] as const,
    mappings: {
      id3v2: { frame: "TRSO" },
    },
  },
  asin: {
    key: "ASIN",
    description: "Amazon Standard Identification Number",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "ASIN" },
      vorbis: "ASIN",
      mp4: "----:com.apple.iTunes:ASIN",
    },
  },
  musicbrainzReleaseArtistId: {
    key: "MUSICBRAINZ_ALBUMARTISTID",
    description: "MusicBrainz Release Artist ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: {
        frame: "TXXX",
        description: "MusicBrainz Album Artist Id",
      },
      vorbis: "MUSICBRAINZ_ALBUMARTISTID",
      mp4: "----:com.apple.iTunes:MusicBrainz Album Artist Id",
    },
  },
  musicbrainzWorkId: {
    key: "MUSICBRAINZ_WORKID",
    description: "MusicBrainz Work ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TXXX", description: "MusicBrainz Work Id" },
      vorbis: "MUSICBRAINZ_WORKID",
      mp4: "----:com.apple.iTunes:MusicBrainz Work Id",
    },
  },
  musicbrainzReleaseTrackId: {
    key: "MUSICBRAINZ_RELEASETRACKID",
    description: "MusicBrainz Release Track ID (UUID)",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: {
        frame: "TXXX",
        description: "MusicBrainz Release Track Id",
      },
      vorbis: "MUSICBRAINZ_RELEASETRACKID",
      mp4: "----:com.apple.iTunes:MusicBrainz Release Track Id",
    },
  },
  podcastId: {
    key: "PODCASTID",
    description: "Podcast episode identifier",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TGID" },
      vorbis: "PODCASTID",
      mp4: "egid",
    },
  },
  podcastUrl: {
    key: "PODCASTURL",
    description: "Podcast feed URL",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "WFED" },
      vorbis: "PODCASTURL",
      mp4: "purl",
    },
  },
  originalArtist: {
    key: "ORIGINALARTIST",
    description: "Original artist of a cover or remix",
    type: "string" as const,
    supportedFormats: ["ID3v2", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TOPE" },
      vorbis: "ORIGINALARTIST",
    },
  },
  originalAlbum: {
    key: "ORIGINALALBUM",
    description: "Original album of a cover or remix",
    type: "string" as const,
    supportedFormats: ["ID3v2", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TOAL" },
      vorbis: "ORIGINALALBUM",
    },
  },
  originalDate: {
    key: "ORIGINALDATE",
    description: "Original release date",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis"] as const,
    mappings: {
      id3v2: { frame: "TDOR" },
      vorbis: "ORIGINALDATE",
      mp4: "----:com.apple.iTunes:ORIGINALDATE",
    },
  },
  script: {
    key: "SCRIPT",
    description: "Writing script used for text (e.g., Latn, Jpan)",
    type: "string" as const,
    supportedFormats: ["MP4", "Vorbis"] as const,
    mappings: {
      vorbis: "SCRIPT",
      mp4: "----:com.apple.iTunes:SCRIPT",
    },
  },
  involvedPeople: {
    key: "INVOLVEDPEOPLE",
    description: "List of involved people and their roles",
    type: "string" as const,
    supportedFormats: ["ID3v2"] as const,
    mappings: {
      id3v2: { frame: "TIPL" },
    },
  },
  encoding: {
    key: "ENCODING",
    description: "Encoding software or settings",
    type: "string" as const,
    supportedFormats: ["ID3v2", "MP4", "Vorbis", "WAV"] as const,
    mappings: {
      id3v2: { frame: "TSSE" },
      vorbis: "ENCODING",
      mp4: "\u00A9too",
      wav: "ISFT",
    },
  },
} as const;
