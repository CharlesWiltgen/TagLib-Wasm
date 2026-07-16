import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { assertInstanceOf } from "@std/assert/instance-of";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { FileOperationError } from "../src/errors.ts";
import type { FileHandle, RawLyrics } from "../src/wasm.ts";
import type { UnsyncedLyrics } from "../src/constants/complex-properties.ts";
import { mergeTagUpdates } from "../src/utils/tag-mapping.ts";
import { clearTags } from "../src/simple/tag-operations.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";
import { TEST_PICTURES } from "./test-utils.ts";

let taglib: TagLib;

beforeAll(async () => {
  taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
});

describe("AudioFileImpl.save()", () => {
  it("should throw FileOperationError on partially-loaded file", async () => {
    const file = await taglib.open(FIXTURE_PATH.mp3, {
      partial: true,
      maxHeaderSize: 4096,
      maxFooterSize: 1024,
    });
    try {
      assertThrows(
        () => file.save(),
        FileOperationError,
        "Cannot save partially loaded file",
      );
    } finally {
      file.dispose();
    }
  });

  it("should save successfully on fully-loaded file", async () => {
    const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
    const file = await taglib.open(new Uint8Array(buffer));
    try {
      assertEquals(file.save(), true);
    } finally {
      file.dispose();
    }
  });
});

describe("AudioFileImpl.getFileBuffer()", () => {
  it("should return valid buffer after opening a file", async () => {
    const originalBuffer = await Deno.readFile(FIXTURE_PATH.mp3);
    const file = await taglib.open(new Uint8Array(originalBuffer));
    try {
      const fileBuffer = file.getFileBuffer();
      assertInstanceOf(fileBuffer, Uint8Array);
      assert(fileBuffer.length > 0);
    } finally {
      file.dispose();
    }
  });

  it("should return modified buffer after tag changes", async () => {
    const originalBuffer = await Deno.readFile(FIXTURE_PATH.flac);
    const file = await taglib.open(new Uint8Array(originalBuffer));
    try {
      const tag = file.tag();
      tag.setTitle("New Title");
      file.save();
      const modifiedBuffer = file.getFileBuffer();
      assertInstanceOf(modifiedBuffer, Uint8Array);
      assert(modifiedBuffer.length > 0);
    } finally {
      file.dispose();
    }
  });

  // Regression: taglib-0sv — WASI path-mode swallowed disk-read failures
  // (ENOENT after the source vanished) into an EMPTY buffer, which docs tell
  // consumers to write back to disk — truncating their file. Read failures
  // must throw; Emscripten holds the bytes in memory, so deletion of the
  // source is irrelevant there. Same scenario on both backends (parity).
  it("surfaces disk-read failures instead of returning an empty buffer (taglib-0sv)", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const srcPath = await Deno.makeTempFile({ suffix: ".mp3" });
      try {
        await Deno.writeFile(srcPath, original);
        const file = await tl.open(srcPath);
        try {
          await Deno.remove(srcPath); // source vanishes after open
          if (backend === "wasi") {
            assertThrows(
              () => file.getFileBuffer(),
              FileOperationError,
              srcPath,
            );
          } else {
            const buf = file.getFileBuffer();
            assert(buf.length > 0, "emscripten must serve in-memory bytes");
          }
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(srcPath).catch(() => {});
      }
    }
  });

  // Regression: taglib-a6c — pathModeBuffer cached pre-save bytes forever, so
  // calling getFileBuffer() before save() made every post-save call return the
  // STALE pre-save file on WASI path-mode. Consumers writing that buffer back
  // to disk silently reverted their just-saved edits. Emscripten serves live
  // in-memory bytes; both backends must reflect the edit after save().
  it("returns post-save bytes when getFileBuffer() was called before save() (taglib-a6c)", async () => {
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const srcPath = await Deno.makeTempFile({ suffix: ".mp3" });
      try {
        await Deno.writeFile(srcPath, original);
        const file = await tl.open(srcPath);
        try {
          file.getFileBuffer(); // primes the path-mode cache pre-save
          file.tag().setTitle("A6C Fresh Title");
          file.save();
          const after = new Uint8Array(file.getFileBuffer());
          const reopened = await tl.open(after);
          try {
            assertEquals(
              reopened.tag().title,
              "A6C Fresh Title",
              `${backend}: post-save getFileBuffer() returned stale bytes`,
            );
          } finally {
            reopened.dispose();
          }
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(srcPath).catch(() => {});
      }
    }
  });
});

