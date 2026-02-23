import type { TagLibModule, WasmModule } from "../wasm.ts";
import type { OpenOptions, TagInput } from "../types.ts";
import type { WasmtimeSidecar } from "../runtime/wasmtime-sidecar.ts";
import { InvalidFormatError, TagLibInitializationError } from "../errors.ts";
import type { AudioFile } from "./audio-file-interface.ts";
import { AudioFileImpl } from "./audio-file-impl.ts";
import { loadAudioData } from "./load-audio-data.ts";

/**
 * Main TagLib interface for audio metadata operations.
 */
export class TagLib {
  private readonly module: TagLibModule;
  private _sidecar?: WasmtimeSidecar;

  constructor(module: WasmModule) {
    this.module = module as TagLibModule;
  }

  get sidecar(): WasmtimeSidecar | undefined {
    return this._sidecar;
  }

  static async initialize(options?: {
    wasmBinary?: ArrayBuffer | Uint8Array;
    wasmUrl?: string;
    forceBufferMode?: boolean;
    forceWasmType?: "wasi" | "emscripten";
    disableOptimizations?: boolean;
    useSidecar?: boolean;
    sidecarConfig?: {
      preopens: Record<string, string>;
      wasmtimePath?: string;
      wasmPath?: string;
    };
  }): Promise<TagLib> {
    const { loadTagLibModule } = await import("../../index.ts");
    const module = await loadTagLibModule(options);
    const taglib = new TagLib(module);

    if (options?.useSidecar && options.sidecarConfig) {
      const { WasmtimeSidecar } = await import(
        "../runtime/wasmtime-sidecar.ts"
      );
      const sidecarWasmPath = options.sidecarConfig.wasmPath ??
        new URL("../../dist/wasi/taglib-sidecar.wasm", import.meta.url)
          .pathname;
      taglib._sidecar = new WasmtimeSidecar({
        wasmPath: sidecarWasmPath,
        preopens: options.sidecarConfig.preopens,
        wasmtimePath: options.sidecarConfig.wasmtimePath,
      });
      await taglib._sidecar.start();
    }

    return taglib;
  }

  async open(
    input: string | ArrayBuffer | Uint8Array | File,
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

  async edit(
    input: string,
    fn: (file: AudioFile) => void | Promise<void>,
  ): Promise<void>;
  async edit(
    input: Uint8Array | ArrayBuffer | File,
    fn: (file: AudioFile) => void | Promise<void>,
  ): Promise<Uint8Array>;
  async edit(
    input: string | Uint8Array | ArrayBuffer | File,
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

  async updateFile(path: string, tags: Partial<TagInput>): Promise<void> {
    const file = await this.open(path);
    try {
      applyTagUpdates(file, tags);
      await file.saveToFile();
    } finally {
      file.dispose();
    }
  }

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
