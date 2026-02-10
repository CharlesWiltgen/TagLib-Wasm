/**
 * @fileoverview Comprehensive tests for picture/cover art functionality
 * Combines tests from test-pictures.ts and test-cover-art-helpers.ts
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { TagLib } from "../src/taglib.ts";
import { readFileData } from "../src/utils/file.ts";
import {
  addPicture,
  applyPictures,
  clearPictures,
  findPictureByType,
  getCoverArt,
  getPictureMetadata,
  readPictures,
  replacePictureByType,
  setBufferMode,
  setCoverArt,
} from "../src/simple.ts";
import {
  copyCoverArt,
  exportAllPictures,
  exportCoverArt,
  importCoverArt,
  loadPictureFromFile,
  savePictureToFile,
} from "../src/file-utils.ts";
import { dataURLToPicture, pictureToDataURL } from "../src/web-utils.ts";
import {
  BLUE_JPEG,
  cleanupTestImages,
  createTestImages,
  RED_PNG,
  TEST_FILES,
  TEST_PICTURES,
} from "./test-utils.ts";
import type { PictureType } from "../src/types.ts";
import { PICTURE_TYPE_VALUES } from "../src/types.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

// =============================================================================
// Core Picture API Tests
// =============================================================================

Deno.test("Picture API: Read pictures from files", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });

  // Test MP3 file with no pictures
  const mp3File = await taglib.open(TEST_FILES.mp3);
  const mp3Pictures = mp3File.getPictures();
  assertEquals(mp3Pictures.length, 0, "MP3 should have no pictures initially");
  mp3File.dispose();

  // Test FLAC file with no pictures
  const flacFile = await taglib.open(TEST_FILES.flac);
  const flacPictures = flacFile.getPictures();
  assertEquals(
    flacPictures.length,
    0,
    "FLAC should have no pictures initially",
  );
  flacFile.dispose();

  // Test MP4 file with no pictures
  const mp4File = await taglib.open(TEST_FILES.m4a);
  const mp4Pictures = mp4File.getPictures();
  assertEquals(mp4Pictures.length, 0, "MP4 should have no pictures initially");
  mp4File.dispose();
});

Deno.test("Picture API: Add and retrieve pictures", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });

  // Test with MP3
  {
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);

    // Add front cover
    file.addPicture(TEST_PICTURES.frontCover);
    file.save();

    // Verify picture was added
    const pictures = file.getPictures();
    assertEquals(pictures.length, 1, "Should have 1 picture after adding");
    assertEquals(pictures[0].mimeType, "image/png");
    assertEquals(pictures[0].type, PICTURE_TYPE_VALUES.FrontCover);
    assertEquals(pictures[0].description, "Front cover");
    assertEquals(pictures[0].data.length, RED_PNG.length);

    file.dispose();
  }

  // Test with FLAC
  {
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    // Add multiple pictures
    const pictures = [TEST_PICTURES.frontCover, TEST_PICTURES.backCover];

    file.setPictures(pictures);
    file.save();

    // Verify pictures were set
    const retrievedPics = file.getPictures();
    assertEquals(retrievedPics.length, 2, "Should have 2 pictures");
    assertEquals(retrievedPics[0].type, PICTURE_TYPE_VALUES.FrontCover);
    assertEquals(retrievedPics[1].type, PICTURE_TYPE_VALUES.BackCover);

    file.dispose();
  }

  // Test with MP4
  {
    const buffer = await readFileData(TEST_FILES.m4a);
    const file = await taglib.open(buffer);

    // Add JPEG cover
    file.setPictures([TEST_PICTURES.backCover]);
    file.save();

    // Verify picture was added
    const pictures = file.getPictures();
    assertEquals(pictures.length, 1, "Should have 1 picture");
    assertEquals(pictures[0].mimeType, "image/jpeg");
    assertEquals(pictures[0].data.length, BLUE_JPEG.length);

    file.dispose();
  }
});

Deno.test("Picture API: Remove pictures", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.mp3);
  const file = await taglib.open(buffer);

  // Add a picture first
  file.addPicture(TEST_PICTURES.frontCover);
  file.save();

  assertEquals(file.getPictures().length, 1, "Should have 1 picture");

  // Remove all pictures
  file.removePictures();
  file.save();

  assertEquals(
    file.getPictures().length,
    0,
    "Should have no pictures after removal",
  );

  file.dispose();
});

Deno.test("Picture API: Different picture types", async () => {
  const taglib = await TagLib.initialize({ forceBufferMode: true });
  const buffer = await readFileData(TEST_FILES.flac);
  const file = await taglib.open(buffer);

  // Add various picture types
  const pictureTypes = [
    { type: PICTURE_TYPE_VALUES.FrontCover, desc: "Front" },
    { type: PICTURE_TYPE_VALUES.BackCover, desc: "Back" },
    { type: PICTURE_TYPE_VALUES.LeafletPage, desc: "Leaflet" },
    { type: PICTURE_TYPE_VALUES.Artist, desc: "Artist photo" },
    { type: PICTURE_TYPE_VALUES.BandLogo, desc: "Logo" },
  ];

  const pictures = pictureTypes.map((pt) => ({
    mimeType: "image/png",
    data: RED_PNG,
    type: pt.type,
    description: pt.desc,
  }));

  file.setPictures(pictures);
  file.save();

  // Verify all pictures
  const retrieved = file.getPictures();
  assertEquals(retrieved.length, pictures.length, "Should have all pictures");

  for (let i = 0; i < pictures.length; i++) {
    assertEquals(retrieved[i].type, pictures[i].type);
    assertEquals(retrieved[i].description, pictures[i].description);
  }

  file.dispose();
});

// =============================================================================
// Simple API Cover Art Tests
// =============================================================================

Deno.test("Simple API: getCoverArt and setCoverArt", async () => {
  const testFile = TEST_FILES.mp3;

  // Test getting cover art from file with no pictures
  const noCover = await getCoverArt(testFile);
  assertEquals(noCover, null, "Should return null when no cover art");

  // Set cover art
  const modifiedBuffer = await setCoverArt(testFile, RED_PNG, "image/png");
  assertExists(modifiedBuffer, "Should return modified buffer");

  // Get the cover art back
  const coverData = await getCoverArt(modifiedBuffer);
  assertExists(coverData, "Should return cover art data");
  assertEquals(coverData.length, RED_PNG.length, "Cover art size should match");
  assertEquals(coverData, RED_PNG, "Cover art data should match");

  // Test with multiple pictures - getCoverArt should return front cover
  const pictures = await readPictures(modifiedBuffer);
  pictures.push(TEST_PICTURES.backCover);

  // Apply both pictures
  const bufferWithTwo = await applyPictures(modifiedBuffer, pictures);

  // getCoverArt should still return the front cover
  const frontCover = await getCoverArt(bufferWithTwo);
  assertEquals(
    frontCover,
    RED_PNG,
    "Should return front cover when multiple pictures",
  );
});

Deno.test("Simple API: Picture functions", async () => {
  const testFile = TEST_FILES.mp3;

  // Read initial state (no pictures)
  const initialPics = await readPictures(testFile);
  assertEquals(initialPics.length, 0, "Should have no pictures initially");

  // Apply pictures
  const pictures = [TEST_PICTURES.frontCover];

  const modifiedBuffer = await applyPictures(testFile, pictures);
  assertExists(modifiedBuffer, "Should return modified buffer");

  // Verify pictures were applied
  const afterApply = await readPictures(modifiedBuffer);
  assertEquals(afterApply.length, 1, "Should have 1 picture after apply");
  assertEquals(afterApply[0].description, "Front cover");

  // Add another picture
  const bufferWithTwo = await addPicture(
    modifiedBuffer,
    TEST_PICTURES.backCover,
  );
  const afterAdd = await readPictures(bufferWithTwo);
  assertEquals(afterAdd.length, 2, "Should have 2 pictures after add");

  // Clear pictures
  const clearedBuffer = await clearPictures(bufferWithTwo);
  const afterClear = await readPictures(clearedBuffer);
  assertEquals(afterClear.length, 0, "Should have no pictures after clear");
});

Deno.test("Simple API: findPictureByType", async () => {
  const pictures = [
    TEST_PICTURES.frontCover,
    TEST_PICTURES.backCover,
    {
      mimeType: "image/png",
      data: RED_PNG,
      type: PICTURE_TYPE_VALUES.Artist,
      description: "Artist",
    },
  ];

  // Find specific types
  const frontCover = findPictureByType(pictures, "FrontCover");
  assertExists(frontCover);
  assertEquals(frontCover.description, "Front cover");

  const backCover = findPictureByType(pictures, "BackCover");
  assertExists(backCover);
  assertEquals(backCover.description, "Back cover");

  const notFound = findPictureByType(pictures, "BandLogo");
  assertEquals(notFound, null, "Should return null when type not found");
});

Deno.test("Simple API: replacePictureByType", async () => {
  const testFile = TEST_FILES.flac;

  // Add initial pictures
  const initialPictures = [
    TEST_PICTURES.frontCover,
    TEST_PICTURES.backCover,
  ];

  const bufferWithPics = await applyPictures(testFile, initialPictures);

  // Replace the front cover
  const newFrontCover = {
    mimeType: "image/jpeg",
    data: BLUE_JPEG,
    type: PICTURE_TYPE_VALUES.FrontCover,
    description: "New front",
  };

  const modifiedBuffer = await replacePictureByType(
    bufferWithPics,
    newFrontCover,
  );

  // Check results
  const pictures = await readPictures(modifiedBuffer);
  assertEquals(pictures.length, 2, "Should still have 2 pictures");

  const frontCover = findPictureByType(pictures, "FrontCover");
  assertExists(frontCover);
  assertEquals(frontCover.description, "New front");
  assertEquals(frontCover.data, BLUE_JPEG);

  const backCover = findPictureByType(pictures, "BackCover");
  assertExists(backCover);
  assertEquals(
    backCover.description,
    "Back cover",
    "Back cover should be unchanged",
  );
});

Deno.test("Simple API: getPictureMetadata", async () => {
  const testFile = TEST_FILES.flac;

  // Add some pictures
  const pictures = [
    TEST_PICTURES.frontCover,
    {
      mimeType: "image/jpeg",
      data: BLUE_JPEG,
      type: PICTURE_TYPE_VALUES.Artist,
      description: "Band photo",
    },
  ];

  const bufferWithPics = await applyPictures(testFile, pictures);

  // Get metadata without loading image data
  const metadata = await getPictureMetadata(bufferWithPics);
  assertEquals(metadata.length, 2);

  assertEquals(metadata[0].type, PICTURE_TYPE_VALUES.FrontCover);
  assertEquals(metadata[0].mimeType, "image/png");
  assertEquals(metadata[0].description, "Front cover");
  assertEquals(metadata[0].size, RED_PNG.length);

  assertEquals(metadata[1].type, PICTURE_TYPE_VALUES.Artist);
  assertEquals(metadata[1].mimeType, "image/jpeg");
  assertEquals(metadata[1].description, "Band photo");
  assertEquals(metadata[1].size, BLUE_JPEG.length);
});

// =============================================================================
// File Utils Tests
// =============================================================================

Deno.test("File Utils: exportCoverArt and importCoverArt", async () => {
  const { red: redPath, tempDir } = await createTestImages();

  try {
    const testFile = TEST_FILES.mp3;
    const tempAudioPath = `${tempDir}/test.mp3`;

    // Copy test file to temp directory
    const audioData = await readFileData(testFile);
    await Deno.writeFile(tempAudioPath, audioData);

    // Import cover art from image file
    await importCoverArt(tempAudioPath, redPath);

    // Export it back out
    const exportPath = `${tempDir}/exported-cover.png`;
    await exportCoverArt(tempAudioPath, exportPath);

    // Verify exported file
    const exportedData = await Deno.readFile(exportPath);
    assertEquals(exportedData.length, RED_PNG.length);
    assertEquals(exportedData, RED_PNG);
  } finally {
    await cleanupTestImages(tempDir);
  }
});

Deno.test("File Utils: exportAllPictures", async () => {
  const { tempDir } = await createTestImages();

  try {
    const testFile = TEST_FILES.flac;
    const outputDir = `${tempDir}/artwork/`;
    await Deno.mkdir(outputDir);

    // Add multiple pictures
    const pictures = [TEST_PICTURES.frontCover, TEST_PICTURES.backCover];

    const bufferWithPics = await applyPictures(testFile, pictures);

    // Save buffer to temp file for exportAllPictures
    const tempFilePath = `${tempDir}/temp-with-pics.flac`;
    await Deno.writeFile(tempFilePath, bufferWithPics);

    // Export all pictures
    const exported = await exportAllPictures(tempFilePath, outputDir);
    assertEquals(exported.length, 2);

    // Check default naming
    assert(exported[0].includes("front-cover"));
    assert(exported[1].includes("back-cover"));

    // Verify files exist
    const file1 = await Deno.readFile(exported[0]);
    const file2 = await Deno.readFile(exported[1]);
    assertEquals(file1.length, RED_PNG.length);
    assertEquals(file2.length, BLUE_JPEG.length);

    // Test custom naming
    const customExported = await exportAllPictures(tempFilePath, outputDir, {
      nameFormat: (pic, index) =>
        `custom-${index}.${pic.mimeType.split("/")[1]}`,
    });

    assert(customExported[0].includes("custom-0"));
    assert(customExported[1].includes("custom-1"));
  } finally {
    await cleanupTestImages(tempDir);
  }
});

Deno.test("File Utils: copyCoverArt", async () => {
  const { tempDir } = await createTestImages();

  try {
    const sourceFile = TEST_FILES.mp3;
    const targetFile = TEST_FILES.flac;

    const tempSourcePath = `${tempDir}/source.mp3`;
    const tempTargetPath = `${tempDir}/target.flac`;

    // Copy files to temp
    await Deno.writeFile(tempSourcePath, await readFileData(sourceFile));
    await Deno.writeFile(tempTargetPath, await readFileData(targetFile));

    // Add cover to source
    await importCoverArt(tempSourcePath, `${tempDir}/red.png`);

    // Copy cover to target
    await copyCoverArt(tempSourcePath, tempTargetPath);

    // Verify target has cover
    const targetCover = await getCoverArt(tempTargetPath);
    assertExists(targetCover);
    assertEquals(targetCover, RED_PNG);
  } finally {
    await cleanupTestImages(tempDir);
  }
});

Deno.test("File Utils: loadPictureFromFile and savePictureToFile", async () => {
  const { red: redPath, tempDir } = await createTestImages();

  try {
    // Load picture from file
    const picture = await loadPictureFromFile(redPath, "FrontCover", {
      description: "Test cover",
    });

    assertEquals(picture.mimeType, "image/png");
    assertEquals(picture.type, PICTURE_TYPE_VALUES.FrontCover);
    assertEquals(picture.description, "Test cover");
    assertEquals(picture.data, RED_PNG);

    // Save picture to file
    const savePath = `${tempDir}/saved.png`;
    await savePictureToFile(picture, savePath);

    // Verify saved file
    const savedData = await Deno.readFile(savePath);
    assertEquals(savedData, RED_PNG);
  } finally {
    await cleanupTestImages(tempDir);
  }
});

// =============================================================================
// Web Utils Tests
// =============================================================================

Deno.test("Web Utils: pictureToDataURL and dataURLToPicture", () => {
  const picture = TEST_PICTURES.frontCover;

  // Convert to data URL
  const dataURL = pictureToDataURL(picture);
  assert(dataURL.startsWith("data:image/png;base64,"));

  // Convert back to picture
  const converted = dataURLToPicture(
    dataURL,
    "BackCover",
    "Converted",
  );
  assertEquals(converted.mimeType, "image/png");
  assertEquals(converted.type, PICTURE_TYPE_VALUES.BackCover);
  assertEquals(converted.description, "Converted");
  assertEquals(converted.data.length, RED_PNG.length);

  // Verify data matches
  assertEquals(converted.data, RED_PNG);
});
