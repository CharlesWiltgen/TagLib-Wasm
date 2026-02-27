# Album Processing Guide

This guide covers the fastest and most efficient methods for processing album folders with TagLib-Wasm.

## 🚀 Quick Start: Process Album in 5 Seconds

```typescript
import { readMetadataBatch } from "taglib-wasm/simple";
import { readdir } from "fs/promises";
import { join } from "path";

async function processAlbum(albumPath: string) {
  // Get all audio files
  const files = await readdir(albumPath);
  const audioFiles = files
    .filter((f) => /\.(mp3|flac|m4a|ogg)$/i.test(f))
    .map((f) => join(albumPath, f))
    .sort(); // Ensure track order

  // Process all tracks in parallel (10-20x faster than sequential)
  const result = await readMetadataBatch(audioFiles, {
    concurrency: 8, // Optimal for most systems
  });

  return result;
}

// Process a 20-track album in ~5 seconds instead of ~100 seconds!
const album = await processAlbum("/music/Pink Floyd - The Wall");
```

## Performance Comparison

| Method                          | Time for 20 tracks | Speed          |
| ------------------------------- | ------------------ | -------------- |
| Sequential `readTags()`         | ~100 seconds       | 1x (baseline)  |
| **Batch `readTagsBatch()`**     | **~5 seconds**     | **20x faster** |
| **Batch `readMetadataBatch()`** | **~6 seconds**     | **17x faster** |
| Folder API `scanFolder()`       | ~10 seconds        | 10x faster     |

## Complete Album Analysis

### Extract Full Album Metadata

```typescript
import { readMetadataBatch } from "taglib-wasm/simple";
import { readdir } from "fs/promises";
import { basename, join } from "path";

interface AlbumAnalysis {
  albumName: string;
  albumArtist: string;
  year: number;
  genre: string;
  trackCount: number;
  totalDuration: number;
  averageBitrate: number;
  format: string;
  hasCompleteCoverArt: boolean;
  hasVolumeNormalization: boolean;
  tracks: TrackInfo[];
}

interface TrackInfo {
  filename: string;
  trackNumber: number;
  title: string;
  artist: string;
  duration: number;
  bitrate: number;
  hasCoverArt: boolean;
  hasReplayGain: boolean;
}

async function analyzeAlbum(albumPath: string): Promise<AlbumAnalysis> {
  // Get all audio files
  const files = await readdir(albumPath);
  const audioFiles = files
    .filter((f) => /\.(mp3|flac|m4a|ogg)$/i.test(f))
    .map((f) => join(albumPath, f))
    .sort();

  if (audioFiles.length === 0) {
    throw new Error("No audio files found in directory");
  }

  // Process all tracks in parallel
  console.time("Album processing");
  const result = await readMetadataBatch(audioFiles, {
    concurrency: 8,
  });
  console.timeEnd("Album processing");

  // Initialize album data
  const albumData: AlbumAnalysis = {
    albumName: "",
    albumArtist: "",
    year: 0,
    genre: "",
    trackCount: result.results.length,
    totalDuration: 0,
    averageBitrate: 0,
    format: "",
    hasCompleteCoverArt: true,
    hasVolumeNormalization: true,
    tracks: [],
  };

  // Process each track
  let totalBitrate = 0;
  const formats = new Set<string>();

  for (const { file, data } of result.results) {
    // Extract album-level data from first track
    if (albumData.albumName === "" && data.tags.album) {
      albumData.albumName = data.tags.album;
      albumData.albumArtist = data.tags.artist || "Various Artists";
      albumData.year = data.tags.year || 0;
      albumData.genre = data.tags.genre || "Unknown";
    }

    // Accumulate statistics
    if (data.properties) {
      albumData.totalDuration += data.properties.duration || 0;
      totalBitrate += data.properties.bitrate || 0;
      formats.add(data.properties.codec || "Unknown");
    }

    // Check completeness
    if (!data.hasCoverArt) {
      albumData.hasCompleteCoverArt = false;
    }

    if (!data.dynamics?.replayGainTrackGain) {
      albumData.hasVolumeNormalization = false;
    }

    // Add track info
    albumData.tracks.push({
      filename: basename(file),
      trackNumber: data.tags.track || 0,
      title: data.tags.title || basename(file),
      artist: data.tags.artist || albumData.albumArtist,
      duration: data.properties?.length || 0,
      bitrate: data.properties?.bitrate || 0,
      hasCoverArt: data.hasCoverArt || false,
      hasReplayGain: !!data.dynamics?.replayGainTrackGain,
    });
  }

  // Calculate averages
  albumData.averageBitrate = Math.round(totalBitrate / result.results.length);
  albumData.format = Array.from(formats).join(", ");

  // Sort tracks by track number
  albumData.tracks.sort((a, b) => a.trackNumber - b.trackNumber);

  return albumData;
}

// Usage example
const analysis = await analyzeAlbum("/music/Radiohead - OK Computer");
console.log(`Album: ${analysis.albumName} by ${analysis.albumArtist}`);
console.log(`Year: ${analysis.year}, Genre: ${analysis.genre}`);
console.log(`Tracks: ${analysis.trackCount}`);
console.log(`Duration: ${Math.round(analysis.totalDuration / 60)} minutes`);
console.log(`Average bitrate: ${analysis.averageBitrate} kbps`);
console.log(`Format: ${analysis.format}`);
console.log(
  `Complete cover art: ${analysis.hasCompleteCoverArt ? "Yes" : "No"}`,
);
console.log(
  `Volume normalization: ${analysis.hasVolumeNormalization ? "Yes" : "No"}`,
);
```

