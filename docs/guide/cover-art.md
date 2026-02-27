# Working with Cover Art

TagLib-Wasm provides comprehensive support for reading, writing, and managing
embedded pictures in audio files with both basic and advanced APIs.

## Quick Cover Art Operations

The Simple API provides the easiest way to work with cover art:

```typescript
import { applyCoverArt, readCoverArt } from "taglib-wasm/simple";

// Extract primary cover art (super simple!)
const coverData = await readCoverArt("song.mp3");
if (coverData) {
  await Deno.writeFile("cover.jpg", coverData);
}

// Set cover art from image file
const imageData = await Deno.readFile("new-cover.jpg");
const modifiedBuffer = await applyCoverArt("song.mp3", imageData, "image/jpeg");
```

## File I/O Helpers

Convenient utilities for common cover art operations:

```typescript
import { copyCoverArt, exportCoverArt, importCoverArt } from "taglib-wasm";

// Export cover art to file (one-liner!)
await exportCoverArt("song.mp3", "cover.jpg");

// Import cover art from file (modifies audio file in place)
await importCoverArt("song.mp3", "new-cover.jpg");

// Copy cover art between files
await copyCoverArt("source.mp3", "target.mp3");
```

## Browser/Canvas Integration

Special utilities for web applications:

```typescript
import { pictureToDataURL, setCoverArtFromCanvas } from "taglib-wasm/web";

// Display cover art in browser
const pictures = await readPictures("song.mp3");
const img = document.getElementById("coverArt");
img.src = pictureToDataURL(pictures[0]);

// Set cover art from HTML canvas
const canvas = document.getElementById("myCanvas");
const modifiedBuffer = await setCoverArtFromCanvas("song.mp3", canvas, {
  format: "image/jpeg",
  quality: 0.9,
});
```

## Complete Picture Management

Advanced features for managing multiple artwork types:

```typescript
import {
  applyPictures,
  readPictures,
  replacePictureByType,
} from "taglib-wasm/simple";

// Read all pictures with metadata
const pictures = await readPictures("song.mp3");
for (const pic of pictures) {
  console.log(`Type: ${pic.type}`);
  console.log(`MIME: ${pic.mimeType}`);
  console.log(`Size: ${pic.data.length} bytes`);
  console.log(`Description: ${pic.description || "none"}`);
}

// Replace specific picture type
await replacePictureByType("song.mp3", {
  mimeType: "image/png",
  data: backCoverData,
  type: "BackCover",
  description: "Album back cover",
});

// Manage multiple artwork types
await applyPictures("deluxe-album.mp3", [
  { type: "FrontCover", mimeType: "image/jpeg", data: frontData },
  { type: "BackCover", mimeType: "image/jpeg", data: backData },
  { type: "Media", mimeType: "image/jpeg", data: cdData },
  { type: "BandLogo", mimeType: "image/png", data: logoData },
]);
```

## Picture Types

TagLib-Wasm supports all standard picture types defined by ID3v2 and other
formats:

- `"Other"`
- `"FileIcon"`
- `"OtherFileIcon"`
- `"FrontCover"` (most common)
- `"BackCover"`
- `"LeafletPage"`
- `"Media"`
- `"LeadArtist"`
- `"Artist"`
- `"Conductor"`
- `"Band"`
- `"Composer"`
- `"Lyricist"`
- `"RecordingLocation"`
- `"DuringRecording"`
- `"DuringPerformance"`
- `"VideoScreenCapture"`
- `"ColouredFish"`
- `"Illustration"`
- `"BandLogo"`
- `"PublisherLogo"`

## Best Practices

1. **Image Formats**: Use JPEG for photos and PNG for logos/artwork with
   transparency
2. **Image Size**: Keep cover art under 1MB for better performance
3. **Resolution**: 600x600 pixels is a good standard for album art
4. **Memory**: Use `using` declarations with AudioFile objects to ensure cleanup
   after processing large images
5. **MIME Types**: Always specify the correct MIME type when setting pictures

## Format Support

Different audio formats have varying levels of picture support:

- **MP3 (ID3v2)**: Full support for all picture types
- **FLAC**: Full support via PICTURE blocks
- **MP4/M4A**: Limited to one cover art image
- **OGG Vorbis**: Full support via METADATA_BLOCK_PICTURE
- **WAV**: No standard picture support

## Example: Album Art Manager

Here's a complete example of managing album artwork:

```typescript
import { applyCoverArt, readPictures } from "taglib-wasm/simple";
import { readFile, writeFile } from "fs/promises";

async function updateAlbumArt(audioFile: string, artworkFile: string) {
  // Read the new artwork
  const artworkData = await readFile(artworkFile);

  // Check existing pictures
  const existingPictures = await readPictures(audioFile);
  const hasCover = existingPictures.some((p) => p.type === "FrontCover");

  if (hasCover) {
    console.log("Replacing existing cover art...");
  } else {
    console.log("Adding new cover art...");
  }

  // Set the new cover art
  const updatedBuffer = await applyCoverArt(
    audioFile,
    artworkData,
    "image/jpeg",
  );

  // Save the updated file
  await writeFile(audioFile, updatedBuffer);
  console.log("Cover art updated successfully!");
}

// Usage
await updateAlbumArt("album.mp3", "new-cover.jpg");
```
