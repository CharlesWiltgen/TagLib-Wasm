/**
 * Type definitions for folder scanning operations
 */

import type { Tag, TagInput } from "../simple/index.ts";
import type { AudioProperties } from "../types.ts";

export type { AudioProperties, Tag, TagInput };

export const EMPTY_TAG = Object.freeze(
  {
    title: [],
    artist: [],
    album: [],
    comment: [],
    genre: [],
    year: 0,
    track: 0,
  } satisfies Required<Tag>,
);

export const DEFAULT_AUDIO_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".mp4",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
  ".wav",
  ".wv",
  ".ape",
  ".mpc",
  ".tta",
  ".wma",
];

/**
 * Audio dynamics data (ReplayGain and Apple Sound Check)
 */
export interface AudioDynamics {
  /** ReplayGain track gain in dB (e.g., "-6.54 dB") */
  replayGainTrackGain?: string;
  /** ReplayGain track peak value (0.0-1.0) */
  replayGainTrackPeak?: string;
  /** ReplayGain album gain in dB */
  replayGainAlbumGain?: string;
  /** ReplayGain album peak value (0.0-1.0) */
  replayGainAlbumPeak?: string;
  /** Apple Sound Check normalization data (iTunNORM) */
  appleSoundCheck?: string;
}

/**
 * Metadata for a single audio file including path and tag information.
 * Returned by folder scanning operations.
 */
export interface AudioFileMetadata {
  /** Absolute or relative path to the audio file */
  path: string;
  /** Basic tag information (title, artist, album, etc.) */
  tags: Tag;
  /** Audio properties (duration, bitrate, sample rate, etc.) */
  properties?: AudioProperties;
  /** Whether the file contains embedded cover art */
  hasCoverArt?: boolean;
  /** Audio dynamics data (ReplayGain and Sound Check) */
  dynamics?: AudioDynamics;
  /** Any errors encountered while reading this file */
  error?: Error;
}

/**
 * Options for scanning folders
 */
export interface FolderScanOptions {
  /** Whether to scan subdirectories recursively (default: true) */
  recursive?: boolean;
  /** File extensions to include (default: common audio formats) */
  extensions?: string[];
  /** Maximum number of files to process (default: unlimited) */
  maxFiles?: number;
  /** Progress callback called after each file is processed */
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  /** Whether to include audio properties (default: true) */
  includeProperties?: boolean;
  /** Whether to continue on errors (default: true) */
  continueOnError?: boolean;
  /** Force buffer mode: Emscripten in-memory I/O (bypasses unified loader) */
  forceBufferMode?: boolean;
  /** Tag fields to compare when finding duplicates (default: ["artist", "title"]) */
  criteria?: Array<keyof Tag>;
}

/**
 * Result of a folder scan operation
 */
export interface FolderScanResult {
  /** Successfully processed files with metadata */
  files: AudioFileMetadata[];
  /** Files that failed to process */
  errors: Array<{ path: string; error: Error }>;
  /** Total number of audio files found */
  totalFound: number;
  /** Total number of files successfully processed */
  totalProcessed: number;
  /** Time taken in milliseconds */
  duration: number;
}

export interface ScanProcessOptions {
  includeProperties: boolean;
  continueOnError: boolean;
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  totalFound: number;
}

export interface ScanProcessResult {
  files: AudioFileMetadata[];
  errors: Array<{ path: string; error: Error }>;
  processed: number;
}
