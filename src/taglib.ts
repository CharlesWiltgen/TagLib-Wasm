/**
 * @fileoverview Main TagLib API wrapper
 */

import type {
  AudioFormat,
  AudioProperties,
  ExtendedTag,
  FieldMapping,
  Picture,
  PropertyMap,
  Tag,
  TagLibConfig,
} from "./types";
import { METADATA_MAPPINGS } from "./types";
import {
  cStringToJS,
  jsToCString,
  loadTagLibModule,
  type TagLibModule,
} from "./wasm";

/**
 * Represents an audio file with metadata and properties
 */
export class AudioFile {
  private module: TagLibModule;
  private fileId: number;
  private tagPtr: number;
  private propsPtr: number;

  constructor(module: TagLibModule, fileId: number) {
    this.module = module;
    this.fileId = fileId;
    this.tagPtr = module._taglib_file_tag(fileId);
    this.propsPtr = module._taglib_file_audioproperties(fileId);
  }

  /**
   * Check if the file is valid and was loaded successfully
   */
  isValid(): boolean {
    return this.module._taglib_file_is_valid(this.fileId) !== 0;
  }

  /**
   * Get the file format
   */
  format(): AudioFormat {
    const formatPtr = this.module._taglib_file_format(this.fileId);
    if (formatPtr === 0) return "MP3"; // fallback
    const formatStr = cStringToJS(this.module, formatPtr);
    return formatStr as AudioFormat;
  }

  /**
   * Get basic tag information
   */
  tag(): Tag {
    if (this.tagPtr === 0) return {};

    const title = this.module._taglib_tag_title(this.tagPtr);
    const artist = this.module._taglib_tag_artist(this.tagPtr);
    const album = this.module._taglib_tag_album(this.tagPtr);
    const comment = this.module._taglib_tag_comment(this.tagPtr);
    const genre = this.module._taglib_tag_genre(this.tagPtr);
    const year = this.module._taglib_tag_year(this.tagPtr);
    const track = this.module._taglib_tag_track(this.tagPtr);

    return {
      title: title ? cStringToJS(this.module, title) : undefined,
      artist: artist ? cStringToJS(this.module, artist) : undefined,
      album: album ? cStringToJS(this.module, album) : undefined,
      comment: comment ? cStringToJS(this.module, comment) : undefined,
      genre: genre ? cStringToJS(this.module, genre) : undefined,
      year: year || undefined,
      track: track || undefined,
    };
  }

  /**
   * Get audio properties (duration, bitrate, etc.)
   */
  audioProperties(): AudioProperties | null {
    if (this.propsPtr === 0) return null;

    const length = this.module._taglib_audioproperties_length(this.propsPtr);
    const bitrate = this.module._taglib_audioproperties_bitrate(this.propsPtr);
    const sampleRate = this.module._taglib_audioproperties_samplerate(
      this.propsPtr,
    );
    const channels = this.module._taglib_audioproperties_channels(
      this.propsPtr,
    );

    return {
      length,
      bitrate,
      sampleRate,
      channels,
      format: this.format(),
    };
  }

  /**
   * Set the title tag
   */
  setTitle(title: string): void {
    if (this.tagPtr === 0) return;
    const titlePtr = jsToCString(this.module, title);
    this.module._taglib_tag_set_title(this.tagPtr, titlePtr);
    this.module._free(titlePtr);
  }

  /**
   * Set the artist tag
   */
  setArtist(artist: string): void {
    if (this.tagPtr === 0) return;
    const artistPtr = jsToCString(this.module, artist);
    this.module._taglib_tag_set_artist(this.tagPtr, artistPtr);
    this.module._free(artistPtr);
  }

  /**
   * Set the album tag
   */
  setAlbum(album: string): void {
    if (this.tagPtr === 0) return;
    const albumPtr = jsToCString(this.module, album);
    this.module._taglib_tag_set_album(this.tagPtr, albumPtr);
    this.module._free(albumPtr);
  }

  /**
   * Set the comment tag
   */
  setComment(comment: string): void {
    if (this.tagPtr === 0) return;
    const commentPtr = jsToCString(this.module, comment);
    this.module._taglib_tag_set_comment(this.tagPtr, commentPtr);
    this.module._free(commentPtr);
  }

