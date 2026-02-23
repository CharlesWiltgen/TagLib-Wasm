/**
 * @fileoverview Example: Working with cover art and pictures
 *
 * This example demonstrates how to read, add, modify, and remove
 * cover art/pictures from audio files using TagLib-Wasm.
 *
 * Includes real-world scenarios like:
 * - Extracting and saving cover art
 * - Setting cover art from image files
 * - Managing multiple picture types
 * - Batch processing album artwork
 * - Web browser integration
 */

import { TagLib } from "../src/taglib.ts";
import type { PictureType } from "../src/types.ts";
import { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "../src/types.ts";
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
} from "../src/simple/index.ts";
import {
  copyCoverArt,
  exportAllPictures,
  exportCoverArt,
  findCoverArtFiles,
  importCoverArt,
  loadPictureFromFile,
} from "../src/file-utils/index.ts";

// Helper to load an image file
async function loadImage(path: string): Promise<Uint8Array> {
  if (typeof Deno !== "undefined") {
    return await Deno.readFile(path);
  } else {
    const response = await fetch(path);
    return new Uint8Array(await response.arrayBuffer());
  }
}

// Helper to save an image file
async function saveImage(path: string, data: Uint8Array): Promise<void> {
  if (typeof Deno !== "undefined") {
    await Deno.writeFile(path, data);
  } else {
    // In browser, trigger download
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Example 1: Extract cover art from an audio file
async function extractCoverArt() {
  console.log("🎨 Example 1: Extracting cover art");

  const pictures = await readPictures("song.mp3");

  if (pictures.length === 0) {
    console.log("No cover art found in the file");
    return;
  }

  for (let i = 0; i < pictures.length; i++) {
    const pic = pictures[i];
    console.log(`Picture ${i + 1}:`);
    console.log(
      `  Type: ${PICTURE_TYPE_NAMES[pic.type] || "Unknown"} (${pic.type})`,
    );
    console.log(`  MIME: ${pic.mimeType}`);
    console.log(`  Size: ${pic.data.length} bytes`);
    console.log(`  Description: ${pic.description || "(none)"}`);

    // Save the front cover
    if (pic.type === PICTURE_TYPE_VALUES.FrontCover) {
      const extension = pic.mimeType.split("/")[1];
      await saveImage(`cover.${extension}`, pic.data);
      console.log(`  Saved as: cover.${extension}`);
    }
  }
}

// Example 2: Add cover art to a file
async function addCoverArt() {
  console.log("\n🎨 Example 2: Adding cover art");

  // Load the image
  const coverData = await loadImage("album-cover.jpg");

  // Create picture object
  const cover = {
    mimeType: "image/jpeg",
    data: coverData,
    type: PICTURE_TYPE_VALUES.FrontCover,
    description: "Album cover",
  };

  // Add to file
  const modifiedBuffer = await addPicture("song.mp3", cover);

  // Save the modified file
  if (typeof Deno !== "undefined") {
    await Deno.writeFile("song-with-cover.mp3", modifiedBuffer);
  }

  console.log("✅ Cover art added successfully");
}

// Example 3: Replace all pictures
async function replaceAllPictures() {
  console.log("\n🎨 Example 3: Replacing all pictures");

  // Load multiple images
  const frontCover = await loadImage("front.jpg");
  const backCover = await loadImage("back.jpg");
  const artistPhoto = await loadImage("artist.jpg");

  // Create picture array
  const pictures = [
    {
      mimeType: "image/jpeg",
      data: frontCover,
      type: PICTURE_TYPE_VALUES.FrontCover,
      description: "Album front cover",
    },
    {
      mimeType: "image/jpeg",
      data: backCover,
      type: PICTURE_TYPE_VALUES.BackCover,
      description: "Album back cover",
    },
    {
      mimeType: "image/jpeg",
      data: artistPhoto,
      type: PICTURE_TYPE_VALUES.Artist,
      description: "Artist photo",
    },
  ];

  // Replace all pictures
  const modifiedBuffer = await applyPictures("song.mp3", pictures);

  console.log(`✅ Replaced with ${pictures.length} pictures`);
  return modifiedBuffer;
}

// Example 4: Using TagLib API for more control
async function advancedPictureHandling() {
  console.log("\n🎨 Example 4: Advanced picture handling");

  const taglib = await TagLib.initialize();
  const file = await taglib.open("song.mp3");

  // Check current pictures
  const currentPics = file.getPictures();
  console.log(`Current pictures: ${currentPics.length}`);

  // Remove all non-cover pictures
  const coversOnly = currentPics.filter((pic) =>
    pic.type === PICTURE_TYPE_VALUES.FrontCover ||
    pic.type === PICTURE_TYPE_VALUES.BackCover
  );

  if (coversOnly.length !== currentPics.length) {
    file.setPictures(coversOnly);
    console.log(`Kept only ${coversOnly.length} cover images`);
  }

  // Add a band logo if not present
  const hasLogo = currentPics.some((pic) =>
    pic.type === PICTURE_TYPE_VALUES.BandLogo
  );
  if (!hasLogo) {
    const logo = await loadImage("band-logo.png");
    file.addPicture({
      mimeType: "image/png",
      data: logo,
      type: PICTURE_TYPE_VALUES.BandLogo,
      description: "Band logo",
    });
    console.log("Added band logo");
  }

  // Save changes
  file.save();
  const modifiedBuffer = file.getFileBuffer();
  file.dispose();

  return modifiedBuffer;
}

// Example 5: Copy pictures between files
async function copyPictures(sourceFile: string, targetFile: string) {
  console.log("\n🎨 Example 5: Copying pictures between files");

  // Read pictures from source
  const pictures = await readPictures(sourceFile);
  console.log(`Found ${pictures.length} pictures in source`);

  if (pictures.length > 0) {
    // Apply to target
    const modifiedTarget = await applyPictures(targetFile, pictures);

    // Save result
    if (typeof Deno !== "undefined") {
      await Deno.writeFile(`${targetFile}.with-pictures`, modifiedTarget);
    }

    console.log(`✅ Copied ${pictures.length} pictures to target`);
  }
}

// Example 6: Picture type reference
function showPictureTypes() {
  console.log("\n📖 Picture Type Reference:");
  const types = [
    { value: PICTURE_TYPE_VALUES.Other, name: "Other" },
    { value: PICTURE_TYPE_VALUES.FileIcon, name: "File icon (32x32 PNG)" },
    { value: PICTURE_TYPE_VALUES.OtherFileIcon, name: "Other file icon" },
    { value: PICTURE_TYPE_VALUES.FrontCover, name: "Front cover" },
    { value: PICTURE_TYPE_VALUES.BackCover, name: "Back cover" },
    { value: PICTURE_TYPE_VALUES.LeafletPage, name: "Leaflet page" },
    { value: PICTURE_TYPE_VALUES.Media, name: "Media (label side of CD)" },
    { value: PICTURE_TYPE_VALUES.LeadArtist, name: "Lead artist/performer" },
    { value: PICTURE_TYPE_VALUES.Artist, name: "Artist/performer" },
    { value: PICTURE_TYPE_VALUES.Conductor, name: "Conductor" },
    { value: PICTURE_TYPE_VALUES.Band, name: "Band/Orchestra" },
    { value: PICTURE_TYPE_VALUES.Composer, name: "Composer" },
    { value: PICTURE_TYPE_VALUES.Lyricist, name: "Lyricist/text writer" },
    {
      value: PICTURE_TYPE_VALUES.RecordingLocation,
      name: "Recording location",
    },
    { value: PICTURE_TYPE_VALUES.DuringRecording, name: "During recording" },
    {
      value: PICTURE_TYPE_VALUES.DuringPerformance,
      name: "During performance",
    },
    {
      value: PICTURE_TYPE_VALUES.MovieScreenCapture,
      name: "Movie/video screen capture",
    },
    {
      value: PICTURE_TYPE_VALUES.ColouredFish,
      name: "A bright colored fish (!)",
    },
    { value: PICTURE_TYPE_VALUES.Illustration, name: "Illustration" },
    { value: PICTURE_TYPE_VALUES.BandLogo, name: "Band/artist logo" },
    { value: PICTURE_TYPE_VALUES.PublisherLogo, name: "Publisher/studio logo" },
  ];

  for (const type of types) {
    console.log(`  ${type.value}: ${type.name}`);
  }
}

// Example 7: Real-world - Quick cover art extraction
async function quickExtractCover() {
  console.log("\n🎯 Example 7: Quick cover extraction with new helpers");

  // Extract just the primary cover art
  const coverData = await readCoverArt("song.mp3");
  if (coverData) {
    console.log(`Found cover art: ${coverData.length} bytes`);

    // Using file-utils for easy export
    await exportCoverArt("song.mp3", "extracted-cover.jpg");
    console.log("✅ Saved cover art to extracted-cover.jpg");
  } else {
    console.log("No cover art found");
  }
}

// Example 8: Real-world - Set cover art from file
async function quickSetCover() {
  console.log("\n🎯 Example 8: Quick cover art replacement");

  // Simple one-liner to replace cover art
  await importCoverArt("song.mp3", "new-cover.jpg");
  console.log("✅ Cover art updated from new-cover.jpg");

  // Or if you want the modified buffer without saving
  const jpegData = await loadImage("new-cover.jpg");
  const modifiedBuffer = await applyCoverArt(
    "song.mp3",
    jpegData,
    "image/jpeg",
  );
  console.log("✅ Got modified buffer with new cover");
}

// Example 9: Real-world - Batch process album
async function batchProcessAlbum(albumDir: string) {
  console.log("\n🎯 Example 9: Batch processing album artwork");

  // Find cover art files in album directory
  const coverFiles = await findCoverArtFiles(`${albumDir}/track01.mp3`);
  console.log("Found cover files:", coverFiles);

  if (coverFiles.front) {
    // Apply the same cover to all tracks
    const tracks = ["track01.mp3", "track02.mp3", "track03.mp3"];

    for (const track of tracks) {
      await importCoverArt(`${albumDir}/${track}`, coverFiles.front);
      console.log(`✅ Updated ${track}`);
    }
  }
}

// Example 10: Real-world - Manage multiple artwork types
async function manageCompleteArtwork() {
  console.log("\n🎯 Example 10: Managing complete artwork package");

  const audioFile = "deluxe-album.mp3";

  // Load different artwork types
  const artworks = [
    await loadPictureFromFile("front-cover.jpg", "FrontCover"),
    await loadPictureFromFile("back-cover.jpg", "BackCover"),
    await loadPictureFromFile("booklet-page1.jpg", "LeafletPage"),
    await loadPictureFromFile("booklet-page2.jpg", "LeafletPage"),
    await loadPictureFromFile("cd-label.jpg", "Media"),
    await loadPictureFromFile("band-photo.jpg", "Band"),
  ];

  // Apply all artwork
  const modifiedBuffer = await applyPictures(audioFile, artworks);
  console.log(`✅ Applied ${artworks.length} pictures`);

  // Check what we have
  const metadata = await readPictureMetadata(audioFile);
  for (const info of metadata) {
    console.log(
      `  ${PictureType[info.type]}: ${info.mimeType}, ${info.size} bytes`,
    );
  }
}

// Example 11: Real-world - Smart cover art replacement
async function smartCoverReplacement() {
  console.log("\n🎯 Example 11: Smart cover art replacement");

  const audioFile = "song.mp3";

  // Get current picture metadata without loading image data
  const metadata = await readPictureMetadata(audioFile);
  console.log(`Current pictures: ${metadata.length}`);

  // Replace just the front cover, keep other artwork
  const newFrontCover = await loadPictureFromFile(
    "better-cover.jpg",
    "FrontCover",
  );
  const modifiedBuffer = await replacePictureByType(audioFile, newFrontCover);

  console.log("✅ Replaced front cover while preserving other artwork");
}

// Example 12: Real-world - Export artwork for web display
async function exportForWeb(audioFile: string, outputDir: string) {
  console.log("\n🎯 Example 12: Export artwork for web display");

  // Export all pictures with web-friendly names
  const exported = await exportAllPictures(audioFile, outputDir, {
    nameFormat: (picture, index) => {
      const typeMap: Record<number, string> = {
        [PICTURE_TYPE_VALUES.FrontCover]: "cover",
        [PICTURE_TYPE_VALUES.BackCover]: "back",
        [PICTURE_TYPE_VALUES.Artist]: "artist",
        [PICTURE_TYPE_VALUES.Band]: "band",
      };
      const name = typeMap[picture.type] || `artwork-${index}`;
      const ext = picture.mimeType.split("/")[1];
      return `${name}.${ext}`;
    },
  });

  console.log(`✅ Exported ${exported.length} images:`);
  exported.forEach((path) => console.log(`  - ${path}`));
}

// Example 13: Real-world - Cover art quality check
async function coverArtQualityCheck(audioFile: string) {
  console.log("\n🎯 Example 13: Cover art quality check");

  const pictures = await readPictures(audioFile);

  for (const pic of pictures) {
    const sizeKB = Math.round(pic.data.length / 1024);
    console.log(`${PictureType[pic.type]}:`);
    console.log(`  Size: ${sizeKB} KB`);
    console.log(`  Format: ${pic.mimeType}`);

    // Check for common issues
    if (sizeKB > 1000) {
      console.log(
        `  ⚠️  Warning: Large image (${sizeKB} KB) may affect file size`,
      );
    }
    if (pic.type === PICTURE_TYPE_VALUES.FrontCover && sizeKB < 50) {
      console.log(`  ⚠️  Warning: Cover art seems too small`);
    }
    if (!pic.mimeType.match(/^image\/(jpeg|png)$/)) {
      console.log(
        `  ⚠️  Warning: Non-standard format (use JPEG/PNG for compatibility)`,
      );
    }
  }
}

// Run examples
if (import.meta.main) {
  try {
    // Basic examples
    await extractCoverArt();
    showPictureTypes();

    // New real-world examples
    await quickExtractCover();
    // await quickSetCover();
    // await batchProcessAlbum("./album");
    // await manageCompleteArtwork();
    // await smartCoverReplacement();
    // await exportForWeb("song.mp3", "./web-assets");
    // await coverArtQualityCheck("song.mp3");
  } catch (error) {
    console.error("Error:", error);
  }
}

export {
  addCoverArt,
  advancedPictureHandling,
  batchProcessAlbum,
  copyPictures,
  coverArtQualityCheck,
  exportForWeb,
  extractCoverArt,
  manageCompleteArtwork,
  quickExtractCover,
  quickSetCover,
  replaceAllPictures,
  smartCoverReplacement,
};
