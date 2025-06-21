import { Table } from "jsr:@cliffy/table@1.0.0-rc.7";
import ora from "npm:ora@8.1.1";
import { dirname } from "jsr:@std/path";
import {
  type AudioFileMetadata,
  type FolderScanOptions,
  type FolderScanResult,
  scanFolder,
} from "taglib-wasm";
import { TagLib } from "taglib-wasm";
import type { ExtendedTag, Tag } from "taglib-wasm";

/**
 * Helper function to format metadata for display
 */
function formatMetadataForDisplay(
  file: AudioFileMetadata,
): Record<string, any> {
  const metadata: Record<string, any> = {
    ...file.tags,
    duration: file.properties?.length,
    bitrate: file.properties?.bitrate,
    sampleRate: file.properties?.sampleRate,
  };

  return metadata;
}

/**
 * Helper function to group files by album
 */
function groupFilesByAlbum(
  files: AudioFileMetadata[],
): Map<string, AudioFileMetadata[]> {
  const albums = new Map<string, AudioFileMetadata[]>();

  for (const file of files) {
    const albumName = file.tags.album || "Unknown Album";
    const albumFiles = albums.get(albumName) || [];
    albumFiles.push(file);
    albums.set(albumName, albumFiles);
  }

  // Sort files within each album by track number
  for (const [albumName, albumFiles] of albums) {
    albumFiles.sort((a, b) => {
      const trackA = a.tags.track || 999;
      const trackB = b.tags.track || 999;
      return trackA - trackB;
    });
  }

  return albums;
}

/**
 * Helper function to scan specific files using directory scanning
 */
async function scanSpecificFiles(
  filesToProcess: string[],
  options?: Partial<FolderScanOptions>,
): Promise<FolderScanResult> {
  // Extract unique directories from the file list
  const directories = new Set<string>();
  const fileSet = new Set(filesToProcess);

  for (const file of filesToProcess) {
    directories.add(dirname(file));
  }

  // We'll aggregate results from all directories
  const allFiles: AudioFileMetadata[] = [];
  const allErrors: Array<{ path: string; error: Error }> = [];
  let totalDuration = 0;
  let processedCount = 0;

  // Scan each directory
  for (const dir of directories) {
    try {
      const result = await scanFolder(dir, {
        recursive: false, // Don't recurse since we have specific files
        ...options,
        onProgress: (processed, total, currentFile) => {
          // Only count files that were in our original list
          if (fileSet.has(currentFile)) {
            processedCount++;
            options?.onProgress?.(
              processedCount,
              filesToProcess.length,
              currentFile,
            );
          }
        },
      });

      // Filter to only include files we care about
      const relevantFiles = result.files.filter((f) => fileSet.has(f.path));
      allFiles.push(...relevantFiles);

      // Add errors for files in our list
      const relevantErrors = result.errors.filter((e) => fileSet.has(e.path));
      allErrors.push(...relevantErrors);

      totalDuration += result.duration;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(`Error scanning directory ${dir}: ${errorMessage}`);
    }
  }

  return {
    files: allFiles,
    errors: allErrors,
    totalFound: filesToProcess.length,
    totalProcessed: processedCount,
    duration: totalDuration,
  };
}

/**
 * Display tags using the new Folder API for better performance
 */