describe("AudioFileImpl.saveToFile()", () => {
  it("should throw FileOperationError when no path is available", async () => {
    const buffer = await Deno.readFile(FIXTURE_PATH.mp3);
    const file = await taglib.open(new Uint8Array(buffer));
    try {
      await assertRejects(
        () => file.saveToFile(),
        FileOperationError,
        "No file path available",
      );
    } finally {
      file.dispose();
    }
  });

  it("should save partially-loaded file to disk", async () => {
    const file = await taglib.open(FIXTURE_PATH.mp3, {
      partial: true,
      maxHeaderSize: 4096,
      maxFooterSize: 1024,
    });

    const tmpPath = await Deno.makeTempFile({ suffix: ".mp3" });
    try {
      const tag = file.tag();
      tag.setTitle("Partial Save Test");
      await file.saveToFile(tmpPath);

      const saved = await Deno.readFile(tmpPath);
      assert(saved.length > 0);
    } finally {
      file.dispose();
      await Deno.remove(tmpPath).catch(() => {});
    }
  });

  // Regression: taglib-cd0 — on WASI, saveToFile(target) for a path-opened file
  // wrote in-place to the SOURCE and ignored the target (silent data corruption).
  it("[wasi] saveToFile(target) writes to target and leaves source intact (taglib-cd0)", async () => {
    const wasi = await TagLib.initialize({ forceWasmType: "wasi" });
    const original = await Deno.readFile(FIXTURE_PATH.mp3);
    const srcPath = await Deno.makeTempFile({ suffix: ".mp3" });
    const targetPath = await Deno.makeTempFile({ suffix: ".mp3" });
    await Deno.writeFile(srcPath, original);
    try {
      const file = await wasi.open(srcPath); // WASI path-mode
      file.tag().setTitle("CD0 Target Test");
      await file.saveToFile(targetPath);
      file.dispose();

      const reopened = await wasi.open(await Deno.readFile(targetPath));
      try {
        assertEquals(
          reopened.tag().title,
          "CD0 Target Test",
          "target missing edit",
        );
      } finally {
        reopened.dispose();
      }

      const srcAfter = await Deno.readFile(srcPath);
      assertEquals(srcAfter.length, original.length, "source size changed");
      assert(
        srcAfter.every((b, i) => b === original[i]),
        "source file was mutated by saveToFile(target)",
      );
    } finally {
      await Deno.remove(srcPath).catch(() => {});
      await Deno.remove(targetPath).catch(() => {});
    }
  });

  // Regression: taglib-gq9 — WASI silently dropped lyrics on write (TagLib has
  // no LYRICS *complex* property; lyrics must ride the text "LYRICS" PropertyMap
  // key, as Emscripten already does). They now round-trip text-only and
  // IDENTICALLY on both backends; description/language are not representable via
  // the PropertyMap API. getLyrics/setLyrics live on the handle, not the public
  // AudioFile, so reach them via a cast.
  it("lyrics round-trip text-only and identically across backends (taglib-gq9)", async () => {
    const input: RawLyrics[] = [
      { text: "Hello\nWorld", description: "Chorus", language: "eng" },
    ];
    const expected: RawLyrics[] = [
      { text: "Hello\nWorld", description: "", language: "" },
    ];
    const got: Record<string, RawLyrics[]> = {};
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.mp3));
      (file as unknown as { handle: FileHandle }).handle.setLyrics(input);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(buf);
      got[backend] = (reopened as unknown as { handle: FileHandle }).handle
        .getLyrics();
      reopened.dispose();
    }
    assertEquals(got.wasi, expected);
    assertEquals(got.emscripten, expected);
  });

  // Regression: taglib-eyp — lyrics are a structured field surfaced through the
  // public get/setLyrics() accessor (like pictures/ratings/chapters), NOT the
  // generic text properties() map. WASI hid the key; Emscripten leaked it. After
  // the fix, properties() excludes lyrics on BOTH backends and get/setLyrics()
  // is the single, identical retrieval path. (text-only per taglib-gq9).
  it("exposes lyrics via public get/setLyrics() identically on both backends, hidden from properties() (taglib-eyp)", async () => {
    const input: UnsyncedLyrics[] = [{ text: "Verse one" }];
    const got: Record<string, UnsyncedLyrics[]> = {};
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.mp3));
      file.setLyrics(input); // public accessor — no handle cast
      file.save();
      const reopened = await tl.open(file.getFileBuffer());
      file.dispose();

      got[backend] = reopened.getLyrics();
      assertEquals(
        reopened.properties()["lyrics"],
        undefined,
        `${backend}: properties() must not expose lyrics`,
      );
      reopened.dispose();
    }
    // Retrievable the SAME WAY and with the SAME result on both backends.
    assertEquals(got.wasi, [{ text: "Verse one" }]);
    assertEquals(got.emscripten, got.wasi);
  });

  // Regression GUARD: taglib-eyp — applyTags/updateFile do a text-only
  // read-modify-write (setProperties({ ...properties(), ...new })). Because
  // properties() now hides lyrics, setProperties must PRESERVE the existing
  // lyrics frame so the replace-style Emscripten setProperties can't drop it.
  // Lyrics must survive a text-only edit on BOTH backends.
  it("preserves lyrics across an applyTags-style text edit on both backends (taglib-eyp)", async () => {
    const input: UnsyncedLyrics[] = [{ text: "Keep me" }];
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.mp3));
      seed.setLyrics(input);
      seed.save();
      const withLyrics = seed.getFileBuffer();
      seed.dispose();

      const file = await tl.open(withLyrics);
      mergeTagUpdates(file, { title: "Edited Title" }); // the read-modify-write
      file.save();
      const edited = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(edited);
      const lyrics = reopened.getLyrics();
      const title = reopened.tag().title;
      reopened.dispose();

      assertEquals(
        lyrics,
        input,
        `${backend}: lyrics must survive a text-only tag edit`,
      );
      assertEquals(
        title,
        "Edited Title",
        `${backend}: the tag edit must still apply`,
      );
    }
  });

  // Regression: taglib-7eh — clearTags() must remove lyrics. Because lyrics are
  // owned by get/setLyrics() (and setProperties now preserves them, taglib-eyp),
  // clearTags's setProperties({}) alone leaves them; it must clear them
  // explicitly. Verified for lyrics written by EITHER backend.
  it("clearTags() removes lyrics written by either backend (taglib-7eh)", async () => {
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.mp3));
      seed.setLyrics([{ text: "remove me" }]);
      seed.save();
      const withLyrics = seed.getFileBuffer();
      seed.dispose();

      const cleared = await clearTags(withLyrics);

      const reopened = await tl.open(cleared);
      const lyrics = reopened.getLyrics();
      reopened.dispose();

      assertEquals(
        lyrics,
        [],
        `${backend}: clearTags() must remove lyrics`,
      );
    }
  });

  // Regression: taglib-nc5 — clearTags() is documented to remove ALL metadata,
  // but historically relied on setProperties({}), which is a wholesale REPLACE
  // on Emscripten (left ratings/chapters) yet a MERGE on WASI (an empty map is a
  // no-op, so it cleared essentially nothing). Seed every field FIRST, then
  // assert a full strip on BOTH backends — the prior "clear all string fields"
  // test passed only because the fixture had no values to begin with.
  it("clearTags() strips text, numeric, and structured metadata on both backends (taglib-nc5)", async () => {
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.mp3));
      seed.tag()
        .setTitle("Title").setArtist("Artist").setAlbum("Album")
        .setComment("Comment").setGenre("Genre").setYear(1999).setTrack(7);
      seed.setProperty("ALBUMARTIST", "Various Artists");
      seed.setLyrics([{ text: "lyric" }]);
      seed.setRatings([{ rating: 0.8 }]);
      seed.setChapters([{ startTimeMs: 0, title: "Intro" }]);
      seed.addPicture(TEST_PICTURES.frontCover);
      seed.save();
      const seeded = seed.getFileBuffer();
      seed.dispose();

      const cleared = await clearTags(seeded);

      const f = await tl.open(cleared);
      const result = {
        properties: f.properties(),
        title: f.tag().title,
        year: f.tag().year,
        track: f.tag().track,
        lyrics: f.getLyrics(),
        ratings: f.getRatings(),
        chapters: f.getChapters(),
        pictures: f.getPictures(),
      };
      f.dispose();

      assertEquals(
        result,
        {
          properties: {},
          title: "",
          year: 0,
          track: 0,
          lyrics: [],
          ratings: [],
          chapters: [],
          pictures: [],
        },
        `${backend}: clearTags() must strip every metadata field`,
      );
    }
  });

  // Regression: taglib-nc5 — the BWF structured chunks (bext + iXML) are not part
  // of the text PropertyMap, so clearTags must clear them via their accessors.
  it("clearTags() strips bext and iXML chunks on both backends (taglib-nc5)", async () => {
    for (const backend of ["wasi", "emscripten"] as const) {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.wav));
      seed.setProperty("TITLE", "Title");
      seed.setBextData(new Uint8Array(602).fill(7));
      seed.setIxml("<BWFXML><TEST>1</TEST></BWFXML>");
      seed.save();
      const seeded = seed.getFileBuffer();
      seed.dispose();

      const cleared = await clearTags(seeded);

      const f = await tl.open(cleared);
      const result = {
        title: f.tag().title,
        bext: f.getBextData(),
        ixml: f.getIxml(),
      };
      f.dispose();

      assertEquals(
        result,
        { title: "", bext: undefined, ixml: undefined },
        `${backend}: clearTags() must strip bext + iXML on WAV`,
      );
    }
  });

  // The WASI save-as reconstruct (path-mode → fresh full handle) must also carry
  // lyrics; the EXTRA_FIELDS registry copies them via get/setLyrics.
  it("[wasi] lyrics survive a save-as reconstruct (taglib-gq9)", async () => {
    const wasi = await TagLib.initialize({ forceWasmType: "wasi" });
    const srcPath = await Deno.makeTempFile({ suffix: ".mp3" });
    const out = await Deno.makeTempFile({ suffix: ".mp3" });
    await Deno.writeFile(srcPath, await Deno.readFile(FIXTURE_PATH.mp3));
    const expected: RawLyrics[] = [
      { text: "Reconstructed", description: "", language: "" },
    ];
    try {
      const file = await wasi.open(srcPath); // WASI path-mode
      (file as unknown as { handle: FileHandle }).handle.setLyrics(expected);
      await file.saveToFile(out); // save-as → reconstruct
      file.dispose();

      const reopened = await wasi.open(await Deno.readFile(out));
      const got = (reopened as unknown as { handle: FileHandle }).handle
        .getLyrics();
      reopened.dispose();
      assertEquals(got, expected);
    } finally {
      await Deno.remove(srcPath).catch(() => {});
      await Deno.remove(out).catch(() => {});
    }
  });

  // A full-load (complete) source must propagate an explicit clear, unlike a
  // partial source where an empty field may just be unread.
  it("[wasi] save-as honors an explicit clear of chapters (complete source)", async () => {
    const wasi = await TagLib.initialize({ forceWasmType: "wasi" });
    const srcPath = await Deno.makeTempFile({ suffix: ".mp3" });
    const withChapters = await Deno.makeTempFile({ suffix: ".mp3" });
    const out = await Deno.makeTempFile({ suffix: ".mp3" });
    await Deno.writeFile(srcPath, await Deno.readFile(FIXTURE_PATH.mp3));
    try {
      const seed = await wasi.open(srcPath);
      seed.setChapters([{ startTimeMs: 0, title: "Ch1" }]);
      await seed.saveToFile(withChapters);
      seed.dispose();

      const f = await wasi.open(withChapters);
      assertEquals(f.getChapters().length, 1, "precondition: chapters present");
      f.setChapters([]); // explicit clear
      await f.saveToFile(out);
      f.dispose();

      const g = await wasi.open(await Deno.readFile(out));
      const remaining = g.getChapters().length;
      g.dispose();
      assertEquals(
        remaining,
        0,
        "explicit chapter clear not honored on save-as",
      );
    } finally {
      await Deno.remove(srcPath).catch(() => {});
      await Deno.remove(withChapters).catch(() => {});
      await Deno.remove(out).catch(() => {});
    }
  });

  // Regression: the save-as reconstruct must preserve the user's MP4 chapter
  // style (it derives it from RawChapter.source, stamped by setChapters) rather
  // than silently downgrading nero/both to quicktime.
  it("[wasi] save-as preserves MP4 chapters and their nero style", async () => {
    const wasi = await TagLib.initialize({ forceWasmType: "wasi" });
    const srcPath = await Deno.makeTempFile({ suffix: ".m4a" });
    const out = await Deno.makeTempFile({ suffix: ".m4a" });
    await Deno.writeFile(srcPath, await Deno.readFile(FIXTURE_PATH.m4a));
    try {
      const file = await wasi.open(srcPath); // WASI path-mode
      file.setChapters([{ startTimeMs: 0, title: "Intro" }], {
        mp4ChapterStyle: "nero",
      });
      await file.saveToFile(out); // save-as → reconstruct
      file.dispose();

      const g = await wasi.open(await Deno.readFile(out));
      const chapters = g.getChapters();
      g.dispose();
      assertEquals(chapters.length, 1, "MP4 chapters lost on save-as");
      assertEquals(chapters[0].title, "Intro");
      assertEquals(
        chapters[0].source,
        "nero",
        "nero style downgraded on save-as",
      );
    } finally {
      await Deno.remove(srcPath).catch(() => {});
      await Deno.remove(out).catch(() => {});
    }
  });

  it("should save fully-loaded file to disk with roundtrip verification", async () => {
    const file = await taglib.open(FIXTURE_PATH.flac);

    const tmpPath = await Deno.makeTempFile({ suffix: ".flac" });
    try {
      const tag = file.tag();
      tag.setArtist("Save Test Artist");
      await file.saveToFile(tmpPath);

      const verifyFile = await taglib.open(tmpPath);
      try {
        assertEquals(verifyFile.tag().artist, "Save Test Artist");
      } finally {
        verifyFile.dispose();
      }
    } finally {
      file.dispose();
      await Deno.remove(tmpPath).catch(() => {});
    }
  });
});

// Parity: taglib-0iq — the Emscripten full-load saveToFile path (open a full
// buffer -> edit -> saveToFile(target)) had no dedicated test; only the
// partial-load reconstruct and the WASI path-mode "save as" were covered.
describe("AudioFileImpl.saveToFile() full-load (taglib-0iq)", () => {
  it("[emscripten] writes a full-load edit to the target path", async () => {
    const emsc = await TagLib.initialize({ forceWasmType: "emscripten" });
    const out = await Deno.makeTempFile({ suffix: ".mp3" });
    try {
      // Plain buffer open (no { partial: true }) => full load.
      const file = await emsc.open(await Deno.readFile(FIXTURE_PATH.mp3));
      file.tag().setTitle("Full Load Save");
      await file.saveToFile(out);
      file.dispose();

      const reopened = await emsc.open(await Deno.readFile(out));
      const title = reopened.tag().title;
      reopened.dispose();
      assertEquals(title, "Full Load Save");
    } finally {
      await Deno.remove(out).catch(() => {});
    }
  });
});