## Common Album Processing Tasks

### 1. Check Album Completeness

```typescript
async function checkAlbumCompleteness(albumPath: string) {
  const files = await getAudioFiles(albumPath);
  const result = await readMetadataBatch(files, { concurrency: 8 });

  const issues = {
    missingTitles: [],
    missingTrackNumbers: [],
    missingCoverArt: [],
    inconsistentAlbum: new Set(),
    inconsistentArtist: new Set(),
    missingReplayGain: [],
  };

  for (const { file, data } of result.results) {
    const filename = basename(file);

    if (!data.tags.title) issues.missingTitles.push(filename);
    if (!data.tags.track) issues.missingTrackNumbers.push(filename);
    if (!data.hasCoverArt) issues.missingCoverArt.push(filename);
    if (data.tags.album) issues.inconsistentAlbum.add(data.tags.album);
    if (data.tags.artist) issues.inconsistentArtist.add(data.tags.artist);
    if (!data.dynamics?.replayGainTrackGain) {
      issues.missingReplayGain.push(filename);
    }
  }

  return {
    isComplete: Object.values(issues).every((v) =>
      Array.isArray(v) ? v.length === 0 : v.size <= 1
    ),
    issues: {
      missingTitles: issues.missingTitles,
      missingTrackNumbers: issues.missingTrackNumbers,
      missingCoverArt: issues.missingCoverArt,
      multipleAlbumNames: issues.inconsistentAlbum.size > 1,
      multipleArtists: issues.inconsistentArtist.size > 1,
      missingReplayGain: issues.missingReplayGain,
    },
  };
}
```

### 2. Apply Album-Wide Changes

```typescript
import { writeTagsToFile } from "taglib-wasm/simple";

async function updateAlbumMetadata(
  albumPath: string,
  updates: Partial<{
    album: string;
    albumArtist: string;
    year: number;
    genre: string;
  }>,
) {
  const files = await getAudioFiles(albumPath);

  // Update all tracks in parallel
  const updatePromises = files.map(async (file) => {
    try {
      await writeTagsToFile(file, updates);
      return { file, success: true };
    } catch (error) {
      return { file, success: false, error };
    }
  });

  const results = await Promise.all(updatePromises);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  console.log(`Updated ${successful}/${files.length} tracks`);
  if (failed.length > 0) {
    console.error("Failed updates:", failed);
  }

  return results;
}

// Usage
await updateAlbumMetadata("/music/Album", {
  album: "Corrected Album Name",
  albumArtist: "Various Artists",
  year: 2024,
  genre: "Electronic",
});
```

### 3. Add Album Art to All Tracks

```typescript
import { applyCoverArt, readMetadataBatch } from "taglib-wasm/simple";
import { readFile } from "fs/promises";

async function addAlbumArt(albumPath: string, artworkPath: string) {
  const files = await getAudioFiles(albumPath);
  const artworkData = await readFile(artworkPath);
  const mimeType = getMimeType(artworkPath); // e.g., "image/jpeg"

  // Check which files need artwork
  const metadata = await readMetadataBatch(files, { concurrency: 8 });
  const filesNeedingArt = metadata.results
    .filter((r) => !r.data.hasCoverArt)
    .map((r) => r.file);

  if (filesNeedingArt.length === 0) {
    console.log("All tracks already have cover art");
    return;
  }

  console.log(`Adding artwork to ${filesNeedingArt.length} tracks...`);

  // Process in batches to avoid memory issues
  const batchSize = 5;
  for (let i = 0; i < filesNeedingArt.length; i += batchSize) {
    const batch = filesNeedingArt.slice(i, i + batchSize);

    await Promise.all(batch.map(async (file) => {
      const updatedBuffer = await applyCoverArt(file, artworkData, mimeType);
      await writeFile(file, updatedBuffer);
    }));

    console.log(
      `Progress: ${
        Math.min(i + batchSize, filesNeedingArt.length)
      }/${filesNeedingArt.length}`,
    );
  }
}
```

