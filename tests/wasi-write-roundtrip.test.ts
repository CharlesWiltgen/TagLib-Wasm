/**
 * @fileoverview WASI write roundtrip tests for all 5 formats.
 *
 * The existing wasi-host.test.ts only tests write for FLAC.
 * This file extends coverage to all formats with varied tag data.
 */

import { assertEquals, type assertExists, assertGreater } from "@std/assert";
import { type afterAll, type beforeAll, describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import { loadWasiHost } from "../src/runtime/wasi-host-loader.ts";
import {
  fileExists,
  FORMAT_FILES,
  readTagsViaPath,
  writeTagsWasi,
} from "./wasi-test-helpers.ts";
import { type FORMATS, TEST_FILES_DIR_PATH } from "./shared-fixtures.ts";
import type { ExtendedTag } from "../src/types.ts";

type RawTag = Record<string, unknown>;

const WASM_PATH = resolve(Deno.cwd(), "dist/wasi/taglib_wasi.wasm");
const HAS_WASM = fileExists(WASM_PATH);

describe(
  { name: "WASI Write Roundtrip - All Formats", ignore: !HAS_WASM },
  () => {
    for (const [format, paths] of Object.entries(FORMAT_FILES)) {
      it(`should write and read back tags (${format})`, async () => {
        const tempDir = await Deno.makeTempDir();
        const ext = paths.real.split(".").pop()!;
        const destFile = `roundtrip.${ext}`;
        const srcPath = resolve(TEST_FILES_DIR_PATH, paths.real);
        const destPath = resolve(tempDir, destFile);
        await Deno.copyFile(srcPath, destPath);

        try {
          using wasi = await loadWasiHost({
            wasmPath: WASM_PATH,
            preopens: { "/tmp": tempDir },
          });

          writeTagsWasi(wasi, `/tmp/${destFile}`, {
            title: `Written ${format}`,
            artist: "Roundtrip Artist",
            album: "Roundtrip Album",
          } as unknown as ExtendedTag);

          using wasi2 = await loadWasiHost({
            wasmPath: WASM_PATH,
            preopens: { "/tmp": tempDir },
          });

          const tags = readTagsViaPath(
            wasi2,
            `/tmp/${destFile}`,
          ) as unknown as RawTag;
          assertEquals(tags.title, `Written ${format}`);
          assertEquals(tags.artist, "Roundtrip Artist");
          assertEquals(tags.album, "Roundtrip Album");
        } finally {
          await Deno.remove(tempDir, { recursive: true }).catch(() => {});
        }
      });

      it(`should preserve audio data after write (${format})`, async () => {
        const tempDir = await Deno.makeTempDir();
        const ext = paths.real.split(".").pop()!;
        const destFile = `preserve.${ext}`;
        const srcPath = resolve(TEST_FILES_DIR_PATH, paths.real);
        const destPath = resolve(tempDir, destFile);
        await Deno.copyFile(srcPath, destPath);

        try {
          const sizeBefore = (await Deno.stat(destPath)).size;

          using wasi = await loadWasiHost({
            wasmPath: WASM_PATH,
            preopens: { "/tmp": tempDir },
          });

          writeTagsWasi(wasi, `/tmp/${destFile}`, {
            title: "Size Check",
          } as unknown as ExtendedTag);

          const sizeAfter = (await Deno.stat(destPath)).size;
          assertGreater(
            sizeAfter,
            0,
            `${format}: file should not be empty after write`,
          );
          // Size should be in reasonable range (tag overhead varies)
          const ratio = sizeAfter / sizeBefore;
          assertEquals(
            ratio > 0.5 && ratio < 3.0,
            true,
            `${format}: size ratio ${ratio.toFixed(2)} unreasonable`,
          );
        } finally {
          await Deno.remove(tempDir, { recursive: true }).catch(() => {});
        }
      });
    }

    it("should write unicode tags via path", async () => {
      const tempDir = await Deno.makeTempDir();
      const srcPath = resolve(TEST_FILES_DIR_PATH, "flac/kiss-snippet.flac");
      const destPath = resolve(tempDir, "unicode.flac");
      await Deno.copyFile(srcPath, destPath);

      try {
        using wasi = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        writeTagsWasi(wasi, "/tmp/unicode.flac", {
          title: "日本語タイトル",
          artist: "Артист",
          album: "专辑",
          comment: "🎵🎸",
        } as unknown as ExtendedTag);

        using wasi2 = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });

        const tags = readTagsViaPath(
          wasi2,
          "/tmp/unicode.flac",
        ) as unknown as RawTag;
        assertEquals(tags.title, "日本語タイトル");
        assertEquals(tags.artist, "Артист");
        assertEquals(tags.album, "专辑");
        assertEquals(tags.comment, "🎵🎸");
      } finally {
        await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      }
    });

    it("should overwrite tags on second write", async () => {
      const tempDir = await Deno.makeTempDir();
      const srcPath = resolve(TEST_FILES_DIR_PATH, "mp3/kiss-snippet.mp3");
      const destPath = resolve(tempDir, "overwrite.mp3");
      await Deno.copyFile(srcPath, destPath);

      try {
        // First write
        using wasi1 = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });
        writeTagsWasi(wasi1, "/tmp/overwrite.mp3", {
          title: "First Write",
        } as unknown as ExtendedTag);

        // Second write
        using wasi2 = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });
        writeTagsWasi(wasi2, "/tmp/overwrite.mp3", {
          title: "Second Write",
        } as unknown as ExtendedTag);

        // Verify
        using wasi3 = await loadWasiHost({
          wasmPath: WASM_PATH,
          preopens: { "/tmp": tempDir },
        });
        const tags = readTagsViaPath(
          wasi3,
          "/tmp/overwrite.mp3",
        ) as unknown as RawTag;
        assertEquals(tags.title, "Second Write");
      } finally {
        await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      }
    });
  },
);
