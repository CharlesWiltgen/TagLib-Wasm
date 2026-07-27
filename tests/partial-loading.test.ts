/**
 * Tests for Smart Partial Loading functionality
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { join } from "@std/path";

const TEST_FILES_DIR = join(Deno.cwd(), "tests/test-files");

/**
 * The fixture's audio carrying an ID3v2.3 tag of `frameCount` TXXX frames, each
 * `payloadSize` bytes, so the tag overruns any header window smaller than their
 * total. Spread over several frames rather than one huge one because a single
 * value above 1 MB hits the msgpack decoder's string cap on WASI, which is a
 * different limit than the one under test. Sizes follow ID3v2.3: the tag header
 * is syncsafe (7 bits per byte), frame headers are plain 32-bit big-endian.
 */
function oversizedTagMp3(payloadSize: number, frameCount: number): Uint8Array {
  const src = Deno.readFileSync(join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"));
  let audioStart = 0;
  if (String.fromCharCode(...src.slice(0, 3)) === "ID3") {
    audioStart = 10 +
      ((src[6]! << 21) | (src[7]! << 14) | (src[8]! << 7) | src[9]!);
  }
  const audio = src.slice(audioStart);

  const frames: Uint8Array[] = [];
  for (let i = 0; i < frameCount; i++) {
    const payload = new Uint8Array(payloadSize);
    // encoding byte, then a unique description so the frames stay distinct
    const desc = new TextEncoder().encode(`PAD${i}\0`);
    payload.set(desc, 1);
    payload.fill(0x41, 1 + desc.length);
    const frame = new Uint8Array(10 + payload.length);
    frame.set(new TextEncoder().encode("TXXX"), 0);
    frame[4] = (payload.length >>> 24) & 0xFF;
    frame[5] = (payload.length >>> 16) & 0xFF;
    frame[6] = (payload.length >>> 8) & 0xFF;
    frame[7] = payload.length & 0xFF;
    frame.set(payload, 10);
    frames.push(frame);
  }

  const tagSize = frames.reduce((n, f) => n + f.length, 0);
  const header = new Uint8Array(10);
  header.set(new TextEncoder().encode("ID3"), 0);
  header[3] = 3;
  header[6] = (tagSize >>> 21) & 0x7F;
  header[7] = (tagSize >>> 14) & 0x7F;
  header[8] = (tagSize >>> 7) & 0x7F;
  header[9] = tagSize & 0x7F;

  const parts = [header, ...frames, audio];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe("Partial Loading", () => {
  it("should load file with partial option", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, { partial: true });

    const tag = file.tag();
    assertExists(tag.title);
    assertExists(tag.artist);

    file.dispose();
  });

  it("should use default sizes when not specified", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, { partial: true });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  it("should work with File objects in browser-like environment", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const fileData = await Deno.readFile(
      join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3"),
    );
    const file = {
      size: fileData.byteLength,
      slice: (start: number, end: number) => ({
        arrayBuffer: async () => fileData.slice(start, end).buffer,
      }),
    };

    const audioFile = await taglib.open(fileData);
    assertExists(audioFile.tag());
    audioFile.dispose();
  });

  it("should fallback to full loading for small files", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "wav/kiss-snippet.wav");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 1024 * 1024,
      maxFooterSize: 128 * 1024,
    });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  it("should handle save with partial loading", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const outputPath = join(
      TEST_FILES_DIR,
      "mp3/kiss-snippet-partial-save.mp3",
    );

    const file = await taglib.open(filePath, { partial: true });

    const tag = file.tag();
    const originalTitle = tag.title;
    tag.setTitle("Partial Load Test");
    tag.setArtist("Test Artist");

    await file.saveToFile(outputPath);
    file.dispose();

    const savedFile = await taglib.open(outputPath);
    const savedTag = savedFile.tag();
    assertEquals(savedTag.title, "Partial Load Test");
    assertEquals(savedTag.artist, "Test Artist");
    savedFile.dispose();

    await Deno.remove(outputPath);
  });

  it("should preserve audio data when saving partially loaded file", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const outputPath = join(
      TEST_FILES_DIR,
      "mp3/kiss-snippet-partial-preserve.mp3",
    );

    const originalData = await Deno.readFile(filePath);
    const originalSize = originalData.byteLength;

    const file = await taglib.open(filePath, { partial: true });
    file.tag().setTitle("Size Test");
    await file.saveToFile(outputPath);
    file.dispose();

    const savedData = await Deno.readFile(outputPath);
    const savedSize = savedData.byteLength;

    const sizeDiff = Math.abs(savedSize - originalSize);
    assert(sizeDiff < 10240, `File size changed too much: ${sizeDiff} bytes`);

    await Deno.remove(outputPath);
  });

  it("should throw error when calling save() on partially loaded file", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 10 * 1024,
      maxFooterSize: 5 * 1024,
    });

    try {
      file.save();
      assert(false, "Should have thrown error");
    } catch (error) {
      assert(error instanceof Error);
      assert(
        error.message.includes("Cannot save partially loaded file directly"),
      );
    }

    file.dispose();
  });

  it("should work with custom header/footer sizes", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const filePath = join(TEST_FILES_DIR, "flac/kiss-snippet.flac");
    const file = await taglib.open(filePath, {
      partial: true,
      maxHeaderSize: 2 * 1024 * 1024,
      maxFooterSize: 256 * 1024,
    });

    const tag = file.tag();
    assertExists(tag);

    file.dispose();
  });

  // Regression: taglib-upg — the partial-load saveToFile branch dropped chapters
  // and ratings. WASI path-opens never partial-load (they use path-mode), so this
  // is exercised on Emscripten, where partial loading actually engages.
  it("should preserve chapters and ratings set on a partially loaded file (taglib-upg)", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    // Isolated copy — never mutate the shared fixture.
    const src = join(TEST_FILES_DIR, "mp3/_upg-src.mp3");
    const out = join(TEST_FILES_DIR, "mp3/_upg-out.mp3");
    await Deno.writeFile(
      src,
      await Deno.readFile(join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3")),
    );
    try {
      const file = await taglib.open(src, {
        partial: true,
        maxHeaderSize: 10 * 1024,
        maxFooterSize: 5 * 1024,
      });
      file.setChapters([{ startTimeMs: 0, title: "Intro", id: "ch1" }]);
      file.setRatings([{ rating: 0.8, email: "a@b.c", counter: 3 }]);
      await file.saveToFile(out);
      file.dispose();

      const reopened = await taglib.open(await Deno.readFile(out));
      try {
        assertEquals(reopened.getChapters().length, 1, "chapters dropped");
        assertEquals(reopened.getRatings().length, 1, "ratings dropped");
      } finally {
        reopened.dispose();
      }
    } finally {
      await Deno.remove(src).catch(() => {});
      await Deno.remove(out).catch(() => {});
    }
  });

  // Regression: taglib-d14 — the partial-load reconstruct MERGES the editing
  // handle's text PropertyMap over the full reload, so a property the user
  // DELETED was silently re-added from the reload. The fix snapshots the header
  // keys at load and subtracts user-deleted keys from the merge, so a deletion
  // persists while untouched tags are still preserved. Emscripten-only (WASI
  // path-opens are full loads).
  it("propagates a text-property deletion on a partial load, preserving other tags (taglib-d14)", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const src = join(TEST_FILES_DIR, "mp3/_d14-src.mp3");
    const out = join(TEST_FILES_DIR, "mp3/_d14-out.mp3");
    await Deno.writeFile(
      src,
      await Deno.readFile(join(TEST_FILES_DIR, "mp3/kiss-snippet.mp3")),
    );
    try {
      // Seed exactly three text props on the full file (replace wipes the rest).
      const seed = await taglib.open(src);
      seed.setProperties({
        title: ["Keep Title"],
        artist: ["Keep Artist"],
        albumArtist: ["Delete Me"],
      });
      seed.save();
      await Deno.writeFile(src, seed.getFileBuffer());
      seed.dispose();

      // Partial-load, then delete only albumArtist via a replace that omits it.
      const file = await taglib.open(src, {
        partial: true,
        maxHeaderSize: 10 * 1024,
        maxFooterSize: 5 * 1024,
      });
      assertEquals(
        file.properties().albumArtist,
        ["Delete Me"],
        "precondition: albumArtist present in partial header",
      );
      const props = file.properties();
      delete props.albumArtist;
      file.setProperties(props);
      await file.saveToFile(out);
      file.dispose();

      const reopened = await taglib.open(await Deno.readFile(out));
      const result = {
        albumArtist: reopened.properties().albumArtist,
        title: reopened.properties().title,
        artist: reopened.properties().artist,
      };
      reopened.dispose();

      assertEquals(result, {
        albumArtist: undefined,
        title: ["Keep Title"],
        artist: ["Keep Artist"],
      });
    } finally {
      await Deno.remove(src).catch(() => {});
      await Deno.remove(out).catch(() => {});
    }
  });

  // Partial loading concatenates the file's first maxHeaderSize bytes with its
  // last maxFooterSize bytes and discards the middle. When the metadata is
  // bigger than the header window that cuts the tag mid-structure and splices
  // unrelated footer bytes onto the cut, so TagLib parses whatever lands there.
  // Measured on a real library before the fix: 18 of 40 large MP3s read back
  // DIFFERENT metadata this way, silently — and the malformed image also tripped
  // the double free in taglib-f5hp, trapping the whole module.
  //
  // A partial read must therefore agree with a full read, always. The check is
  // "same answer either way" rather than a fixed expectation, so it holds
  // whichever path the loader picks.
  for (const backend of ["wasi", "emscripten"] as const) {
    it(`agrees with a full load when metadata exceeds the header window [${backend}]`, async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const path = await Deno.makeTempFile({ suffix: ".mp3" });
      try {
        // Built by hand rather than written through the library, so the fixture
        // does not depend on the write path this test is not exercising: the
        // fixture's audio behind one oversized TXXX frame that pushes the
        // ID3v2 tag past the 1 MB header window.
        await Deno.writeFile(path, oversizedTagMp3(400_000, 4));
        const size = (await Deno.stat(path)).size;
        assert(
          size > 1024 * 1024 + 128 * 1024,
          `fixture must exceed the partial-load threshold, got ${size}`,
        );

        // A path input on WASI returns from taglib-class.ts:99-127 BEFORE
        // partial loading is considered, so opening by path here compared a
        // full read against a full read and could not fail. A File input takes
        // the same loadAudioData branch on both backends, so it actually
        // exercises the gate under test.
        const source = backend === "wasi"
          ? new File([await Deno.readFile(path)], "oversized.mp3")
          : path;
        const readWith = async (options?: { partial: boolean }) => {
          const f = await taglib.open(source, options);
          try {
            return JSON.stringify(f.properties());
          } finally {
            f.dispose();
          }
        };

        assertEquals(
          await readWith(),
          await readWith({ partial: false }),
          `${backend}: the default (partial) read disagrees with a full read`,
        );
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }
});