### 4. Generate Album Report

```typescript
async function generateAlbumReport(albumPath: string): Promise<string> {
  const analysis = await analyzeAlbum(albumPath);

  let report = `# Album Report: ${analysis.albumName}\n\n`;
  report += `**Artist:** ${analysis.albumArtist}\n`;
  report += `**Year:** ${analysis.year || "Unknown"}\n`;
  report += `**Genre:** ${analysis.genre}\n`;
  report += `**Format:** ${analysis.format}\n`;
  report += `**Total Duration:** ${formatDuration(analysis.totalDuration)}\n`;
  report += `**Average Bitrate:** ${analysis.averageBitrate} kbps\n`;
  report += `**Track Count:** ${analysis.trackCount}\n\n`;

  report += `## Quality Checks\n\n`;
  report += `- Cover Art: ${
    analysis.hasCompleteCoverArt ? "✅ Complete" : "❌ Missing on some tracks"
  }\n`;
  report += `- Volume Normalization: ${
    analysis.hasVolumeNormalization ? "✅ Present" : "❌ Missing"
  }\n\n`;

  report += `## Track List\n\n`;
  report += `| # | Title | Duration | Bitrate | Cover | RG |\n`;
  report += `|---|-------|----------|---------|-------|----|\n`;

  for (const track of analysis.tracks) {
    report += `| ${track.trackNumber} `;
    report += `| ${track.title} `;
    report += `| ${formatDuration(track.duration)} `;
    report += `| ${track.bitrate} kbps `;
    report += `| ${track.hasCoverArt ? "✅" : "❌"} `;
    report += `| ${track.hasReplayGain ? "✅" : "❌"} |\n`;
  }

  return report;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Save report
const report = await generateAlbumReport("/music/Album");
await writeFile("album-report.md", report);
```

## Performance Optimization Tips

### 1. Optimal Concurrency Settings

```typescript
// For local SSDs - maximize concurrency
const ssdResult = await readMetadataBatch(files, {
  concurrency: 12,
});

// For HDDs - moderate concurrency
const hddResult = await readMetadataBatch(files, {
  concurrency: 6,
});

// For network drives - lower concurrency
const networkResult = await readMetadataBatch(files, {
  concurrency: 4,
});
```

### 2. Memory-Efficient Album Processing

```typescript
// For large albums or limited memory
async function processLargeAlbum(albumPath: string) {
  const files = await getAudioFiles(albumPath);

  // Process in smaller batches
  const batchSize = 10;
  const results = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResult = await readMetadataBatch(batch, {
      concurrency: 4,
    });
    results.push(...batchResult.results);

    // Optional: Force garbage collection
    if (global.gc) global.gc();
  }

  return results;
}
```

### 3. Progress Tracking

```typescript
async function processAlbumWithProgress(
  albumPath: string,
  onProgress?: (current: number, total: number) => void,
) {
  const files = await getAudioFiles(albumPath);
  let processed = 0;

  const result = await readMetadataBatch(files, {
    concurrency: 8,
    onProgress: (current, total) => {
      processed = current;
      onProgress?.(current, total);
    },
  });

  return result;
}

// Usage with progress bar
await processAlbumWithProgress("/music/Album", (current, total) => {
  const percent = Math.round((current / total) * 100);
  console.log(`Processing: ${current}/${total} (${percent}%)`);
});
```

## Error Handling

```typescript
async function safeAlbumProcess(albumPath: string) {
  try {
    const result = await readMetadataBatch(await getAudioFiles(albumPath), {
      concurrency: 8,
    });

    if (result.errors.length > 0) {
      console.warn(`Failed to process ${result.errors.length} files:`);
      for (const error of result.errors) {
        console.warn(`- ${error.file}: ${error.error}`);
      }
    }

    return {
      success: true,
      processed: result.results.length,
      failed: result.errors.length,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

## Helper Functions

```typescript
// Get all audio files from a directory
async function getAudioFiles(dirPath: string): Promise<string[]> {
  const files = await readdir(dirPath);
  return files
    .filter((f) => /\.(mp3|flac|m4a|ogg|opus|wav)$/i.test(f))
    .map((f) => join(dirPath, f))
    .sort();
}

// Detect MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop();
  const mimeTypes = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
  };
  return mimeTypes[ext] || "image/jpeg";
}
```
