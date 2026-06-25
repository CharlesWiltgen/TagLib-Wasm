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
- `"MovieScreenCapture"`
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

## Picture & Cover Art API

Lower-level building blocks behind the cover-art helpers above. Functions are
grouped by where they run: most work everywhere, the **canvas helpers** are
browser-only, and the **file-system helpers** require Deno/Node filesystem
access. Import picture helpers from `taglib-wasm/simple`, file-system helpers
from `taglib-wasm`, and browser helpers from `taglib-wasm/web`.

### Reading & inspecting pictures

Available in any runtime.

#### findPictureByType()

Returns the first picture of a given type from an already-loaded array (pure, no
I/O).

```typescript
function findPictureByType(
  pictures: Picture[],
  type: PictureType,
): Picture | undefined;
```

#### readPictureMetadata()

Reads each embedded picture's type, MIME type, description, and byte size
without returning the raw image data.

```typescript
function readPictureMetadata(file: AudioFileInput): Promise<
  Array<{
    type: PictureType;
    mimeType: string;
    description?: string;
    size: number;
  }>
>;
```

#### clearPictures()

Removes all embedded pictures and returns the modified file as a buffer.

```typescript
function clearPictures(file: AudioFileInput): Promise<Uint8Array>;
```

```typescript
import {
  clearPictures,
  findPictureByType,
  readPictureMetadata,
  readPictures,
} from "taglib-wasm/simple";

const meta = await readPictureMetadata("song.mp3");
console.log(`${meta.length} pictures, ${meta[0]?.size ?? 0} bytes`);

const pictures = await readPictures("song.mp3");
const front = findPictureByType(pictures, "FrontCover");

const stripped = await clearPictures("song.mp3"); // buffer with no pictures
```

### Browser / canvas helpers

Browser-only — these depend on DOM APIs (`HTMLCanvasElement`,
`HTMLImageElement`, `Blob`, `URL`, `atob`/`btoa`). Import from
`taglib-wasm/web`.

#### canvasToPicture()

Converts a canvas to a `Picture` via `toBlob` (avoids base64, faster than
data-URL conversion for large images).

```typescript
function canvasToPicture(
  canvas: HTMLCanvasElement,
  options?: {
    format?: "image/jpeg" | "image/png" | "image/webp";
    quality?: number;
    type?: PictureType;
    description?: string;
  },
): Promise<Picture>;
```

#### dataURLToPicture()

Parses a `data:<mime>;base64,...` URL into a `Picture`; throws
`InvalidFormatError` on a malformed URL.

```typescript
function dataURLToPicture(
  dataURL: string,
  type?: PictureType,
  description?: string,
): Picture;
```

#### imageFileToPicture()

Builds a `Picture` from a browser `File` (e.g. `<input type="file">` or
drag-and-drop), defaulting the description to the file name.

```typescript
function imageFileToPicture(
  file: File,
  type?: PictureType,
  description?: string,
): Promise<Picture>;
```

#### displayPicture()

Sets an `<img>` element's `src` to an object URL for the picture, revoking the
previous blob URL automatically.

```typescript
function displayPicture(picture: Picture, imgElement: HTMLImageElement): void;
```

#### createPictureDownloadURL()

Creates a temporary object URL for downloading a picture; the caller must
`URL.revokeObjectURL()` it after use.

```typescript
function createPictureDownloadURL(picture: Picture, filename?: string): string;
```

#### createPictureGallery()

Reads all pictures from a file and renders them as `<img>` elements inside a
container, with optional captions and click handler.

```typescript
function createPictureGallery(
  file: string | Uint8Array | ArrayBuffer | File,
  container: HTMLElement,
  options?: {
    className?: string;
    includeDescription?: boolean;
    onClick?: (picture: Picture, index: number) => void;
  },
): Promise<void>;
```

```typescript
import {
  canvasToPicture,
  createPictureGallery,
  displayPicture,
} from "taglib-wasm/web";
import { applyPictures } from "taglib-wasm/simple";

// Build a picture from a canvas and embed it
const picture = await canvasToPicture(canvas, {
  format: "image/png",
  type: "BackCover",
});
const buffer = await applyPictures("song.mp3", [picture]);

// Render every embedded picture into a gallery
await createPictureGallery("song.mp3", galleryDiv, {
  includeDescription: true,
});
```

### File-system helpers

Filesystem-only — these read/write image and audio files by path (Deno/Node).
Import from `taglib-wasm`.

#### loadPictureFromFile()

Reads an image file into a `Picture`, detecting the MIME type from the extension
and defaulting the description to the file's base name.

```typescript
function loadPictureFromFile(
  imagePath: string,
  type?: PictureType,
  options?: { mimeType?: string; description?: string },
): Promise<Picture>;
```

#### savePictureToFile()

Writes a picture's raw image bytes to disk.

```typescript
function savePictureToFile(picture: Picture, imagePath: string): Promise<void>;
```

#### exportAllPictures()

Saves every embedded picture into a directory and returns the created file
paths; accepts a custom `nameFormat`.

```typescript
function exportAllPictures(
  audioPath: string,
  outputDir: string,
  options?: { nameFormat?: (picture: Picture, index: number) => string },
): Promise<string[]>;
```

#### exportPictureByType()

Extracts a single picture of the given type to an image file; throws if no
picture of that type exists.

```typescript
function exportPictureByType(
  audioPath: string,
  imagePath: string,
  type: PictureType,
): Promise<void>;
```

#### importPictureWithType()

Imports an image file as a picture of the given type, replacing any existing
picture of that type; modifies the audio file in place.

```typescript
function importPictureWithType(
  audioPath: string,
  imagePath: string,
  type: PictureType,
  options?: { mimeType?: string; description?: string },
): Promise<void>;
```

#### findCoverArtFiles()

Scans the audio file's directory for common sidecar art filenames
(cover/front/folder/album/artwork/back, in `jpg/jpeg/png/gif/webp`) and returns
the matches found.

```typescript
function findCoverArtFiles(audioPath: string): Promise<{
  front?: string;
  back?: string;
  folder?: string;
  [key: string]: string | undefined;
}>;
```

```typescript
import {
  exportAllPictures,
  exportPictureByType,
  findCoverArtFiles,
  importPictureWithType,
  loadPictureFromFile,
  savePictureToFile,
} from "taglib-wasm";

// Auto-import a sidecar cover if one is present
const covers = await findCoverArtFiles("album/track01.mp3");
if (covers.front) {
  await importPictureWithType("album/track01.mp3", covers.front, "FrontCover");
}

// Export everything, then re-load and re-save a single picture
const files = await exportAllPictures("album/track01.mp3", "./artwork/");
await exportPictureByType(
  "album/track01.mp3",
  "./artwork/back.jpg",
  "BackCover",
);
const pic = await loadPictureFromFile("./artwork/back.jpg", "BackCover");
await savePictureToFile(pic, "./artwork/back-copy.jpg");
```
