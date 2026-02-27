/**
 * Picture/artwork data embedded in audio files.
 * Represents album art, artist photos, or other images.
 *
 * @example
 * ```typescript
 * const picture: Picture = {
 *   mimeType: "image/jpeg",
 *   data: new Uint8Array(imageBuffer),
 *   type: "FrontCover",
 *   description: "Album cover"
 * };
 * ```
 */
export interface Picture {
  /** MIME type of the image */
  mimeType: string;
  /** Image data */
  data: Uint8Array;
  /** Picture type (front cover, back cover, etc.) */
  type: PictureType;
  /** Description */
  description?: string;
}

/**
 * Picture types as defined by ID3v2 APIC frame.
 * Standard picture type codes used across different formats
 * to categorize embedded images.
 *
 * @example
 * ```typescript
 * // Set front cover art
 * const coverArt = {
 *   type: "FrontCover",
 *   mimeType: "image/jpeg",
 *   data: imageData
 * };
 * ```
 */
export type PictureType =
  | "Other"
  | "FileIcon"
  | "OtherFileIcon"
  | "FrontCover"
  | "BackCover"
  | "LeafletPage"
  | "Media"
  | "LeadArtist"
  | "Artist"
  | "Conductor"
  | "Band"
  | "Composer"
  | "Lyricist"
  | "RecordingLocation"
  | "DuringRecording"
  | "DuringPerformance"
  | "MovieScreenCapture"
  | "ColouredFish"
  | "Illustration"
  | "BandLogo"
  | "PublisherLogo";

/**
 * Map of picture type names to their numeric values.
 * Used for converting between string representations and numeric codes.
 */
export const PICTURE_TYPE_VALUES: Record<PictureType, number> = {
  Other: 0,
  FileIcon: 1,
  OtherFileIcon: 2,
  FrontCover: 3,
  BackCover: 4,
  LeafletPage: 5,
  Media: 6,
  LeadArtist: 7,
  Artist: 8,
  Conductor: 9,
  Band: 10,
  Composer: 11,
  Lyricist: 12,
  RecordingLocation: 13,
  DuringRecording: 14,
  DuringPerformance: 15,
  MovieScreenCapture: 16,
  ColouredFish: 17,
  Illustration: 18,
  BandLogo: 19,
  PublisherLogo: 20,
};

/**
 * Map of numeric values to picture type names.
 * Used for converting numeric codes to string representations.
 */
export const PICTURE_TYPE_NAMES: Record<number, PictureType> = {
  0: "Other",
  1: "FileIcon",
  2: "OtherFileIcon",
  3: "FrontCover",
  4: "BackCover",
  5: "LeafletPage",
  6: "Media",
  7: "LeadArtist",
  8: "Artist",
  9: "Conductor",
  10: "Band",
  11: "Composer",
  12: "Lyricist",
  13: "RecordingLocation",
  14: "DuringRecording",
  15: "DuringPerformance",
  16: "MovieScreenCapture",
  17: "ColouredFish",
  18: "Illustration",
  19: "BandLogo",
  20: "PublisherLogo",
};

/**
 * Bitrate control modes for audio encoding (MP4/M4A specific).
 * Indicates how the audio was encoded in terms of bitrate management.
 *
 * - Constant: Fixed bitrate throughout the file
 * - LongTermAverage: Average bitrate over time
 * - VariableConstrained: Variable within limits
 * - Variable: Fully variable bitrate
 */
export type BitrateControlMode =
  | "Constant"
  | "LongTermAverage"
  | "VariableConstrained"
  | "Variable";

/**
 * Map of bitrate control mode names to their numeric values.
 * Used for converting between string representations and numeric codes
 * stored in MP4/M4A files.
 */
export const BITRATE_CONTROL_MODE_VALUES: Record<
  BitrateControlMode,
  number
> = {
  Constant: 0,
  LongTermAverage: 1,
  VariableConstrained: 2,
  Variable: 3,
};

/**
 * Map of numeric values to bitrate control mode names.
 * Used for converting numeric codes from MP4/M4A files
 * to human-readable string representations.
 */
export const BITRATE_CONTROL_MODE_NAMES: Record<
  number,
  BitrateControlMode
> = {
  0: "Constant",
  1: "LongTermAverage",
  2: "VariableConstrained",
  3: "Variable",
};
