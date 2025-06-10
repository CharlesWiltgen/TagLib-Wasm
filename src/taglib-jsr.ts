/**
 * @fileoverview JSR-compatible TagLib implementation
 * 
 * This version uses direct WASM loading without Emscripten's JS file
 * to be compatible with JSR publishing requirements.
 */

import type { 
  AudioFormat, 
  AudioProperties, 
  ExtendedTag, 
  Picture, 
  Tag, 
  TagLibConfig 
} from "./types.ts";
import { 
  loadTagLibModuleJSR, 
  jsToCStringJSR, 
  cStringToJSJSR,
  type TagLibModule 
} from "./wasm-jsr.ts";
import { METADATA_MAPPINGS } from "./types.ts";

/**
 * JSR-compatible TagLib singleton for WASM module management
 */
export class TagLibJSR {
  private static instance: TagLibJSR | null = null;
  private module: TagLibModule | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): TagLibJSR {
    if (!TagLibJSR.instance) {
      TagLibJSR.instance = new TagLibJSR();
    }
    return TagLibJSR.instance;
  }

  async initialize(config?: TagLibConfig): Promise<void> {
    if (this.initialized) return;
    
    this.module = await loadTagLibModuleJSR(config);
    this.initialized = true;
  }

  getModule(): TagLibModule {
    if (!this.module) {
      throw new Error("TagLib not initialized. Call TagLib.initialize() first.");
    }
    return this.module;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize TagLib WASM module
   */
  static async initialize(config?: TagLibConfig): Promise<void> {
    const instance = TagLibJSR.getInstance();
    await instance.initialize(config);
  }

  /**
   * Get the WASM module instance
   */
  static getModule(): TagLibModule {
    return TagLibJSR.getInstance().getModule();
  }

  /**
   * Check if TagLib is initialized
   */
  static isInitialized(): boolean {
    return TagLibJSR.getInstance().isInitialized();
  }
}

/**
 * JSR-compatible audio file handling class
 */
export class AudioFileJSR {
  private fileId: number = 0;
  private module: TagLibModule;
  private dataPtr: number = 0;

  constructor(data: Uint8Array) {
    this.module = TagLibJSR.getModule();
    
    // Allocate memory for file data
    this.dataPtr = this.module.allocate(data, this.module.ALLOC_NORMAL);
    
    // Create TagLib file from buffer
    this.fileId = this.module._taglib_file_new_from_buffer(this.dataPtr, data.length);
    
    if (!this.isValid()) {
      this.cleanup();
      throw new Error("Failed to load audio file - invalid format or corrupted data");
    }
  }

  /**
   * Check if the file is valid
   */
  isValid(): boolean {
    return this.module._taglib_file_is_valid(this.fileId) === 1;
  }

  /**
   * Get the audio format
   */
  getFormat(): AudioFormat {
    const formatId = this.module._taglib_file_format(this.fileId);
    const formats: Record<number, AudioFormat> = {
      1: "MP3", 
      2: "FLAC",
      3: "OGG",
      4: "MP4",
      5: "WMA",
      6: "APE",
      7: "MPC",
      8: "WV",
      9: "OPUS",
      10: "TTA",
      11: "WAV",
      12: "AIFF",
      13: "MOD",
      14: "S3M",
      15: "XM",
      16: "IT"
    };
    return formats[formatId] || "MP3";
  }

  /**
   * Get basic tag information
   */
  getTag(): Tag {
    const tagPtr = this.module._taglib_file_tag(this.fileId);
    if (tagPtr === 0) {
      return {
        title: "",
        artist: "",
        album: "",
        comment: "",
        genre: "",
        year: 0,
        track: 0
      };
    }

    return {
      title: cStringToJSJSR(this.module, this.module._taglib_tag_title(tagPtr)),
      artist: cStringToJSJSR(this.module, this.module._taglib_tag_artist(tagPtr)),
      album: cStringToJSJSR(this.module, this.module._taglib_tag_album(tagPtr)),
      comment: cStringToJSJSR(this.module, this.module._taglib_tag_comment(tagPtr)),
      genre: cStringToJSJSR(this.module, this.module._taglib_tag_genre(tagPtr)),
      year: this.module._taglib_tag_year(tagPtr),
      track: this.module._taglib_tag_track(tagPtr)
    };
  }

  /**
   * Set basic tag information
   */
  setTag(tag: Partial<Tag>): void {
    const tagPtr = this.module._taglib_file_tag(this.fileId);
    if (tagPtr === 0) return;

    if (tag.title !== undefined) {
      const titlePtr = jsToCStringJSR(this.module, tag.title);
      this.module._taglib_tag_set_title(tagPtr, titlePtr);
      this.module._free(titlePtr);
    }
    
    if (tag.artist !== undefined) {
      const artistPtr = jsToCStringJSR(this.module, tag.artist);
      this.module._taglib_tag_set_artist(tagPtr, artistPtr);
      this.module._free(artistPtr);
    }
    
    if (tag.album !== undefined) {
      const albumPtr = jsToCStringJSR(this.module, tag.album);
      this.module._taglib_tag_set_album(tagPtr, albumPtr);
      this.module._free(albumPtr);
    }
    
    if (tag.comment !== undefined) {
      const commentPtr = jsToCStringJSR(this.module, tag.comment);
      this.module._taglib_tag_set_comment(tagPtr, commentPtr);
      this.module._free(commentPtr);
    }
    
    if (tag.genre !== undefined) {
      const genrePtr = jsToCStringJSR(this.module, tag.genre);
      this.module._taglib_tag_set_genre(tagPtr, genrePtr);
      this.module._free(genrePtr);
    }
    
    if (tag.year !== undefined) {
      this.module._taglib_tag_set_year(tagPtr, tag.year);
    }
    
    if (tag.track !== undefined) {
      this.module._taglib_tag_set_track(tagPtr, tag.track);
    }
  }

