import type { TagLibModule, WasmModule } from "../wasm.ts";
import type { AudioFileInput, OpenOptions, TagInput } from "../types.ts";
import type { LoadTagLibOptions } from "../runtime/loader-types.ts";
import {
  isNamedAudioInput,
  type NamedAudioInput,
} from "../types/audio-formats.ts";
import { InvalidFormatError, TagLibInitializationError } from "../errors.ts";
import type { AudioFile } from "./audio-file-interface.ts";
import { AudioFileImpl } from "./audio-file-impl.ts";
import { loadAudioData } from "./load-audio-data.ts";
import { mergeTagUpdates } from "../utils/tag-mapping.ts";
import { FileOperationError } from "../errors.ts";
import { VERSION } from "../version.ts";

function toWasiPath(osPath: string): string {
  // Reject UNC paths (\\server\share\...) — not supported in WASI
  if (osPath.startsWith("\\\\") || osPath.startsWith("//")) {
    throw new FileOperationError(
      "read",
      `UNC paths are not supported. Path: ${osPath}`,
    );
  }

  let p = osPath;

  // Resolve relative paths against CWD
  if (!p.startsWith("/") && !/^[A-Za-z]:/.test(p)) {
    const g = globalThis as Record<string, unknown>;
    const cwd = typeof Deno !== "undefined"
      ? Deno.cwd()
      : (g.process as { cwd(): string })?.cwd?.();
    if (cwd) {
      p = cwd.replace(/[/\\]+$/, "") + "/" + p;
    }
  }

  // Normalize separators and map drive letter to virtual prefix
  p = p.replaceAll("\\", "/");
  const driveMatch = p.match(/^([A-Za-z]):\//);
  if (driveMatch) {
    p = `/${driveMatch[1].toUpperCase()}${p.slice(2)}`;
  }

  // Collapse dot segments and ensure leading /
  p = p.replace(/\/\.\//g, "/").replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = "/" + p;

  return p;
}

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
    const { loadTagLibModule } = await import("../runtime/module-loader.ts");
    const module = await loadTagLibModule(options);
    return new TagLib(module);
  }

  /**
   * Open an audio file for reading and writing metadata.
   * @param input - File path, Uint8Array, ArrayBuffer, File object, or NamedAudioInput.
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

    const actualInput = isNamedAudioInput(input) ? input.data : input;
    const sourcePath = typeof actualInput === "string"
      ? actualInput
      : undefined;

    // WASI path-based I/O: skip buffer loading entirely
    if (typeof actualInput === "string" && this.module.isWasi) {
      const fileHandle = this.module.createFileHandle();
      try {
        const fh = fileHandle as { loadFromPath?: (p: string) => boolean };
        if (fh.loadFromPath) {
          // Normalize path for WASI virtual filesystem
          const wasiPath = toWasiPath(actualInput);
          const success = fh.loadFromPath(wasiPath);
          if (!success) {
            throw new InvalidFormatError(
              `Failed to load audio file. Path: ${actualInput}`,
            );
          }
          return new AudioFileImpl(
            this.module,
            fileHandle,
            sourcePath,
            actualInput,
            false,
          );
        }
      } catch (error) {
        if (typeof fileHandle.destroy === "function") {
          fileHandle.destroy();
        }
        throw error;
      }
    }

    const opts = {
      partial: true,
      maxHeaderSize: 1024 * 1024,
      maxFooterSize: 128 * 1024,
      ...options,
    };

    const { data: audioData, isPartiallyLoaded } = await loadAudioData(
      actualInput,
      opts,
    );

    // Only copy when the caller passed a Uint8Array directly, since
    // loadAudioData returns the same reference in that case and the
    // WASI adapter stores the buffer. For all other inputs (path, File,
    // ArrayBuffer), loadAudioData already returns an owned copy.
    const uint8Array = actualInput instanceof Uint8Array &&
        audioData.buffer === actualInput.buffer
      ? new Uint8Array(
        audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength,
        ),
      )
      : audioData;
    const fileHandle = this.module.createFileHandle();
    try {
      const success = fileHandle.loadFromBuffer(uint8Array);
      if (!success) {
        throw new InvalidFormatError(
          "Failed to load audio file. File may be corrupted or in an unsupported format",
          uint8Array.byteLength,
        );
      }

      return new AudioFileImpl(
        this.module,
        fileHandle,
        sourcePath,
        actualInput,
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
    input: Uint8Array | ArrayBuffer | File | NamedAudioInput,
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
      mergeTagUpdates(file, tags);
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
      mergeTagUpdates(file, tags);
      await file.saveToFile(destPath);
    } finally {
      file.dispose();
    }
  }

  /** Returns the taglib-wasm version with embedded TagLib version. */
  version(): string {
    return `${VERSION} (TagLib ${this.taglibVersion()})`;
  }

  private taglibVersion(): string {
    if (this.module.getVersion) {
      return this.module.getVersion();
    }
    if (this.module.version) {
      return this.module.version();
    }
    return "unknown";
  }
}

/**
 * Create a TagLib instance from a pre-loaded Wasm module.
 */
export async function createTagLib(module: WasmModule): Promise<TagLib> {
  return new TagLib(module);
}
