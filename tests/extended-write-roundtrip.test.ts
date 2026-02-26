/**
 * @fileoverview Roundtrip tests for extended PropertyMap field writes via WASI.
 *
 * Verifies that albumArtist, composer, discNumber, bpm, MusicBrainz IDs,
 * ReplayGain, AcoustID, and other extended fields survive a write-read
 * roundtrip through the WASI C++ shim.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import {
  fileExists,
  readTagsViaPath,
  writeTagsWasi,
} from "./wasi-test-helpers.ts";
import { TEST_FILES_DIR_PATH } from "./shared-fixtures.ts";

const WASM_PATH = resolve(Deno.cwd(), "dist/wasi/taglib_wasi.wasm");
const HAS_WASM = fileExists(WASM_PATH);

async function roundtrip(
  srcFile: string,
  destFile: string,
  tags: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const tempDir = await Deno.makeTempDir();
  const srcPath = resolve(TEST_FILES_DIR_PATH, srcFile);
  const destPath = resolve(tempDir, destFile);
  await Deno.copyFile(srcPath, destPath);

  try {
    using wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/tmp": tempDir },
    });
    writeTagsWasi(wasi, `/tmp/${destFile}`, tags);

    using wasi2 = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/tmp": tempDir },
    });
    return readTagsViaPath(wasi2, `/tmp/${destFile}`) as Record<
      string,
      unknown
    >;
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

describe(
  { name: "Extended PropertyMap Write Roundtrip", ignore: !HAS_WASM },
  () => {
    it("should roundtrip albumArtist", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { albumArtist: "Various Artists" },
      );
      assertEquals(result.albumArtist, "Various Artists");
    });

    it("should roundtrip composer", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { composer: "Johann Sebastian Bach" },
      );
      assertEquals(result.composer, "Johann Sebastian Bach");
    });

    it("should roundtrip discNumber", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { discNumber: 2 },
      );
      assertEquals(result.discNumber, 2);
    });

    it("should roundtrip bpm", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { bpm: 128 },
      );
      assertEquals(result.bpm, 128);
    });

    it("should roundtrip all extended fields together", async () => {
      const tags = {
        title: "Extended Test",
        artist: "Test Artist",
        album: "Test Album",
        albumArtist: "Various Artists",
        composer: "Bach",
        discNumber: 3,
        bpm: 140,
      };

      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        tags,
      );

      assertEquals(result.title, "Extended Test");
      assertEquals(result.artist, "Test Artist");
      assertEquals(result.album, "Test Album");
      assertEquals(result.albumArtist, "Various Artists");
      assertEquals(result.composer, "Bach");
      assertEquals(result.discNumber, 3);
      assertEquals(result.bpm, 140);
    });

    it("should roundtrip MusicBrainz track ID", async () => {
      const trackId = "f4c1359b-b187-4b9b-c0b0-d2cf735398a1";
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { musicbrainzTrackId: trackId },
      );
      assertEquals(result.musicbrainzTrackId, trackId);
    });

    it("should roundtrip MusicBrainz release ID", async () => {
      const releaseId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { musicbrainzReleaseId: releaseId },
      );
      assertEquals(result.musicbrainzReleaseId, releaseId);
    });

    it("should roundtrip MusicBrainz artist ID", async () => {
      const artistId = "deadbeef-cafe-babe-dead-beefcafebabe";
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { musicbrainzArtistId: artistId },
      );
      assertEquals(result.musicbrainzArtistId, artistId);
    });

    it("should roundtrip multiple MusicBrainz IDs together", async () => {
      const tags = {
        musicbrainzTrackId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        musicbrainzReleaseId: "11111111-2222-3333-4444-555555555555",
        musicbrainzArtistId: "66666666-7777-8888-9999-000000000000",
      };

      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        tags,
      );

      assertEquals(result.musicbrainzTrackId, tags.musicbrainzTrackId);
      assertEquals(result.musicbrainzReleaseId, tags.musicbrainzReleaseId);
      assertEquals(result.musicbrainzArtistId, tags.musicbrainzArtistId);
    });

    for (
      const [format, file] of [
        ["MP3", "mp3/kiss-snippet.mp3"],
        ["FLAC", "flac/kiss-snippet.flac"],
        ["OGG", "ogg/kiss-snippet.ogg"],
      ] as const
    ) {
      it(`should roundtrip extended fields in ${format}`, async () => {
        const ext = file.split(".").pop()!;
        const tags = {
          albumArtist: "Cross-Format Artist",
          composer: "Cross-Format Composer",
          discNumber: 1,
          bpm: 96,
        };

        const result = await roundtrip(file, `test.${ext}`, tags);

        assertEquals(result.albumArtist, "Cross-Format Artist");
        assertEquals(result.composer, "Cross-Format Composer");
        assertEquals(result.discNumber, 1);
        assertEquals(result.bpm, 96);
      });
    }

    it("should roundtrip ReplayGain track gain", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { replayGainTrackGain: "-6.54 dB" },
      );
      assertEquals(result.replayGainTrackGain, "-6.54 dB");
    });

    it("should roundtrip ReplayGain album gain", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { replayGainAlbumGain: "-8.21 dB" },
      );
      assertEquals(result.replayGainAlbumGain, "-8.21 dB");
    });

    it("should roundtrip ReplayGain peak values", async () => {
      const tags = {
        replayGainTrackPeak: "0.988312",
        replayGainAlbumPeak: "1.000000",
      };
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        tags,
      );
      assertEquals(result.replayGainTrackPeak, tags.replayGainTrackPeak);
      assertEquals(result.replayGainAlbumPeak, tags.replayGainAlbumPeak);
    });

    it("should roundtrip AcoustID fields", async () => {
      const tags = {
        acoustidId: "abcdef12-3456-7890-abcd-ef1234567890",
      };
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        tags,
      );
      assertEquals(result.acoustidId, tags.acoustidId);
    });

    it("should roundtrip MusicBrainz release group ID", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { musicbrainzReleaseGroupId: "12345678-abcd-ef01-2345-678901234567" },
      );
      assertEquals(
        result.musicbrainzReleaseGroupId,
        "12345678-abcd-ef01-2345-678901234567",
      );
    });

    it("should roundtrip conductor", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { conductor: "Herbert von Karajan" },
      );
      assertEquals(result.conductor, "Herbert von Karajan");
    });

    it("should roundtrip copyright", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { copyright: "2025 Test Records" },
      );
      assertEquals(result.copyright, "2025 Test Records");
    });

    it("should roundtrip ISRC", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { isrc: "USRC17607839" },
      );
      assertEquals(result.isrc, "USRC17607839");
    });

    it("should roundtrip sort fields", async () => {
      const tags = {
        titleSort: "Song, The",
        artistSort: "Beatles, The",
        albumSort: "White Album, The",
      };
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        tags,
      );
      assertEquals(result.titleSort, tags.titleSort);
      assertEquals(result.artistSort, tags.artistSort);
      assertEquals(result.albumSort, tags.albumSort);
    });

    it("should roundtrip totalTracks and totalDiscs", async () => {
      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        { totalTracks: 12, totalDiscs: 2 },
      );
      // After Wasm rebuild, these return as numbers; current binary returns strings
      const totalTracks = typeof result.totalTracks === "string"
        ? parseInt(result.totalTracks as string)
        : result.totalTracks;
      const totalDiscs = typeof result.totalDiscs === "string"
        ? parseInt(result.totalDiscs as string)
        : result.totalDiscs;
      assertEquals(totalTracks, 12);
      assertEquals(totalDiscs, 2);
    });

    it("should roundtrip all metadata fields together", async () => {
      const tags = {
        title: "Comprehensive Test",
        artist: "Test Artist",
        album: "Test Album",
        albumArtist: "Album Artist",
        composer: "Composer",
        conductor: "Conductor",
        copyright: "2025 Records",
        discNumber: 2,
        totalDiscs: 3,
        track: 5,
        totalTracks: 15,
        bpm: 120,
        isrc: "USRC17607839",
        titleSort: "Comprehensive Test, A",
        artistSort: "Artist, Test",
        albumSort: "Album, Test",
        replayGainTrackGain: "-5.00 dB",
        replayGainTrackPeak: "0.95",
        musicbrainzTrackId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        musicbrainzReleaseId: "11111111-2222-3333-4444-555555555555",
        musicbrainzArtistId: "66666666-7777-8888-9999-000000000000",
        musicbrainzReleaseGroupId: "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
      };

      const result = await roundtrip(
        "flac/kiss-snippet.flac",
        "test.flac",
        tags,
      );

      assertEquals(result.title, tags.title);
      assertEquals(result.artist, tags.artist);
      assertEquals(result.album, tags.album);
      assertEquals(result.albumArtist, tags.albumArtist);
      assertEquals(result.composer, tags.composer);
      assertEquals(result.conductor, tags.conductor);
      assertEquals(result.copyright, tags.copyright);
      assertEquals(result.discNumber, tags.discNumber);
      // After Wasm rebuild, totals return as numbers; current binary returns strings
      const totalDiscs = typeof result.totalDiscs === "string"
        ? parseInt(result.totalDiscs as string)
        : result.totalDiscs;
      assertEquals(totalDiscs, tags.totalDiscs);
      assertEquals(result.track, tags.track);
      const totalTracks = typeof result.totalTracks === "string"
        ? parseInt(result.totalTracks as string)
        : result.totalTracks;
      assertEquals(totalTracks, tags.totalTracks);
      assertEquals(result.bpm, tags.bpm);
      assertEquals(result.isrc, tags.isrc);
      assertEquals(result.titleSort, tags.titleSort);
      assertEquals(result.artistSort, tags.artistSort);
      assertEquals(result.albumSort, tags.albumSort);
      assertEquals(result.replayGainTrackGain, tags.replayGainTrackGain);
      assertEquals(result.replayGainTrackPeak, tags.replayGainTrackPeak);
      assertEquals(result.musicbrainzTrackId, tags.musicbrainzTrackId);
      assertEquals(result.musicbrainzReleaseId, tags.musicbrainzReleaseId);
      assertEquals(result.musicbrainzArtistId, tags.musicbrainzArtistId);
      assertEquals(
        result.musicbrainzReleaseGroupId,
        tags.musicbrainzReleaseGroupId,
      );
    });
  },
);