  /**
   * Get audio properties
   */
  getAudioProperties(): AudioProperties {
    const propsPtr = this.module._taglib_file_audioproperties(this.fileId);
    if (propsPtr === 0) {
      return {
        length: 0,
        bitrate: 0,
        sampleRate: 0,
        channels: 0,
        format: this.getFormat()
      };
    }

    return {
      length: this.module._taglib_audioproperties_length(propsPtr),
      bitrate: this.module._taglib_audioproperties_bitrate(propsPtr),
      sampleRate: this.module._taglib_audioproperties_samplerate(propsPtr),
      channels: this.module._taglib_audioproperties_channels(propsPtr),
      format: this.getFormat()
    };
  }

  /**
   * Get extended tag information (placeholder for JSR version)
   */
  getExtendedTag(): ExtendedTag {
    // For JSR compatibility, return basic implementation
    const basicTag = this.getTag();
    return {
      ...basicTag,
      
      // Fingerprinting & identification - placeholder
      acoustidFingerprint: "",
      acoustidId: "",
      musicbrainzTrackId: "",
      musicbrainzReleaseId: "",
      musicbrainzArtistId: "",
      musicbrainzReleaseGroupId: "",
      albumArtist: "",
      composer: "",
      discNumber: 0,
      totalTracks: 0,
      totalDiscs: 0,
      bpm: 0,
      compilation: false,
      titleSort: "",
      artistSort: "",
      albumSort: "",
      
      // Volume normalization - placeholder  
      replayGainTrackGain: "",
      replayGainTrackPeak: "",
      replayGainAlbumGain: "",
      replayGainAlbumPeak: "",
      appleSoundCheck: ""
    };
  }

  /**
   * Set extended tag fields (placeholder for JSR version)
   */
  setExtendedTag(extendedTag: Partial<ExtendedTag>): void {
    // Set basic fields
    this.setTag(extendedTag);
    
    // Extended fields are placeholder for JSR version
    // Full implementation would require PropertyMap integration
  }

  /**
   * Get pictures from the file (placeholder for JSR version)
   */
  getPictures(): Picture[] {
    // Placeholder - full implementation would require format-specific picture extraction
    return [];
  }

  /**
   * Set pictures in the file (placeholder for JSR version)
   */
  setPictures(pictures: Picture[]): void {
    // Placeholder - full implementation would require format-specific picture handling
  }

  // Placeholder methods for extended metadata (same as main implementation)
  getAcoustidFingerprint(): string { return ""; }
  setAcoustidFingerprint(fingerprint: string): void {}
  getMusicbrainzTrackId(): string { return ""; }
  setMusicbrainzTrackId(id: string): void {}
  getMusicbrainzRecordingId(): string { return ""; }
  setMusicbrainzRecordingId(id: string): void {}
  getMusicbrainzArtistId(): string { return ""; }
  setMusicbrainzArtistId(id: string): void {}
  getMusicbrainzAlbumId(): string { return ""; }
  setMusicbrainzAlbumId(id: string): void {}
  getMusicbrainzAlbumArtistId(): string { return ""; }
  setMusicbrainzAlbumArtistId(id: string): void {}
  getMusicbrainzReleaseGroupId(): string { return ""; }
  setMusicbrainzReleaseGroupId(id: string): void {}
  getReplayGainTrackGain(): string { return ""; }
  setReplayGainTrackGain(gain: string): void {}
  getReplayGainTrackPeak(): string { return ""; }
  setReplayGainTrackPeak(peak: string): void {}
  getReplayGainAlbumGain(): string { return ""; }
  setReplayGainAlbumGain(gain: string): void {}
  getReplayGainAlbumPeak(): string { return ""; }
  setReplayGainAlbumPeak(peak: string): void {}
  getAppleSoundCheck(): string { return ""; }
  setAppleSoundCheck(soundCheck: string): void {}

  /**
   * Save changes to the file
   */
  save(): Uint8Array {
    if (!this.module._taglib_file_save(this.fileId)) {
      throw new Error("Failed to save audio file");
    }
    
    // In a real implementation, we'd need to extract the modified file data
    // For now, return empty array as placeholder
    return new Uint8Array(0);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.fileId) {
      this.module._taglib_file_delete(this.fileId);
      this.fileId = 0;
    }
    if (this.dataPtr) {
      this.module._free(this.dataPtr);
      this.dataPtr = 0;
    }
  }

  /**
   * Destructor to ensure cleanup
   */
  destroy(): void {
    this.cleanup();
  }
}