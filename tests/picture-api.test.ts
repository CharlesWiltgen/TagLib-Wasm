/**
 * @fileoverview Comprehensive tests for picture/cover art functionality
 * Combines tests from test-pictures.ts and test-cover-art-helpers.ts
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { readFileData } from "../src/utils/file.ts";
import {
  addPicture,
  applyCoverArt,
  applyPictures,
  clearPictures,
  findPictureByType,
  readCoverArt,
  readPictureMetadata,
  readPictures,
  replacePictureByType,
  setBufferMode,
} from "../src/simple/index.ts";
import {
  copyCoverArt,
  exportAllPictures,
  exportCoverArt,
  importCoverArt,
  loadPictureFromFile,
  savePictureToFile,
} from "../src/file-utils/index.ts";
import { dataURLToPicture, pictureToDataURL } from "../src/web-utils/index.ts";
import {
  BLUE_JPEG,
  cleanupTestImages,
  createTestImages,
  RED_PNG,
  TEST_FILES,
  TEST_PICTURES,
} from "./test-utils.ts";
import type { PictureType } from "../src/types.ts";

// Force Emscripten backend for Simple API calls
setBufferMode(true);

describe("Core Picture API", () => {
  it("reads pictures from files", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    const mp3File = await taglib.open(TEST_FILES.mp3);
    const mp3Pictures = mp3File.getPictures();
    assertEquals(
      mp3Pictures.length,
      0,
      "MP3 should have no pictures initially",
    );
    mp3File.dispose();

    const flacFile = await taglib.open(TEST_FILES.flac);
    const flacPictures = flacFile.getPictures();
    assertEquals(
      flacPictures.length,
      0,
      "FLAC should have no pictures initially",
    );
    flacFile.dispose();

    const mp4File = await taglib.open(TEST_FILES.m4a);
    const mp4Pictures = mp4File.getPictures();
    assertEquals(
      mp4Pictures.length,
      0,
      "MP4 should have no pictures initially",
    );
    mp4File.dispose();
  });

  it("adds and retrieves pictures", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    // Test with MP3
    {
      const buffer = await readFileData(TEST_FILES.mp3);
      const file = await taglib.open(buffer);

      file.addPicture(TEST_PICTURES.frontCover);
      file.save();

      const pictures = file.getPictures();
      assertEquals(pictures.length, 1, "Should have 1 picture after adding");
      assertEquals(pictures[0].mimeType, "image/png");
      assertEquals(pictures[0].type, "FrontCover");
      assertEquals(pictures[0].description, "Front cover");
      assertEquals(pictures[0].data.length, RED_PNG.length);

      file.dispose();
    }

    // Test with FLAC
    {
      const buffer = await readFileData(TEST_FILES.flac);
      const file = await taglib.open(buffer);

      const pictures = [TEST_PICTURES.frontCover, TEST_PICTURES.backCover];

      file.setPictures(pictures);
      file.save();

      const retrievedPics = file.getPictures();
      assertEquals(retrievedPics.length, 2, "Should have 2 pictures");
      assertEquals(retrievedPics[0].type, "FrontCover");
      assertEquals(retrievedPics[1].type, "BackCover");

      file.dispose();
    }

    // Test with MP4
    {
      const buffer = await readFileData(TEST_FILES.m4a);
      const file = await taglib.open(buffer);

      file.setPictures([TEST_PICTURES.backCover]);
      file.save();

      const pictures = file.getPictures();
      assertEquals(pictures.length, 1, "Should have 1 picture");
      assertEquals(pictures[0].mimeType, "image/jpeg");
      assertEquals(pictures[0].data.length, BLUE_JPEG.length);

      file.dispose();
    }
  });

  it("removes pictures", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);

    file.addPicture(TEST_PICTURES.frontCover);
    file.save();

    assertEquals(file.getPictures().length, 1, "Should have 1 picture");

    file.removePictures();
    file.save();

    assertEquals(
      file.getPictures().length,
      0,
      "Should have no pictures after removal",
    );

    file.dispose();
  });

  it("handles different picture types", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    const pictureTypes = [
      { type: "FrontCover" as const, desc: "Front" },
      { type: "BackCover" as const, desc: "Back" },
      { type: "LeafletPage" as const, desc: "Leaflet" },
      { type: "Artist" as const, desc: "Artist photo" },
      { type: "BandLogo" as const, desc: "Logo" },
    ];

    const pictures = pictureTypes.map((pt) => ({
      mimeType: "image/png",
      data: RED_PNG,
      type: pt.type,
      description: pt.desc,
    }));

    file.setPictures(pictures);
    file.save();

    const retrieved = file.getPictures();
    assertEquals(retrieved.length, pictures.length, "Should have all pictures");

    for (let i = 0; i < pictures.length; i++) {
      assertEquals(retrieved[i].type, pictures[i].type);
      assertEquals(retrieved[i].description, pictures[i].description);
    }

    file.dispose();
  });
});

describe("Simple API Cover Art", () => {
  it("readCoverArt and applyCoverArt roundtrip", async () => {
    const testFile = TEST_FILES.mp3;

    const noCover = await readCoverArt(testFile);
    assertEquals(
      noCover,
      undefined,
      "Should return undefined when no cover art",
    );

    const modifiedBuffer = await applyCoverArt(testFile, RED_PNG, "image/png");
    assertExists(modifiedBuffer, "Should return modified buffer");

    const coverData = await readCoverArt(modifiedBuffer);
    assertExists(coverData, "Should return cover art data");
    assertEquals(
      coverData.length,
      RED_PNG.length,
      "Cover art size should match",
    );
    assertEquals(coverData, RED_PNG, "Cover art data should match");

    const pictures = await readPictures(modifiedBuffer);
    pictures.push(TEST_PICTURES.backCover);

    const bufferWithTwo = await applyPictures(modifiedBuffer, pictures);

    const frontCover = await readCoverArt(bufferWithTwo);
    assertEquals(
      frontCover,
      RED_PNG,
      "Should return front cover when multiple pictures",
    );
  });

  it("picture functions", async () => {
    const testFile = TEST_FILES.mp3;

    const initialPics = await readPictures(testFile);
    assertEquals(initialPics.length, 0, "Should have no pictures initially");

    const pictures = [TEST_PICTURES.frontCover];

    const modifiedBuffer = await applyPictures(testFile, pictures);
    assertExists(modifiedBuffer, "Should return modified buffer");

    const afterApply = await readPictures(modifiedBuffer);
    assertEquals(afterApply.length, 1, "Should have 1 picture after apply");
    assertEquals(afterApply[0].description, "Front cover");

    const bufferWithTwo = await addPicture(
      modifiedBuffer,
      TEST_PICTURES.backCover,
    );
    const afterAdd = await readPictures(bufferWithTwo);
    assertEquals(afterAdd.length, 2, "Should have 2 pictures after add");

    const clearedBuffer = await clearPictures(bufferWithTwo);
    const afterClear = await readPictures(clearedBuffer);
    assertEquals(afterClear.length, 0, "Should have no pictures after clear");
  });

  it("findPictureByType", async () => {
    const pictures = [
      TEST_PICTURES.frontCover,
      TEST_PICTURES.backCover,
      {
        mimeType: "image/png",
        data: RED_PNG,
        type: "Artist" as PictureType,
        description: "Artist",
      },
    ];

    const frontCover = findPictureByType(pictures, "FrontCover");
    assertExists(frontCover);
    assertEquals(frontCover.description, "Front cover");

    const backCover = findPictureByType(pictures, "BackCover");
    assertExists(backCover);
    assertEquals(backCover.description, "Back cover");

    const notFound = findPictureByType(pictures, "BandLogo");
    assertEquals(
      notFound,
      undefined,
      "Should return undefined when type not found",
    );
  });

  it("replacePictureByType", async () => {
    const testFile = TEST_FILES.flac;

    const initialPictures = [
      TEST_PICTURES.frontCover,
      TEST_PICTURES.backCover,
    ];

    const bufferWithPics = await applyPictures(testFile, initialPictures);

    const newFrontCover = {
      mimeType: "image/jpeg",
      data: BLUE_JPEG,
      type: "FrontCover" as PictureType,
      description: "New front",
    };

    const modifiedBuffer = await replacePictureByType(
      bufferWithPics,
      newFrontCover,
    );

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

  it("readPictureMetadata", async () => {
    const testFile = TEST_FILES.flac;

    const pictures = [
      TEST_PICTURES.frontCover,
      {
        mimeType: "image/jpeg",
        data: BLUE_JPEG,
        type: "Artist" as PictureType,
        description: "Band photo",
      },
    ];

    const bufferWithPics = await applyPictures(testFile, pictures);

    const metadata = await readPictureMetadata(bufferWithPics);
    assertEquals(metadata.length, 2);

    assertEquals(metadata[0].type, "FrontCover");
    assertEquals(metadata[0].mimeType, "image/png");
    assertEquals(metadata[0].description, "Front cover");
    assertEquals(metadata[0].size, RED_PNG.length);

    assertEquals(metadata[1].type, "Artist");
    assertEquals(metadata[1].mimeType, "image/jpeg");
    assertEquals(metadata[1].description, "Band photo");
    assertEquals(metadata[1].size, BLUE_JPEG.length);
  });
});

describe("File Utils", () => {
  it("exportCoverArt and importCoverArt", async () => {
    const { red: redPath, tempDir } = await createTestImages();

    try {
      const testFile = TEST_FILES.mp3;
      const tempAudioPath = `${tempDir}/test.mp3`;

      const audioData = await readFileData(testFile);
      await Deno.writeFile(tempAudioPath, audioData);

      await importCoverArt(tempAudioPath, redPath);

      const exportPath = `${tempDir}/exported-cover.png`;
      await exportCoverArt(tempAudioPath, exportPath);

      const exportedData = await Deno.readFile(exportPath);
      assertEquals(exportedData.length, RED_PNG.length);
      assertEquals(exportedData, RED_PNG);
    } finally {
      await cleanupTestImages(tempDir);
    }
  });

  it("exportAllPictures", async () => {
    const { tempDir } = await createTestImages();

    try {
      const testFile = TEST_FILES.flac;
      const outputDir = `${tempDir}/artwork/`;
      await Deno.mkdir(outputDir);

      const pictures = [TEST_PICTURES.frontCover, TEST_PICTURES.backCover];

      const bufferWithPics = await applyPictures(testFile, pictures);

      const tempFilePath = `${tempDir}/temp-with-pics.flac`;
      await Deno.writeFile(tempFilePath, bufferWithPics);

      const exported = await exportAllPictures(tempFilePath, outputDir);
      assertEquals(exported.length, 2);

      assert(exported[0].includes("front-cover"));
      assert(exported[1].includes("back-cover"));

      const file1 = await Deno.readFile(exported[0]);
      const file2 = await Deno.readFile(exported[1]);
      assertEquals(file1.length, RED_PNG.length);
      assertEquals(file2.length, BLUE_JPEG.length);

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

  it("copyCoverArt", async () => {
    const { tempDir } = await createTestImages();

    try {
      const sourceFile = TEST_FILES.mp3;
      const targetFile = TEST_FILES.flac;

      const tempSourcePath = `${tempDir}/source.mp3`;
      const tempTargetPath = `${tempDir}/target.flac`;

      await Deno.writeFile(tempSourcePath, await readFileData(sourceFile));
      await Deno.writeFile(tempTargetPath, await readFileData(targetFile));

      await importCoverArt(tempSourcePath, `${tempDir}/red.png`);

      await copyCoverArt(tempSourcePath, tempTargetPath);

      const targetCover = await readCoverArt(tempTargetPath);
      assertExists(targetCover);
      assertEquals(targetCover, RED_PNG);
    } finally {
      await cleanupTestImages(tempDir);
    }
  });

  it("loadPictureFromFile and savePictureToFile", async () => {
    const { red: redPath, tempDir } = await createTestImages();

    try {
      const picture = await loadPictureFromFile(redPath, "FrontCover", {
        description: "Test cover",
      });

      assertEquals(picture.mimeType, "image/png");
      assertEquals(picture.type, "FrontCover");
      assertEquals(picture.description, "Test cover");
      assertEquals(picture.data, RED_PNG);

      const savePath = `${tempDir}/saved.png`;
      await savePictureToFile(picture, savePath);

      const savedData = await Deno.readFile(savePath);
      assertEquals(savedData, RED_PNG);
    } finally {
      await cleanupTestImages(tempDir);
    }
  });
});

describe("Web Utils", () => {
  it("pictureToDataURL and dataURLToPicture", () => {
    const picture = TEST_PICTURES.frontCover;

    const dataURL = pictureToDataURL(picture);
    assert(dataURL.startsWith("data:image/png;base64,"));

    const converted = dataURLToPicture(
      dataURL,
      "BackCover",
      "Converted",
    );
    assertEquals(converted.mimeType, "image/png");
    assertEquals(converted.type, "BackCover");
    assertEquals(converted.description, "Converted");
    assertEquals(converted.data.length, RED_PNG.length);

    assertEquals(converted.data, RED_PNG);
  });
});
