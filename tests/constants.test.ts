/**
 * @fileoverview Tests for constants.ts utility functions and type definitions
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import {
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
} from "../src/constants.ts";

Deno.test("isValidProperty - validates property keys correctly", () => {
  // Valid properties
  assertEquals(isValidProperty("TITLE"), true);
  assertEquals(isValidProperty("ARTIST"), true);
  assertEquals(isValidProperty("ALBUM"), true);
  assertEquals(isValidProperty("MUSICBRAINZ_TRACKID"), true);
  assertEquals(isValidProperty("REPLAYGAIN_TRACK_GAIN"), true);

  // Invalid properties
  assertEquals(isValidProperty("INVALID_PROPERTY"), false);
  assertEquals(isValidProperty("title"), false); // Case sensitive
  assertEquals(isValidProperty(""), false);
  assertEquals(isValidProperty("123"), false);
});

Deno.test("getPropertyMetadata - returns correct metadata for properties", () => {
  // Test basic property
  const titleMeta = getPropertyMetadata("TITLE");
  if (titleMeta) {
    assertEquals(titleMeta.key, "TITLE");
    assertEquals(titleMeta.description, "The title of the track");
    assertEquals(titleMeta.type, "string");
    assertEquals(titleMeta.supportedFormats, ["ID3v2", "MP4", "Vorbis", "WAV"]);
    assertExists(titleMeta.mappings);
    const id3v2Mapping = titleMeta.mappings.id3v2;
    if (typeof id3v2Mapping === "object") {
      assertEquals(id3v2Mapping.frame, "TIT2");
    }
    assertEquals(titleMeta.mappings.mp4, "©nam");
  }

  // Test extended property
  const mbTrackId = getPropertyMetadata("MUSICBRAINZ_TRACKID");
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
  const rgTrackGain = getPropertyMetadata("REPLAYGAIN_TRACK_GAIN");
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

Deno.test("getAllPropertyKeys - returns all property keys", () => {
  const keys = getAllPropertyKeys();

  // Check it's an array with expected properties
  assertEquals(Array.isArray(keys), true);
  assertEquals(keys.length > 35, true); // Should have many properties

  // Check some expected keys exist
  assertEquals(keys.includes("TITLE"), true);
  assertEquals(keys.includes("ARTIST"), true);
  assertEquals(keys.includes("MUSICBRAINZ_TRACKID"), true);
  assertEquals(keys.includes("REPLAYGAIN_TRACK_GAIN"), true);
  assertEquals(keys.includes("ACOUSTID_FINGERPRINT"), true);

  // Verify all keys are valid
  for (const key of keys) {
    assertEquals(isValidProperty(key), true);
  }
});

Deno.test("getAllProperties - returns property key-metadata pairs", () => {
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
    assertEquals(metadata.key, key); // Key should match
  }
});

Deno.test("getPropertiesByFormat - filters properties by format support", () => {
  // Test ID3v2 format
  const id3v2Props = getPropertiesByFormat("ID3v2");
  assertEquals(Array.isArray(id3v2Props), true);
  assertEquals(id3v2Props.includes("TITLE"), true);
  assertEquals(id3v2Props.includes("ARTIST"), true);
  assertEquals(id3v2Props.includes("MUSICBRAINZ_TRACKID"), true);

  // Verify all returned properties support ID3v2
  for (const prop of id3v2Props) {
    const metadata = getPropertyMetadata(prop as PropertyKey);
    if (metadata) {
      assertEquals(metadata.supportedFormats.includes("ID3v2" as any), true);
    }
  }

  // Test Vorbis format
  const vorbisProps = getPropertiesByFormat("Vorbis");
  assertEquals(vorbisProps.includes("COPYRIGHT"), true);
  assertEquals(vorbisProps.includes("LYRICIST"), true);
  assertEquals(vorbisProps.includes("CONDUCTOR"), true);

  // Test WAV format (should have fewer properties)
  const wavProps = getPropertiesByFormat("WAV");
  assertEquals(wavProps.length < id3v2Props.length, true);
  assertEquals(wavProps.includes("TITLE"), true);
  assertEquals(wavProps.includes("ARTIST"), true);

  // WAV shouldn't include MusicBrainz properties
  assertEquals(wavProps.includes("MUSICBRAINZ_TRACKID"), false);
});

Deno.test("isValidTagName - validates legacy tag names", () => {
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

Deno.test("getAllTagNames - returns all legacy tag values", () => {
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

Deno.test("Tags constant - provides correct mappings", () => {
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

Deno.test("PROPERTIES constant structure - validates all properties have required fields", () => {
  const propertyEntries = Object.entries(PROPERTIES) as [
    PropertyKey,
    typeof PROPERTIES[PropertyKey],
  ][];

  for (const [key, prop] of propertyEntries) {
    // Key should match the property's key field
    assertEquals(prop.key, key);

    // All required fields should exist
    assertExists(prop.description, `${key} should have description`);
    assertExists(prop.type, `${key} should have type`);
    assertExists(prop.supportedFormats, `${key} should have supportedFormats`);
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

Deno.test("Property format support consistency", () => {
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

Deno.test("Special property formats - validates complex mappings", () => {
  // Test TXXX frame properties (ID3v2 user-defined text)
  const txxx_props = [
    "MUSICBRAINZ_ARTISTID",
    "REPLAYGAIN_TRACK_GAIN",
    "ACOUSTID_FINGERPRINT",
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
    "MUSICBRAINZ_ARTISTID",
    "REPLAYGAIN_TRACK_GAIN",
    "ACOUSTID_ID",
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
