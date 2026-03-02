/**
 * @fileoverview Tests for constants.ts utility functions and type definitions
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  fromTagLibKey,
  getAllProperties,
  getAllPropertyKeys,
  getAllTagNames,
  getPropertiesByFormat,
  getPropertyMetadata,
  isValidProperty,
  isValidTagName,
  PROPERTIES,
  type PropertyKey,
  Tags,
  toTagLibKey,
} from "../src/constants.ts";

describe("constants", () => {
  it("isValidProperty - validates property keys correctly", () => {
    // Valid properties (camelCase)
    assertEquals(isValidProperty("title"), true);
    assertEquals(isValidProperty("artist"), true);
    assertEquals(isValidProperty("album"), true);
    assertEquals(isValidProperty("musicbrainzTrackId"), true);
    assertEquals(isValidProperty("replayGainTrackGain"), true);

    // Invalid properties
    assertEquals(isValidProperty("INVALID_PROPERTY"), false);
    assertEquals(isValidProperty("TITLE"), false); // ALL_CAPS no longer valid
    assertEquals(isValidProperty(""), false);
    assertEquals(isValidProperty("123"), false);
  });

  it("getPropertyMetadata - returns correct metadata for properties", () => {
    // Test basic property
    const titleMeta = getPropertyMetadata("title");
    if (titleMeta) {
      assertEquals(titleMeta.key, "TITLE");
      assertEquals(titleMeta.description, "The title of the track");
      assertEquals(titleMeta.type, "string");
      assertEquals(titleMeta.supportedFormats, [
        "ID3v2",
        "MP4",
        "Vorbis",
        "WAV",
      ]);
      assertExists(titleMeta.mappings);
      const id3v2Mapping = titleMeta.mappings.id3v2;
      if (typeof id3v2Mapping === "object") {
        assertEquals(id3v2Mapping.frame, "TIT2");
      }
      assertEquals(titleMeta.mappings.mp4, "©nam");
    }

    // Test extended property
    const mbTrackId = getPropertyMetadata("musicbrainzTrackId");
    if (mbTrackId) {
      assertEquals(mbTrackId.key, "MUSICBRAINZ_TRACKID");
      assertEquals(mbTrackId.description, "MusicBrainz Recording ID (UUID)");
      const id3v2Mapping = mbTrackId.mappings.id3v2;
      if (typeof id3v2Mapping === "object") {
        assertEquals(id3v2Mapping.frame, "UFID");
        assertEquals(id3v2Mapping.description, "http://musicbrainz.org");
      }
    }

    // Test ReplayGain property
    const rgTrackGain = getPropertyMetadata("replayGainTrackGain");
    if (rgTrackGain) {
      assertEquals(
        rgTrackGain.description,
        "ReplayGain track gain in dB (e.g., '-6.54 dB')",
      );
      const id3v2Mapping = rgTrackGain.mappings.id3v2;
      if (typeof id3v2Mapping === "object") {
        assertEquals(id3v2Mapping.frame, "TXXX");
        assertEquals(id3v2Mapping.description, "ReplayGain_Track_Gain");
      }
    }
  });

  it("getAllPropertyKeys - returns all property keys", () => {
    const keys = getAllPropertyKeys();

    // Check it's an array with expected properties
    assertEquals(Array.isArray(keys), true);
    assertEquals(keys.length > 35, true); // Should have many properties

    // Check some expected keys exist (camelCase)
    assertEquals(keys.includes("title"), true);
    assertEquals(keys.includes("artist"), true);
    assertEquals(keys.includes("musicbrainzTrackId"), true);
    assertEquals(keys.includes("replayGainTrackGain"), true);
    assertEquals(keys.includes("acoustidFingerprint"), true);

    // Verify all keys are valid
    for (const key of keys) {
      assertEquals(isValidProperty(key), true);
    }
  });

  it("getAllProperties - returns property key-metadata pairs", () => {
    const properties = getAllProperties();

    // Check structure
    assertEquals(Array.isArray(properties), true);
    assertEquals(properties.length > 35, true);

    // Check first few entries have correct structure
    for (const [key, metadata] of properties.slice(0, 5)) {
      assertEquals(typeof key, "string");
      assertEquals(isValidProperty(key), true);
      assertExists(metadata.key);
      assertExists(metadata.description);
      assertExists(metadata.type);
      assertExists(metadata.supportedFormats);
      // key field is the TagLib ALL_CAPS wire name, not the camelCase object key
      assertEquals(metadata.key, toTagLibKey(key));
    }
  });

  it("getPropertiesByFormat - filters properties by format support", () => {
    // Test ID3v2 format
    const id3v2Props = getPropertiesByFormat("ID3v2");
    assertEquals(Array.isArray(id3v2Props), true);
    assertEquals(id3v2Props.includes("title"), true);
    assertEquals(id3v2Props.includes("artist"), true);
    assertEquals(id3v2Props.includes("musicbrainzTrackId"), true);

    // Verify all returned properties support ID3v2
    for (const prop of id3v2Props) {
      const metadata = getPropertyMetadata(prop as PropertyKey);
      if (metadata) {
        assertEquals(metadata.supportedFormats.includes("ID3v2" as any), true);
      }
    }

    // Test Vorbis format
    const vorbisProps = getPropertiesByFormat("Vorbis");
    assertEquals(vorbisProps.includes("copyright"), true);
    assertEquals(vorbisProps.includes("lyricist"), true);
    assertEquals(vorbisProps.includes("conductor"), true);

    // Test WAV format (should have fewer properties)
    const wavProps = getPropertiesByFormat("WAV");
    assertEquals(wavProps.length < id3v2Props.length, true);
    assertEquals(wavProps.includes("title"), true);
    assertEquals(wavProps.includes("artist"), true);

    // WAV shouldn't include MusicBrainz properties
    assertEquals(wavProps.includes("musicbrainzTrackId"), false);
  });

  it("isValidTagName - validates legacy tag names", () => {
    // Valid tag names
    assertEquals(isValidTagName("TITLE"), true);
    assertEquals(isValidTagName("ARTIST"), true);
    assertEquals(isValidTagName("MUSICBRAINZ_TRACKID"), true);
    assertEquals(isValidTagName("REPLAYGAIN_TRACK_GAIN"), true);

    // Invalid tag names (uses values, not keys)
    assertEquals(isValidTagName("Title"), false);
    assertEquals(isValidTagName("Artist"), false);
    assertEquals(isValidTagName("INVALID"), false);
    assertEquals(isValidTagName(""), false);
  });

  it("getAllTagNames - returns all legacy tag values", () => {
    const tagNames = getAllTagNames();

    // Check structure
    assertEquals(Array.isArray(tagNames), true);
    assertEquals(tagNames.length > 30, true);

    // Check expected values exist
    assertEquals(tagNames.includes("TITLE"), true);
    assertEquals(tagNames.includes("ARTIST"), true);
    assertEquals(tagNames.includes("MUSICBRAINZ_TRACKID"), true);

    // Verify all are valid
    for (const name of tagNames) {
      assertEquals(isValidTagName(name), true);
    }
  });

  it("Tags constant - provides correct mappings", () => {
    // Test basic mappings
    assertEquals(Tags.Title, "TITLE");
    assertEquals(Tags.Artist, "ARTIST");
    assertEquals(Tags.Album, "ALBUM");

    // Test extended mappings
    assertEquals(Tags.MusicBrainzTrackId, "MUSICBRAINZ_TRACKID");
    assertEquals(Tags.AlbumGain, "REPLAYGAIN_ALBUM_GAIN");
    assertEquals(Tags.TrackGain, "REPLAYGAIN_TRACK_GAIN");

    // Test sorting properties
    assertEquals(Tags.TitleSort, "TITLESORT");
    assertEquals(Tags.ArtistSort, "ARTISTSORT");
    assertEquals(Tags.AlbumSort, "ALBUMSORT");
  });

  it("PROPERTIES constant structure - validates all properties have required fields", () => {
    const propertyEntries = Object.entries(PROPERTIES) as [
      PropertyKey,
      typeof PROPERTIES[PropertyKey],
    ][];

    for (const [key, prop] of propertyEntries) {
      // key field is the TagLib ALL_CAPS wire name
      assertEquals(prop.key, toTagLibKey(key));

      // All required fields should exist
      assertExists(prop.description, `${key} should have description`);
      assertExists(prop.type, `${key} should have type`);
      assertExists(
        prop.supportedFormats,
        `${key} should have supportedFormats`,
      );
      assertEquals(
        Array.isArray(prop.supportedFormats),
        true,
        `${key} supportedFormats should be array`,
      );

      // Type should be valid
      assertEquals(
        ["string", "number", "boolean"].includes(prop.type),
        true,
        `${key} has invalid type`,
      );

      // Description should be meaningful
      assertEquals(
        prop.description.length > 5,
        true,
        `${key} description too short`,
      );

      // If mappings exist, validate structure
      if (prop.mappings) {
        const mappings = prop.mappings as any;

        // Check format-specific mappings
        if (mappings.id3v2) {
          assertExists(
            mappings.id3v2.frame,
            `${key} ID3v2 mapping should have frame`,
          );
        }
        if (mappings.vorbis) {
          assertEquals(
            typeof mappings.vorbis,
            "string",
            `${key} Vorbis mapping should be string`,
          );
        }
        if (mappings.mp4) {
          assertEquals(
            typeof mappings.mp4,
            "string",
            `${key} MP4 mapping should be string`,
          );
        }
        if (mappings.wav) {
          assertEquals(
            typeof mappings.wav,
            "string",
            `${key} WAV mapping should be string`,
          );
        }
      }
    }
  });

  it("Property format support consistency", () => {
    // Properties that claim ID3v2 support should have ID3v2 mappings
    const id3v2Props = getPropertiesByFormat("ID3v2");
    for (const propKey of id3v2Props) {
      const prop = PROPERTIES[propKey as PropertyKey];
      if (prop.mappings && "id3v2" in prop.mappings) {
        assertExists(
          prop.mappings.id3v2,
          `${propKey} claims ID3v2 support but has no mapping`,
        );
      }
    }

    // Properties that claim Vorbis support should have Vorbis mappings
    const vorbisProps = getPropertiesByFormat("Vorbis");
    for (const propKey of vorbisProps) {
      const prop = PROPERTIES[propKey as PropertyKey];
      if (prop.mappings && "vorbis" in prop.mappings) {
        assertExists(
          prop.mappings.vorbis,
          `${propKey} claims Vorbis support but has no mapping`,
        );
      }
    }
  });

  it("Special property formats - validates complex mappings", () => {
    // Test TXXX frame properties (ID3v2 user-defined text)
    const txxx_props = [
      "musicbrainzArtistId",
      "replayGainTrackGain",
      "acoustidFingerprint",
    ];

    for (const propKey of txxx_props) {
      const prop = PROPERTIES[propKey as PropertyKey];
      const mappings = prop.mappings as any;
      if (mappings && mappings.id3v2) {
        assertEquals(
          mappings.id3v2.frame,
          "TXXX",
          `${propKey} should use TXXX frame`,
        );
        assertExists(
          mappings.id3v2.description,
          `${propKey} TXXX should have description`,
        );
      }
    }

    // Test iTunes-specific MP4 atoms
    const itunesProps = [
      "musicbrainzArtistId",
      "replayGainTrackGain",
      "acoustidId",
    ];

    for (const propKey of itunesProps) {
      const prop = PROPERTIES[propKey as PropertyKey];
      const mappings = prop.mappings as any;
      if (mappings && mappings.mp4) {
        assertEquals(
          mappings.mp4.startsWith("----:com.apple.iTunes:"),
          true,
          `${propKey} MP4 mapping should be iTunes atom`,
        );
      }
    }
  });
});

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
