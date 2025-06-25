/**
 * Test suite for worker pool functionality
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type applyTags,
  createWorkerPool,
  getGlobalWorkerPool,
  readPictures,
  readProperties,
  readTags,
  scanFolder,
  setWorkerPoolMode,
  TagLib,
  TagLibWorkerPool,
  terminateGlobalWorkerPool,
} from "../index.ts";

const TEST_MP3 = "./tests/test-files/mp3/kiss-snippet.mp3";
const TEST_FLAC = "./tests/test-files/flac/kiss-snippet.flac";
const TEST_M4A = "./tests/test-files/mp4/kiss-snippet.m4a";

// Skip worker tests in environments without Worker support
const hasWorkerSupport = typeof Worker !== "undefined";

if (hasWorkerSupport) {
  Deno.test("Worker Pool: Initialization", async () => {
    const pool = await createWorkerPool({ size: 2 });

    try {
      const stats = pool.getStats();
      assertEquals(stats.poolSize, 2);
      assertEquals(stats.initialized, true);
    } finally {
      pool.terminate();
    }
  });

  Deno.test("Worker Pool: Simple API Integration", async () => {
    // Create and initialize a pool explicitly
    const pool = await createWorkerPool({ size: 2 });

    // Enable worker pool mode with our initialized pool
    setWorkerPoolMode(true, pool);

    try {
      // Test readTags
      const tags = await readTags(TEST_MP3);
      assertEquals(tags.title, "Kiss");
      assertEquals(tags.artist, "Prince");

      // Test readProperties
      const props = await readProperties(TEST_MP3);
      assertExists(props);
      assertEquals(props?.sampleRate, 44100);

      // Test readPictures
      const pictures = await readPictures(TEST_MP3);
      assertEquals(Array.isArray(pictures), true);
    } finally {
      // Disable worker pool mode and clean up
      setWorkerPoolMode(false);
      pool.terminate();
    }
  });

  Deno.test("Worker Pool: Parallel Processing", async () => {
    const pool = new TagLibWorkerPool({ size: 4 });

    try {
      // Process multiple files in parallel
      const files = [TEST_MP3, TEST_FLAC, TEST_M4A];

      console.time("Parallel processing");
      const results = await pool.readTagsBatch(files);
      console.timeEnd("Parallel processing");

      assertEquals(results.length, 3);
      assertEquals(results[0].title, "Kiss");
      assertEquals(results[1].title, "Kiss");
      // M4A might not have tags set
    } finally {
      pool.terminate();
    }
  });

  Deno.test("Worker Pool: Full API Batch Operations", async () => {
    const taglib = await TagLib.initialize({ useWorkerPool: true });

    try {
      const result = await taglib.batchOperations(TEST_MP3, [
        { method: "tag" },
        { method: "audioProperties" },
      ]);

      assertExists(result.tag);
      assertExists(result.audioProperties);
      assertEquals(result.tag.title, "Kiss");
      assertEquals(result.audioProperties.sampleRate, 44100);
    } finally {
      const pool = taglib.getWorkerPool();
      pool?.terminate();
    }
  });

  Deno.test("Worker Pool: Error Handling", async () => {
    const pool = new TagLibWorkerPool({ size: 2 });

    try {
      // Test with invalid file
      let error: Error | null = null;
      try {
        await pool.readTags("non-existent-file.mp3");
      } catch (e) {
        error = e as Error;
      }

      assertExists(error);
      assertEquals(error!.name, "WorkerError");
    } finally {
      pool.terminate();
    }
  });

  Deno.test("Worker Pool: Folder Scanning", async () => {
    const pool = new TagLibWorkerPool({ size: 4 });

    try {
      const result = await scanFolder("./tests/test-files", {
        recursive: true,
        useWorkerPool: true,
        workerPool: pool,
        extensions: [".mp3", ".flac", ".m4a"],
      });

      assertExists(result);
      assertEquals(result.files.length > 0, true);
      assertEquals(
        result.totalFound,
        result.files.length + result.errors.length,
      );
    } finally {
      pool.terminate();
    }
  });

  Deno.test("Worker Pool: Performance Comparison", async () => {
    const files = [TEST_MP3, TEST_FLAC, TEST_M4A];
    const iterations = 5;

    // Test without worker pool
    setWorkerPoolMode(false);
    console.time("Without worker pool");
    for (let i = 0; i < iterations; i++) {
      for (const file of files) {
        await readTags(file);
      }
    }
    console.timeEnd("Without worker pool");

    // Test with worker pool
    const pool = new TagLibWorkerPool({ size: 4 });
    await pool.waitForReady();
    setWorkerPoolMode(true, pool);

    try {
      console.time("With worker pool");
      for (let i = 0; i < iterations; i++) {
        await Promise.all(files.map((file) => readTags(file)));
      }
      console.timeEnd("With worker pool");
    } finally {
      setWorkerPoolMode(false);
      pool.terminate();
    }
  });

  Deno.test("Worker Pool: Global Instance", async () => {
    const pool1 = getGlobalWorkerPool();
    const pool2 = getGlobalWorkerPool();

    // Should return the same instance
    assertEquals(pool1, pool2);

    // Wait for initialization before terminating
    await pool1.waitForReady();

    // Terminate global pool
    terminateGlobalWorkerPool();

    // Should create new instance
    const pool3 = getGlobalWorkerPool();
    assertEquals(pool3 !== pool1, true);

    // Wait for initialization before terminating
    await pool3.waitForReady();

    terminateGlobalWorkerPool();
  });

  Deno.test("Worker Pool: Memory Management", async () => {
    const pool = new TagLibWorkerPool({ size: 2 });

    try {
      // Wait for pool to be ready
      await pool.waitForReady();

      // Process many files to test memory management
      const files = Array(20).fill(TEST_MP3);

      const results = await pool.readTagsBatch(files);
      assertEquals(results.length, 20);

      // All results should be the same
      results.forEach((tags) => {
        assertEquals(tags.title, "Kiss");
      });
    } finally {
      pool.terminate();
    }
  });
} else {
  Deno.test("Worker Pool: Skipped (no Worker support)", () => {
    console.log("Worker tests skipped - no Worker support in this environment");
    assertEquals(true, true);
  });
}