  /**
   * Set the genre tag
   */
  setGenre(genre: string): void {
    if (this.tagPtr === 0) return;
    const genrePtr = jsToCString(this.module, genre);
    this.module._taglib_tag_set_genre(this.tagPtr, genrePtr);
    this.module._free(genrePtr);
  }

  /**
   * Set the year tag
   */
  setYear(year: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_year(this.tagPtr, year);
  }

  /**
   * Set the track number tag
   */
  setTrack(track: number): void {
    if (this.tagPtr === 0) return;
    this.module._taglib_tag_set_track(this.tagPtr, track);
  }

  /**
   * Save changes to the file
   */
  save(): boolean {
    return this.module._taglib_file_save(this.fileId) !== 0;
  }

  /**
   * Get extended metadata with format-agnostic field names
   */
  extendedTag(): ExtendedTag {
    // Get basic tags first
    const basicTag = this.tag();

    // TODO: Implement advanced metadata reading via PropertyMap
    // For now, return basic tags with placeholder for advanced fields
    return {
      ...basicTag,
      // Advanced fields would be populated by PropertyMap reading
      acoustidFingerprint: undefined,
      acoustidId: undefined,
      musicbrainzTrackId: undefined,
      musicbrainzReleaseId: undefined,
      musicbrainzArtistId: undefined,
      musicbrainzReleaseGroupId: undefined,
      albumArtist: undefined,
      composer: undefined,
      discNumber: undefined,
      totalTracks: undefined,
      totalDiscs: undefined,
      bpm: undefined,
      compilation: undefined,
      titleSort: undefined,
      artistSort: undefined,
      albumSort: undefined,
      // ReplayGain fields
      replayGainTrackGain: undefined,
      replayGainTrackPeak: undefined,
      replayGainAlbumGain: undefined,
      replayGainAlbumPeak: undefined,
      // Apple Sound Check
      appleSoundCheck: undefined,
    };
  }

  /**
   * Set extended metadata using format-agnostic field names
   * The library automatically maps fields to the correct format-specific storage
   */
  setExtendedTag(tag: Partial<ExtendedTag>): void {
    // Set basic tags using existing methods
    if (tag.title !== undefined) this.setTitle(tag.title);
    if (tag.artist !== undefined) this.setArtist(tag.artist);
    if (tag.album !== undefined) this.setAlbum(tag.album);
    if (tag.comment !== undefined) this.setComment(tag.comment);
    if (tag.genre !== undefined) this.setGenre(tag.genre);
    if (tag.year !== undefined) this.setYear(tag.year);
    if (tag.track !== undefined) this.setTrack(tag.track);

    // TODO: Implement advanced metadata writing via PropertyMap
    // For fields like acoustidFingerprint, acoustidId, etc.
  }

  /**
   * Set AcoustID fingerprint (format-agnostic)
   * Automatically stores in the correct location for each format:
   * - MP3: TXXX frame with "Acoustid Fingerprint" description
   * - FLAC/OGG: ACOUSTID_FINGERPRINT Vorbis comment
   * - MP4: ----:com.apple.iTunes:Acoustid Fingerprint atom
   */
  setAcoustidFingerprint(fingerprint: string): void {
    // TODO: Implement format-specific storage
    console.warn(
      "setAcoustidFingerprint: Advanced metadata not yet implemented",
    );
  }

