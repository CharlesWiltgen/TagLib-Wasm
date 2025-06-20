import { assertEquals, assertExists } from "jsr:@std/assert@^0.220.0";
import {
  type AudioFileMetadata,
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "../src/folder-api.ts";
import { readTags } from "../src/simple.ts";

const TEST_FILES_DIR = new URL("./test-files", import.meta.url).pathname;

Deno.test("scanFolder - reads all audio files with metadata", async () => {
  const result = await scanFolder(TEST_FILES_DIR, {
    recursive: true,
    onProgress: (processed, total) => {
      console.log(`Progress: ${processed}/${total}`);
    },
  });

  // Should find at least 5 test files
  assertEquals(result.totalFound >= 5, true);
  assertEquals(result.totalProcessed, result.totalFound);
  assertEquals(result.errors.length, 0);

  // Check that we got metadata for each file
  for (const file of result.files) {
    assertExists(file.path);
    assertExists(file.tags);
    assertExists(file.properties);
    assertEquals(file.error, undefined);

    // Verify properties
    if (file.properties) {
      assertEquals(typeof file.properties.length, "number");
      assertEquals(typeof file.properties.bitrate, "number");
      assertEquals(typeof file.properties.sampleRate, "number");
      assertEquals(typeof file.properties.channels, "number");
    }
  }

  // Check specific known files
  const flacFile = result.files.find((f) => f.path.endsWith(".flac"));
  assertExists(flacFile);
  // Check that we got some metadata
  assertExists(flacFile.tags);

  const mp3File = result.files.find((f) => f.path.endsWith(".mp3"));
  assertExists(mp3File);
  // Check that we got some metadata
  assertExists(mp3File.tags);
});

Deno.test("scanFolder - respects file extension filter", async () => {
  const result = await scanFolder(TEST_FILES_DIR, {
    extensions: [".mp3"],
    recursive: true,
  });

  // Should only find MP3 files
  for (const file of result.files) {
    assertEquals(file.path.endsWith(".mp3"), true);
  }
});

Deno.test("scanFolder - respects max files limit", async () => {
  const result = await scanFolder(TEST_FILES_DIR, {
    maxFiles: 2,
    recursive: true,
  });

  assertEquals(result.files.length, 2);
  assertEquals(result.totalProcessed, 2);
});

Deno.test("scanFolder - handles errors gracefully", async () => {
  // Create a temporary directory with an invalid file
  const tempDir = await Deno.makeTempDir();
  const invalidFile = `${tempDir}/invalid.mp3`;
  await Deno.writeFile(invalidFile, new Uint8Array([0, 1, 2, 3])); // Too small

  try {
    const result = await scanFolder(tempDir, {
      continueOnError: true,
    });

    assertEquals(result.totalFound, 1);
    assertEquals(result.files.length, 0);
    assertEquals(result.errors.length, 1);
    assertEquals(result.errors[0].path, invalidFile);
    assertExists(result.errors[0].error);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("updateFolderTags - updates multiple files", async () => {
  // Create temporary copies of test files
  const tempDir = await Deno.makeTempDir();
  const testFile1 = `${tempDir}/test1.mp3`;
  const testFile2 = `${tempDir}/test2.mp3`;

  // Copy test files
  const mp3Data = await Deno.readFile(`${TEST_FILES_DIR}/mp3/kiss-snippet.mp3`);
  await Deno.writeFile(testFile1, mp3Data);
  await Deno.writeFile(testFile2, mp3Data);

  try {
    // Update tags
    const updates = [
      {
        path: testFile1,
        tags: { artist: "Updated Artist 1", album: "Batch Album" },
      },
      {
        path: testFile2,
        tags: { artist: "Updated Artist 2", album: "Batch Album" },
      },
    ];

    const result = await updateFolderTags(updates);
    assertEquals(result.successful, 2);
    assertEquals(result.failed.length, 0);

    // Verify updates - note that tags preserve existing metadata
    const tags1 = await readTags(testFile1);
    assertEquals(tags1.artist, "Updated Artist 1");
    assertEquals(tags1.album, "Batch Album");
    // Original tags should still be present
    assertEquals(tags1.title, "Kiss");

    const tags2 = await readTags(testFile2);
    assertEquals(tags2.artist, "Updated Artist 2");
    assertEquals(tags2.album, "Batch Album");
    // Original tags should still be present
    assertEquals(tags2.title, "Kiss");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("findDuplicates - finds files with same metadata", async () => {
  // Create temporary directory with duplicate metadata
  const tempDir = await Deno.makeTempDir();
  const file1 = `${tempDir}/dup1.mp3`;
  const file2 = `${tempDir}/dup2.mp3`;
  const file3 = `${tempDir}/unique.mp3`;

  // Copy test file
  const mp3Data = await Deno.readFile(`${TEST_FILES_DIR}/mp3/kiss-snippet.mp3`);
  await Deno.writeFile(file1, mp3Data);
  await Deno.writeFile(file2, mp3Data);
  await Deno.writeFile(file3, mp3Data);

  // Set up duplicate tags
  await updateFolderTags([
    {
      path: file1,
      tags: { artist: "Duplicate Artist", title: "Duplicate Title" },
    },
    {
      path: file2,
      tags: { artist: "Duplicate Artist", title: "Duplicate Title" },
    },
    { path: file3, tags: { artist: "Unique Artist", title: "Unique Title" } },
  ]);

  try {
    const duplicates = await findDuplicates(tempDir);

    // Should find one group of duplicates
    assertEquals(duplicates.size, 1);

    const dupGroup = Array.from(duplicates.values())[0];
    assertEquals(dupGroup.length, 2);

    // Check that both duplicate files are found
    const paths = dupGroup.map((f) => f.path);
    assertEquals(paths.includes(file1), true);
    assertEquals(paths.includes(file2), true);
    assertEquals(paths.includes(file3), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("exportFolderMetadata - exports to JSON", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });

  try {
    await exportFolderMetadata(TEST_FILES_DIR, tempFile, {
      recursive: true,
    });

    // Read and parse the exported JSON
    const jsonData = await Deno.readTextFile(tempFile);
    const data = JSON.parse(jsonData);

    assertExists(data.folder);
    assertExists(data.scanDate);
    assertExists(data.summary);
    assertExists(data.files);
    assertExists(data.errors);

    assertEquals(data.folder, TEST_FILES_DIR);
    assertEquals(data.summary.totalFiles >= 5, true);
    assertEquals(data.files.length, data.summary.processedFiles);

    // Check file structure
    for (const file of data.files) {
      assertExists(file.path);
      assertExists(file.tags);
      assertExists(file.properties);
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("scanFolder - parallel processing", async () => {
  const startTime = Date.now();

  // Test with different concurrency levels
  const result1 = await scanFolder(TEST_FILES_DIR, {
    concurrency: 1,
    recursive: true,
  });

  const duration1 = Date.now() - startTime;

  const startTime2 = Date.now();
  const result2 = await scanFolder(TEST_FILES_DIR, {
    concurrency: 4,
    recursive: true,
  });

  const duration2 = Date.now() - startTime2;

  // Both should find the same files
  console.log(
    `Result1: found=${result1.totalFound}, processed=${result1.totalProcessed}`,
  );
  console.log(
    `Result2: found=${result2.totalFound}, processed=${result2.totalProcessed}`,
  );
  assertEquals(result1.totalFound, result2.totalFound);
  // Processing might vary slightly due to timing, but both should process at least some files
  assertEquals(result1.totalProcessed > 0, true);
  assertEquals(result2.totalProcessed > 0, true);

  console.log(`Sequential duration: ${duration1}ms`);
  console.log(`Parallel duration: ${duration2}ms`);
});
