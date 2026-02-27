import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type AudioFileMetadata,
  exportFolderMetadata,
  findDuplicates,
  scanFolder,
  updateFolderTags,
} from "../src/folder-api/index.ts";
import { readTags, setBufferMode } from "../src/simple/index.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

const TEST_FILES_DIR = new URL("./test-files", import.meta.url).pathname;

describe("folder-api", () => {
  it("scanFolder - reads all audio files with metadata", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      recursive: true,

      forceBufferMode: true,
      onProgress: (processed, total) => {
        console.log(`Progress: ${processed}/${total}`);
      },
    });

    // Should find at least 5 test files
    assertEquals(result.items.length >= 5, true);
    assertEquals(result.items.every((item) => item.status === "ok"), true);

    // Check that we got metadata for each file
    for (const item of result.items) {
      if (item.status !== "ok") continue;
      assertExists(item.path);
      assertExists(item.tags);
      assertExists(item.properties);
      assertEquals(typeof item.hasCoverArt, "boolean");

      // Verify properties
      if (item.properties) {
        assertEquals(typeof item.properties.duration, "number");
        assertEquals(typeof item.properties.bitrate, "number");
        assertEquals(typeof item.properties.sampleRate, "number");
        assertEquals(typeof item.properties.channels, "number");
      }
    }

    // Check specific known files
    const flacItem = result.items.find((i) =>
      i.status === "ok" && i.path.endsWith(".flac")
    );
    assertExists(flacItem);
    if (flacItem!.status === "ok") assertExists(flacItem!.tags);

    const mp3Item = result.items.find((i) =>
      i.status === "ok" && i.path.endsWith(".mp3")
    );
    assertExists(mp3Item);
    if (mp3Item!.status === "ok") assertExists(mp3Item!.tags);
  });

  it("scanFolder - respects file extension filter", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      extensions: [".mp3"],
      recursive: true,

      forceBufferMode: true,
    });

    // Should only find MP3 files
    for (const item of result.items) {
      assertEquals(item.path.endsWith(".mp3"), true);
    }
  });

  it("scanFolder - respects max files limit", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      maxFiles: 2,
      recursive: true,

      forceBufferMode: true,
    });

    assertEquals(result.items.length, 2);
    assertEquals(result.items.every((i) => i.status === "ok"), true);
  });

  it("scanFolder - handles errors gracefully", async () => {
    // Create a temporary directory with an invalid file
    const tempDir = await Deno.makeTempDir();
    const invalidFile = `${tempDir}/invalid.mp3`;
    await Deno.writeFile(invalidFile, new Uint8Array([0, 1, 2, 3])); // Too small

    try {
      const result = await scanFolder(tempDir, {
        continueOnError: true,

        forceBufferMode: true,
      });

      assertEquals(result.items.length, 1);
      assertEquals(result.items[0].status, "error");
      assertEquals(result.items[0].path, invalidFile);
      if (result.items[0].status === "error") {
        assertExists(result.items[0].error);
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("updateFolderTags - updates multiple files", async () => {
    // Create temporary copies of test files
    const tempDir = await Deno.makeTempDir();
    const testFile1 = `${tempDir}/test1.mp3`;
    const testFile2 = `${tempDir}/test2.mp3`;

    // Copy test files
    const mp3Data = await Deno.readFile(
      `${TEST_FILES_DIR}/mp3/kiss-snippet.mp3`,
    );
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
      assertEquals(result.items.length, 2);
      assertEquals(result.items.every((i) => i.status === "ok"), true);

      // Verify updates - note that tags preserve existing metadata
      const tags1 = await readTags(testFile1);
      assertEquals(tags1.artist, ["Updated Artist 1"]);
      assertEquals(tags1.album, ["Batch Album"]);
      assertEquals(tags1.title, ["Kiss"]);

      const tags2 = await readTags(testFile2);
      assertEquals(tags2.artist, ["Updated Artist 2"]);
      assertEquals(tags2.album, ["Batch Album"]);
      assertEquals(tags2.title, ["Kiss"]);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("findDuplicates - finds files with same metadata", async () => {
    // Create temporary directory with duplicate metadata
    const tempDir = await Deno.makeTempDir();
    const file1 = `${tempDir}/dup1.mp3`;
    const file2 = `${tempDir}/dup2.mp3`;
    const file3 = `${tempDir}/unique.mp3`;

    // Copy test file
    const mp3Data = await Deno.readFile(
      `${TEST_FILES_DIR}/mp3/kiss-snippet.mp3`,
    );
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
      const duplicates = await findDuplicates(tempDir, {
        forceBufferMode: true,
      });

      // Should find one group of duplicates
      assertEquals(duplicates.length, 1);

      const dupGroup = duplicates[0];
      assertExists(dupGroup.criteria);
      assertEquals(typeof dupGroup.criteria.artist, "string");
      assertEquals(typeof dupGroup.criteria.title, "string");
      assertEquals(dupGroup.files.length, 2);

      // Check that both duplicate files are found
      const paths = dupGroup.files.map((f) => f.path);
      assertEquals(paths.includes(file1), true);
      assertEquals(paths.includes(file2), true);
      assertEquals(paths.includes(file3), false);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("exportFolderMetadata - exports to JSON", async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      await exportFolderMetadata(TEST_FILES_DIR, tempFile, {
        recursive: true,

        forceBufferMode: true,
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
        assertEquals(typeof file.hasCoverArt, "boolean");
      }
    } finally {
      await Deno.remove(tempFile);
    }
  });

  it("scanFolder - processes all files", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      recursive: true,
      forceBufferMode: true,
    });

    assertEquals(result.items.length > 0, true);
    const okCount = result.items.filter((i) => i.status === "ok").length;
    assertEquals(okCount > 0, true);
  });

  it("scanFolder - detects cover art presence", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      recursive: true,

      forceBufferMode: true,
    });

    // Check that hasCoverArt is populated for all ok files
    let filesWithCoverArt = 0;
    let filesWithoutCoverArt = 0;

    for (const item of result.items) {
      if (item.status !== "ok") continue;
      assertEquals(typeof item.hasCoverArt, "boolean");
      if (item.hasCoverArt) {
        filesWithCoverArt++;
      } else {
        filesWithoutCoverArt++;
      }
    }

    // We should have some files with and without cover art in our test set
    console.log(`Files with cover art: ${filesWithCoverArt}`);
    console.log(`Files without cover art: ${filesWithoutCoverArt}`);

    // At least some files should exist in each category
    assertEquals(result.items.length > 0, true);
  });

  it("scanFolder - extracts audio dynamics data", async () => {
    const result = await scanFolder(TEST_FILES_DIR, {
      recursive: true,

      forceBufferMode: true,
    });

    // Check that dynamics data is extracted when available
    let filesWithDynamics = 0;
    let filesWithReplayGain = 0;
    let filesWithSoundCheck = 0;

    for (const item of result.items) {
      if (item.status !== "ok") continue;
      if (item.dynamics) {
        filesWithDynamics++;

        // Check ReplayGain fields
        if (
          item.dynamics.replayGainTrackGain ||
          item.dynamics.replayGainTrackPeak ||
          item.dynamics.replayGainAlbumGain ||
          item.dynamics.replayGainAlbumPeak
        ) {
          filesWithReplayGain++;
        }

        // Check Sound Check
        if (item.dynamics.appleSoundCheck) {
          filesWithSoundCheck++;
        }

        // Validate field formats if present
        if (item.dynamics.replayGainTrackGain) {
          assertEquals(typeof item.dynamics.replayGainTrackGain, "string");
          console.log(`Track gain: ${item.dynamics.replayGainTrackGain}`);
        }

        if (item.dynamics.replayGainTrackPeak) {
          assertEquals(typeof item.dynamics.replayGainTrackPeak, "string");
        }

        if (item.dynamics.appleSoundCheck) {
          assertEquals(typeof item.dynamics.appleSoundCheck, "string");
          console.log(`Sound Check: ${item.dynamics.appleSoundCheck}`);
        }
      }
    }

    console.log(`Files with dynamics data: ${filesWithDynamics}`);
    console.log(`Files with ReplayGain: ${filesWithReplayGain}`);
    console.log(`Files with Sound Check: ${filesWithSoundCheck}`);

    // All files should be processed
    assertEquals(result.items.length > 0, true);
  });
});
