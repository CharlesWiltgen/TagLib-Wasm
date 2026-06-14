import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { assertInstanceOf } from "@std/assert/instance-of";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { FileOperationError } from "../src/errors.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

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