export async function showTagsWithFolderAPI(
  filesToProcess: string[],
  quiet: boolean,
): Promise<void> {
  if (!quiet) {
    console.log("Displaying comprehensive metadata:\n");
  }

  // Create spinner
  const spinner = ora({
    text: "Reading metadata",
    suffixText: `0/${filesToProcess.length} (0%)`,
    spinner: "dots",
  }).start();

  try {
    // Initialize TagLib if needed
    const taglib = await TagLib.initialize();

    // Scan files using the helper function
    const result = await scanSpecificFiles(filesToProcess, {
      onProgress: (processed, total, _currentFile) => {
        const progress = Math.round((processed / total) * 100);
        spinner.suffixText = `${processed}/${total} (${progress}%)`;
      },
      concurrency: 8, // Process up to 8 files in parallel
      includeProperties: true, // Include audio properties
    });

    spinner.succeed(`Read metadata from ${result.files.length} files`);

    // Group files by album
    const filesByAlbum = groupFilesByAlbum(result.files);

    // Display results
    let firstAlbum = true;
    for (const [albumName, files] of filesByAlbum) {
      if (!firstAlbum) console.log("\n" + "─".repeat(80) + "\n");
      firstAlbum = false;

      console.log(`🎵 Album: ${albumName}`);
      console.log(`📁 Files: ${files.length}`);

      // Extract common album metadata
      const firstFile = files[0];
      const albumArtist = firstFile.tags?.artist || "Unknown Artist";
      const albumYear = firstFile.tags?.year;
      const albumGenre = firstFile.tags?.genre;

      if (albumArtist) console.log(`👤 Artist: ${albumArtist}`);
      if (albumYear) console.log(`📅 Year: ${albumYear}`);
      if (albumGenre) console.log(`🎼 Genre: ${albumGenre}`);

      // For ReplayGain and extended metadata, we need to use the Full API
      // since the Simple API used by scanFolder doesn't include extended metadata
      let hasExtendedMetadata = false;
      let albumGain: string | undefined;
      let albumPeak: string | undefined;

      // Check first file for album-level ReplayGain using Full API
      try {
        const audioFile = await taglib.open(firstFile.path);
        try {
          const propertyMap = audioFile.propertyMap();
          const properties = propertyMap.properties();

          // Check for ReplayGain album values
          if (properties["REPLAYGAIN_ALBUM_GAIN"]) {
            albumGain = properties["REPLAYGAIN_ALBUM_GAIN"][0];
            hasExtendedMetadata = true;
          }
          if (properties["REPLAYGAIN_ALBUM_PEAK"]) {
            albumPeak = properties["REPLAYGAIN_ALBUM_PEAK"][0];
            hasExtendedMetadata = true;
          }
        } finally {
          audioFile.dispose();
        }
      } catch (error) {
        // Ignore errors reading extended metadata
      }

      if (albumGain || albumPeak) {
        console.log("\n📊 Album ReplayGain:");
        if (albumGain) console.log(`  Gain: ${albumGain}`);
        if (albumPeak) console.log(`  Peak: ${albumPeak}`);
      }

      console.log("\n📋 Tracks:");

      // Create table for tracks
      const table = new Table()
        .header(["#", "Title", "Duration", "AcoustID", "ReplayGain"]);

      // Process each file to get extended metadata
      const extendedMetadataPromises = files.map(async (file) => {
        let acoustId = "✗";
        let replayGain = "✗";

        try {
          const audioFile = await taglib.open(file.path);
          try {
            const propertyMap = audioFile.propertyMap();
            const properties = propertyMap.properties();

            // Check for AcoustID
            if (
              properties["ACOUSTID_ID"] || properties["ACOUSTID_FINGERPRINT"]
            ) {
              acoustId = "✓";
            }

            // Check for track ReplayGain
            const replayGainInfo = [];
            if (properties["REPLAYGAIN_TRACK_GAIN"]) {
              replayGainInfo.push(
                `G: ${properties["REPLAYGAIN_TRACK_GAIN"][0]}`,
              );
            }
            if (properties["REPLAYGAIN_TRACK_PEAK"]) {
              replayGainInfo.push(
                `P: ${properties["REPLAYGAIN_TRACK_PEAK"][0]}`,
              );
            }
            if (replayGainInfo.length > 0) {
              replayGain = replayGainInfo.join(", ");
            }
          } finally {
            audioFile.dispose();
          }
        } catch (error) {
          // Ignore errors reading extended metadata
        }

        return { file, acoustId, replayGain };
      });

      const filesWithExtended = await Promise.all(extendedMetadataPromises);

      for (const { file, acoustId, replayGain } of filesWithExtended) {
        const metadata = formatMetadataForDisplay(file);
        const duration = metadata.duration
          ? formatDuration(metadata.duration as number)
          : "Unknown";

        table.push([
          metadata.track?.toString() || "-",
          (metadata.title || "Unknown Title") as string,
          duration,
          acoustId,
          replayGain,
        ]);
      }

      table.render();

      // Display audio properties summary
      const bitrates = new Set<number>();
      const sampleRates = new Set<number>();
      const formats = new Set<string>();

      for (const file of files) {
        if (file.properties?.bitrate) bitrates.add(file.properties.bitrate);
        if (file.properties?.sampleRate) {
          sampleRates.add(file.properties.sampleRate);
        }
        // Try to get format from file extension
        const ext = file.path.substring(file.path.lastIndexOf(".") + 1)
          .toUpperCase();
        formats.add(ext);
      }

      console.log("\n🎧 Audio Properties:");
      if (bitrates.size > 0) {
        console.log(`  Bitrate: ${Array.from(bitrates).join(", ")} kbps`);
      }
      if (sampleRates.size > 0) {
        console.log(`  Sample Rate: ${Array.from(sampleRates).join(", ")} Hz`);
      }
      if (formats.size > 0) {
        console.log(`  Format: ${Array.from(formats).join(", ")}`);
      }

      // Check for extended metadata presence
      const hasAcoustId = filesWithExtended.some((f) => f.acoustId === "✓");
      const hasMusicBrainz = await checkMusicBrainzPresence(taglib, files);

      if (hasAcoustId || hasMusicBrainz || hasExtendedMetadata) {
        console.log("\n🔍 Extended Metadata:");
        if (hasAcoustId) console.log("  • AcoustID data present");
        if (hasMusicBrainz) console.log("  • MusicBrainz IDs present");
        if (hasExtendedMetadata) console.log("  • ReplayGain data present");
      }
    }

    // Summary
    console.log("\n" + "═".repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`  Total files: ${result.files.length}`);
    console.log(`  Albums: ${filesByAlbum.size}`);

    const errors = result.errors.length;
    if (errors > 0) {
      console.log(`  Errors: ${errors}`);
      console.log("\n❌ Error details:");
      for (const error of result.errors) {
        console.log(`  ${error.path}: ${error.error.message}`);
      }
    }
  } catch (error) {
    spinner.fail(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * Helper function to check for MusicBrainz metadata
 */
async function checkMusicBrainzPresence(
  taglib: TagLib,
  files: AudioFileMetadata[],
): Promise<boolean> {
  for (const file of files) {
    try {
      const audioFile = await taglib.open(file.path);
      try {
        const propertyMap = audioFile.propertyMap();
        const properties = propertyMap.properties();

        // Check for any MusicBrainz properties
        const mbProperties = [
          "MUSICBRAINZ_TRACKID",
          "MUSICBRAINZ_ALBUMID",
          "MUSICBRAINZ_ARTISTID",
          "MUSICBRAINZ_RELEASEGROUPID",
          "MUSICBRAINZ_RELEASETRACKID",
        ];

        for (const prop of mbProperties) {
          if (properties[prop]) {
            return true;
          }
        }
      } finally {
        audioFile.dispose();
      }
    } catch (error) {
      // Ignore errors
    }
  }
  return false;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
