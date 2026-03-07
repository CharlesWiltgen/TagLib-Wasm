/**
 * Type-level machinery for format-specific property key narrowing.
 *
 * Derives valid property keys per file format from the existing PROPERTIES
 * definitions, so there is no duplication of format support data.
 */

import type { FileType } from "./audio-formats.ts";

export type TagFormat = "ID3v2" | "MP4" | "Vorbis" | "WAV";

// Unmapped FileTypes (ASF, APE, DSF, etc.) fall through to the full TagFormat
// union, meaning all property keys are accepted. This is intentional: these
// formats use tag systems not yet modeled here, so we stay permissive rather
// than blocking valid operations.
export type FileTypeToTagFormat<F extends FileType> = F extends "MP3" | "AIFF"
  ? "ID3v2"
  : F extends "MP4" ? "MP4"
  : F extends "FLAC" | "OGG" | "OPUS" | "OggFLAC" | "SPEEX" | "MATROSKA"
    ? "Vorbis"
  : F extends "WAV" ? "WAV"
  : TagFormat;

// Use intersection of sub-objects to preserve as-const tuple types
// (the spread in PROPERTIES loses narrowness for supportedFormats)
type AllPropertyDefs =
  & typeof import("../constants/basic-properties.ts").BASIC_PROPERTIES
  & typeof import("../constants/general-extended-properties.ts").GENERAL_EXTENDED_PROPERTIES
  & typeof import("../constants/specialized-properties.ts").SPECIALIZED_PROPERTIES;

type PropertyKeysForTagFormat<TF extends TagFormat> = {
  [K in keyof AllPropertyDefs]: TF extends
    AllPropertyDefs[K]["supportedFormats"][number] ? K : never;
}[keyof AllPropertyDefs];

export type FormatPropertyKey<F extends FileType> = PropertyKeysForTagFormat<
  FileTypeToTagFormat<F>
>;
