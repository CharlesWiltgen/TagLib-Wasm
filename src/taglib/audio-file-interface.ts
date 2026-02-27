import type {
  AudioProperties,
  FileType,
  Picture,
  PropertyMap,
} from "../types.ts";
import type { Rating } from "../constants/complex-properties.ts";
import type { MutableTag } from "./mutable-tag.ts";

/**
 * Represents an audio file with metadata and audio properties.
 * Provides methods for reading and writing metadata, accessing audio properties,
 * and managing format-specific features.
 */
export interface AudioFile {
  /** Get the audio file format. */
  getFormat(): FileType;

  /** Get the tag object for reading/writing basic metadata. */
  tag(): MutableTag;

  /** Get audio properties (duration, bitrate, sample rate, etc.). */
  audioProperties(): AudioProperties | undefined;

  /** Get all metadata properties as a key-value map. */
  properties(): PropertyMap;

  /** Set multiple properties at once from a PropertyMap. */
  setProperties(properties: PropertyMap): void;

  /** Get a single property value by key (typed version). */
  getProperty<K extends import("../constants.ts").PropertyKey>(
    key: K,
  ): import("../constants.ts").PropertyValue<K> | undefined;

  /** Get a single property value by key (string version). */
  getProperty(key: string): string | undefined;

  /** Set a single property value (typed version). */
  setProperty<K extends import("../constants.ts").PropertyKey>(
    key: K,
    value: import("../constants.ts").PropertyValue<K>,
  ): void;

  /** Set a single property value (string version). */
  setProperty(key: string, value: string): void;

  /** Check if this is an MP4/M4A file. */
  isMP4(): boolean;

  /** Get an MP4-specific metadata item. */
  getMP4Item(key: string): string | undefined;

  /** Set an MP4-specific metadata item. */
  setMP4Item(key: string, value: string): void;

  /** Remove an MP4-specific metadata item. */
  removeMP4Item(key: string): void;

  /** Save all changes to the in-memory buffer. */
  save(): boolean;

  /** Get the current file data as a buffer, including any modifications. */
  getFileBuffer(): Uint8Array;

  /**
   * Save all changes to a file on disk.
   * @param path - Optional file path. If not provided, saves to the original path.
   */
  saveToFile(path?: string): Promise<void>;

  /** Check if the file was loaded successfully and is valid. */
  isValid(): boolean;

  /** Get all pictures/cover art from the audio file. */
  getPictures(): Picture[];

  /** Set pictures/cover art in the audio file (replaces all existing). */
  setPictures(pictures: Picture[]): void;

  /** Add a single picture to the audio file. */
  addPicture(picture: Picture): void;

  /** Remove all pictures from the audio file. */
  removePictures(): void;

  /** Get all ratings (normalized 0.0-1.0) from the audio file. */
  getRatings(): Rating[];

  /** Set ratings in the audio file (replaces all existing). */
  setRatings(ratings: Rating[]): void;

  /** Get the primary rating (first one found), or undefined. */
  getRating(): number | undefined;

  /** Set the primary rating (normalized 0.0-1.0). */
  setRating(rating: number, email?: string): void;

  /** Release all resources associated with this file. */
  dispose(): void;

  /** Enable `using file = ...` for automatic cleanup. */
  [Symbol.dispose](): void;

  /** Get MusicBrainz Track ID. */
  getMusicBrainzTrackId(): string | undefined;

  /** Set MusicBrainz Track ID. */
  setMusicBrainzTrackId(id: string): void;

  /** Get MusicBrainz Release ID. */
  getMusicBrainzReleaseId(): string | undefined;

  /** Set MusicBrainz Release ID. */
  setMusicBrainzReleaseId(id: string): void;

  /** Get MusicBrainz Artist ID. */
  getMusicBrainzArtistId(): string | undefined;

  /** Set MusicBrainz Artist ID. */
  setMusicBrainzArtistId(id: string): void;

  /** Get AcoustID fingerprint. */
  getAcoustIdFingerprint(): string | undefined;

  /** Set AcoustID fingerprint. */
  setAcoustIdFingerprint(fingerprint: string): void;

  /** Get AcoustID ID. */
  getAcoustIdId(): string | undefined;

  /** Set AcoustID ID. */
  setAcoustIdId(id: string): void;

  /** Get ReplayGain track gain (e.g., "-6.54 dB"). */
  getReplayGainTrackGain(): string | undefined;

  /** Set ReplayGain track gain. */
  setReplayGainTrackGain(gain: string): void;

  /** Get ReplayGain track peak (0.0-1.0). */
  getReplayGainTrackPeak(): string | undefined;

  /** Set ReplayGain track peak. */
  setReplayGainTrackPeak(peak: string): void;

  /** Get ReplayGain album gain (e.g., "-7.89 dB"). */
  getReplayGainAlbumGain(): string | undefined;

  /** Set ReplayGain album gain. */
  setReplayGainAlbumGain(gain: string): void;

  /** Get ReplayGain album peak (0.0-1.0). */
  getReplayGainAlbumPeak(): string | undefined;

  /** Set ReplayGain album peak. */
  setReplayGainAlbumPeak(peak: string): void;

  /** Get Apple Sound Check normalization data (iTunNORM). */
  getAppleSoundCheck(): string | undefined;

  /** Set Apple Sound Check normalization data. */
  setAppleSoundCheck(data: string): void;
}
