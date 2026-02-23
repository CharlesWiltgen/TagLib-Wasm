/**
 * @fileoverview Memory management tests for TagLib-Wasm
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../index.ts";
import { TEST_FILES } from "./test-utils.ts";

const TEST_FILE = TEST_FILES.mp3;

describe("Memory Management", () => {
  it("dispose() prevents memory accumulation", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    const getHeapSize = () => {
      if ((taglib as any).module && (taglib as any).module.HEAP8) {
        return (taglib as any).module.HEAP8.byteLength;
      }
      return 0;
    };

    const initialHeap = getHeapSize();

    for (let i = 0; i < 10; i++) {
      const audioFile = await taglib.open(TEST_FILE);
      const tag = audioFile.tag();

      const _ = tag.title;
      const __ = tag.artist;
      const ___ = tag.album;

      audioFile.dispose();
    }

    const finalHeap = getHeapSize();

    if (initialHeap > 0 && finalHeap > 0) {
      const growth = finalHeap - initialHeap;
      const growthMB = growth / 1024 / 1024;
      console.log(
        `Heap growth after 10 open/dispose cycles: ${growthMB.toFixed(2)}MB`,
      );

      assertEquals(
        growthMB < 1,
        true,
        `Excessive heap growth: ${growthMB.toFixed(2)}MB`,
      );
    }
  });

  it("dispose() can be called multiple times safely", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const audioFile = await taglib.open(TEST_FILE);

    audioFile.dispose();

    audioFile.dispose();

    audioFile.dispose();

    try {
      audioFile.tag();
    } catch (e) {
      console.log(
        "Expected error after dispose:",
        e instanceof Error ? e.message : String(e),
      );
    }
  });

  it("memory usage scales with file size", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    const files = [
      TEST_FILES.wav, // Larger
      TEST_FILES.mp3, // Smaller
    ];

    const getHeapSize = () => {
      if ((taglib as any).module && (taglib as any).module.HEAP8) {
        return (taglib as any).module.HEAP8.byteLength;
      }
      return 0;
    };

    for (const file of files) {
      const beforeOpen = getHeapSize();

      const audioFile = await taglib.open(file);
      const afterOpen = getHeapSize();

      const fileInfo = await Deno.stat(file);
      const fileSizeMB = fileInfo.size / 1024 / 1024;

      audioFile.dispose();
      const afterDispose = getHeapSize();

      if (beforeOpen > 0) {
        const loadIncrease = (afterOpen - beforeOpen) / 1024 / 1024;
        const disposeDecrease = (afterOpen - afterDispose) / 1024 / 1024;

        console.log(`File: ${file} (${fileSizeMB.toFixed(2)}MB)`);
        console.log(`  Load increase: ${loadIncrease.toFixed(2)}MB`);
        console.log(`  Dispose freed: ${disposeDecrease.toFixed(2)}MB`);
      }
    }
  });
});
