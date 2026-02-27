import type { TagLibModule, WasmModule } from "../wasm.ts";
import type { AudioFileInput, OpenOptions, TagInput } from "../types.ts";
import type { LoadTagLibOptions } from "../runtime/loader-types.ts";
import { InvalidFormatError, TagLibInitializationError } from "../errors.ts";
import type { AudioFile } from "./audio-file-interface.ts";
import { AudioFileImpl } from "./audio-file-impl.ts";
import { loadAudioData } from "./load-audio-data.ts";

/**
 * Main TagLib interface for audio metadata operations.
 */
export class TagLib {
  private readonly module: TagLibModule;

  constructor(module: WasmModule) {
    this.module = module as TagLibModule;
  }

  /**
   * Initialize the TagLib Wasm module and return a ready-to-use instance.
   * @param options - Wasm loading configuration (binary, URL, backend selection).
   * @returns A configured TagLib instance.
   * @throws {TagLibInitializationError} If the Wasm module fails to load.
   */
  static async initialize(options?: LoadTagLibOptions): Promise<TagLib> {
    const { loadTagLibModule } = await import("../../index.ts");
    const module = await loadTagLibModule(options);
    return new TagLib(module);
  }

  /**
   * Open an audio file for reading and writing metadata.
   * @param input - File path, Uint8Array, ArrayBuffer, or File object.
   * @param options - Partial-loading options for large files.
   * @returns An AudioFile instance (use `using` for automatic cleanup).
   * @throws {TagLibInitializationError} If the module is not properly initialized.
   * @throws {InvalidFormatError} If the file is corrupted or unsupported.
   */
  async open(
    input: AudioFileInput,
    options?: OpenOptions,
  ): Promise<AudioFile> {
    if (!this.module.createFileHandle) {
      throw new TagLibInitializationError(
        "TagLib module not properly initialized: createFileHandle not found. " +
          "Make sure the module is fully loaded before calling open.",
      );
    }

    const sourcePath = typeof input === "string" ? input : undefined;
    const opts = {
      partial: false,
      maxHeaderSize: 1024 * 1024,
      maxFooterSize: 128 * 1024,
      ...options,
    };

    const { data: audioData, isPartiallyLoaded } = await loadAudioData(
      input,
      opts,
    );

    const buffer = audioData.buffer.slice(
      audioData.byteOffset,
      audioData.byteOffset + audioData.byteLength,
    );
    const uint8Array = new Uint8Array(buffer);
    const fileHandle = this.module.createFileHandle();
    try {
      const success = fileHandle.loadFromBuffer(uint8Array);
      if (!success) {
        throw new InvalidFormatError(
          "Failed to load audio file. File may be corrupted or in an unsupported format",
          buffer.byteLength,
        );
      }

      return new AudioFileImpl(
        this.module,
        fileHandle,
        sourcePath,
        input,
        isPartiallyLoaded,
        opts,
      );
    } catch (error) {
      if (typeof fileHandle.destroy === "function") {
        fileHandle.destroy();
      }
      throw error;
    }
  }

  /**
   * Open, modify, and save an audio file in one operation.
   *
   * With a file path, edits in place on disk. With a buffer/File, returns the modified data.
   * @param input - File path for in-place editing, or buffer/File for buffer-based editing.
   * @param fn - Callback receiving the AudioFile. Changes are auto-saved after it returns.
   * @returns Nothing for file paths; modified Uint8Array for buffers.
   * @throws {InvalidFormatError} If the file is corrupted or unsupported.
   * @throws {FileOperationError} If saving to disk fails.
   */
  async edit(
    input: string,
    fn: (file: AudioFile) => void | Promise<void>,
  ): Promise<void>;
  async edit(
    input: Uint8Array | ArrayBuffer | File,
    fn: (file: AudioFile) => void | Promise<void>,
  ): Promise<Uint8Array>;
  async edit(
    input: AudioFileInput,
    fn: (file: AudioFile) => void | Promise<void>,
  ): Promise<void | Uint8Array> {
    const file = await this.open(input);
    try {
      await fn(file);
      if (typeof input === "string") {
        await file.saveToFile();
      } else {
        file.save();
        return file.getFileBuffer();
      }
    } finally {
      file.dispose();
    }
  }

  /**
   * Update tags in a file and save to disk in one operation.
   * @param path - Path to the audio file.
   * @param tags - Tag fields to update (partial update supported).
   * @throws {InvalidFormatError} If the file is corrupted or unsupported.
   * @throws {FileOperationError} If saving to disk fails.
   */
  async updateFile(path: string, tags: Partial<TagInput>): Promise<void> {
    const file = await this.open(path);
    try {
      applyTagUpdates(file, tags);
      await file.saveToFile();
    } finally {
      file.dispose();
    }
  }

  /**
   * Copy an audio file to a new path with updated tags.
   * @param sourcePath - Path to the source audio file.
   * @param destPath - Destination path for the tagged copy.
   * @param tags - Tag fields to set on the copy.
   * @throws {InvalidFormatError} If the source file is corrupted or unsupported.
   * @throws {FileOperationError} If reading or writing fails.
   */
  async copyWithTags(
    sourcePath: string,
    destPath: string,
    tags: Partial<TagInput>,
  ): Promise<void> {
    const file = await this.open(sourcePath);
    try {
      applyTagUpdates(file, tags);
      await file.saveToFile(destPath);
    } finally {
      file.dispose();
    }
  }

  /** Returns the TagLib C++ library version string. */
  version(): string {
    return "2.1.0";
  }
}

function firstString(val: string | string[]): string {
  return Array.isArray(val) ? val[0] ?? "" : val;
}

function applyTagUpdates(file: AudioFile, tags: Partial<TagInput>): void {
  const tag = file.tag();
  if (tags.title !== undefined) tag.setTitle(firstString(tags.title));
  if (tags.artist !== undefined) tag.setArtist(firstString(tags.artist));
  if (tags.album !== undefined) tag.setAlbum(firstString(tags.album));
  if (tags.year !== undefined) tag.setYear(tags.year);
  if (tags.track !== undefined) tag.setTrack(tags.track);
  if (tags.genre !== undefined) tag.setGenre(firstString(tags.genre));
  if (tags.comment !== undefined) tag.setComment(firstString(tags.comment));
}

/**
 * Create a TagLib instance from a pre-loaded Wasm module.
 */
export async function createTagLib(module: WasmModule): Promise<TagLib> {
  return new TagLib(module);
}