  /**
   * Get AcoustID fingerprint (format-agnostic)
   */
  getAcoustidFingerprint(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set AcoustID UUID (format-agnostic)
   * Automatically stores in the correct location for each format:
   * - MP3: TXXX frame with "Acoustid Id" description
   * - FLAC/OGG: ACOUSTID_ID Vorbis comment
   * - MP4: ----:com.apple.iTunes:Acoustid Id atom
   */
  setAcoustidId(id: string): void {
    // TODO: Implement format-specific storage
    console.warn("setAcoustidId: Advanced metadata not yet implemented");
  }

  /**
   * Get AcoustID UUID (format-agnostic)
   */
  getAcoustidId(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set MusicBrainz Track ID (format-agnostic)
   */
  setMusicBrainzTrackId(id: string): void {
    // TODO: Implement format-specific storage
    console.warn(
      "setMusicBrainzTrackId: Advanced metadata not yet implemented",
    );
  }

  /**
   * Get MusicBrainz Track ID (format-agnostic)
   */
  getMusicBrainzTrackId(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set ReplayGain track gain (format-agnostic)
   * Automatically stores in the correct location for each format:
   * - MP3: TXXX frame with "ReplayGain_Track_Gain" description
   * - FLAC/OGG: REPLAYGAIN_TRACK_GAIN Vorbis comment
   * - MP4: ----:com.apple.iTunes:replaygain_track_gain atom
   */
  setReplayGainTrackGain(gain: string): void {
    // TODO: Implement format-specific storage
    console.warn(
      "setReplayGainTrackGain: Advanced metadata not yet implemented",
    );
  }

  /**
   * Get ReplayGain track gain (format-agnostic)
   */
  getReplayGainTrackGain(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set ReplayGain track peak (format-agnostic)
   */
  setReplayGainTrackPeak(peak: string): void {
    // TODO: Implement format-specific storage
    console.warn(
      "setReplayGainTrackPeak: Advanced metadata not yet implemented",
    );
  }

  /**
   * Get ReplayGain track peak (format-agnostic)
   */
  getReplayGainTrackPeak(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set ReplayGain album gain (format-agnostic)
   */
  setReplayGainAlbumGain(gain: string): void {
    // TODO: Implement format-specific storage
    console.warn(
      "setReplayGainAlbumGain: Advanced metadata not yet implemented",
    );
  }

  /**
   * Get ReplayGain album gain (format-agnostic)
   */
  getReplayGainAlbumGain(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set ReplayGain album peak (format-agnostic)
   */
  setReplayGainAlbumPeak(peak: string): void {
    // TODO: Implement format-specific storage
    console.warn(
      "setReplayGainAlbumPeak: Advanced metadata not yet implemented",
    );
  }

  /**
   * Get ReplayGain album peak (format-agnostic)
   */
  getReplayGainAlbumPeak(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Set Apple Sound Check normalization data (format-agnostic)
   * Automatically stores in the correct location for each format:
   * - MP3: TXXX frame with "iTunNORM" description
   * - FLAC/OGG: ITUNNORM Vorbis comment
   * - MP4: ----:com.apple.iTunes:iTunNORM atom
   */
  setAppleSoundCheck(iTunNORM: string): void {
    // TODO: Implement format-specific storage
    console.warn("setAppleSoundCheck: Advanced metadata not yet implemented");
  }

  /**
   * Get Apple Sound Check normalization data (format-agnostic)
   */
  getAppleSoundCheck(): string | undefined {
    // TODO: Implement format-specific reading
    return undefined;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.fileId !== 0) {
      this.module._taglib_file_delete(this.fileId);
      this.fileId = 0;
    }
  }
}

/**
 * Main TagLib class for creating and managing audio files
 */
export class TagLib {
  private module: TagLibModule;

  private constructor(module: TagLibModule) {
    this.module = module;
  }

  /**
   * Initialize TagLib with optional configuration
   */
  static async initialize(config?: TagLibConfig): Promise<TagLib> {
    const module = await loadTagLibModule(config);
    return new TagLib(module);
  }

  /**
   * Open an audio file from a buffer
   */
  openFile(buffer: Uint8Array): AudioFile {
    if (!this.module.HEAPU8) {
      throw new Error("WASM module not properly initialized - missing HEAPU8");
    }

    // Use Emscripten's allocate function for proper memory management
    const dataPtr = this.module.allocate(buffer, this.module.ALLOC_NORMAL);

    const fileId = this.module._taglib_file_new_from_buffer(
      dataPtr,
      buffer.length,
    );

    if (fileId === 0) {
      // Don't free memory immediately to debug reuse issue
      console.log(
        `DEBUG: File creation failed, not freeing memory at ${dataPtr}`,
      );
      throw new Error(
        "Failed to open audio file - invalid format or corrupted data",
      );
    }

    // Free the temporary buffer copy (TagLib has made its own copy in ByteVector)
    this.module._free(dataPtr);

    return new AudioFile(this.module, fileId);
  }

  /**
   * Get the underlying WASM module (for advanced usage)
   */
  getModule(): TagLibModule {
    return this.module;
  }
}
