/**
 * @fileoverview Backend adapter layer for cross-backend parameterized tests.
 *
 * Normalizes WASI and Emscripten backends to a common interface so that
 * tests can be written once and run against both.
 */

import { describe, type it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import type { AudioProperties } from "../src/types.ts";
import type { Format } from "./shared-fixtures.ts";
import {
  fileExists,
  FIXTURE_PATH,
  TEST_FILES_DIR_PATH,
} from "./shared-fixtures.ts";

export type BasicTags = {
  title: string;
  artist: string;
  album: string;
  genre: string;
  comment: string;
  year: number;
  track: number;
};

export type BasicAudioProps = Pick<
  AudioProperties,
  "length" | "bitrate" | "sampleRate" | "channels"
>;

export type ExtendedAudioProps = BasicAudioProps & {
  bitsPerSample: number;
  codec: string;
  containerFormat: string;
  isLossless: boolean;
};

export interface BackendAdapter {
  readonly kind: "wasi" | "emscripten";
  init(): Promise<void>;
  dispose(): Promise<void>;
  readTags(buffer: Uint8Array, ext: string): Promise<BasicTags>;
  readAudioProperties(
    buffer: Uint8Array,
    ext: string,
  ): Promise<BasicAudioProps>;
  readExtendedAudioProperties(
    buffer: Uint8Array,
    ext: string,
  ): Promise<ExtendedAudioProps>;
  readProperties(
    buffer: Uint8Array,
    ext: string,
  ): Promise<Record<string, string[]>>;
  readFormat(buffer: Uint8Array, ext: string): Promise<string>;
  readPictureCount(buffer: Uint8Array, ext: string): Promise<number>;
  readRatingCount(buffer: Uint8Array, ext: string): Promise<number>;
  writeTags(
    buffer: Uint8Array,
    tags: Partial<BasicTags>,
    ext: string,
  ): Promise<Uint8Array | null>;
  supportsFeature(feature: string): boolean;
}

// ---------------------------------------------------------------------------
// WASI adapter
// ---------------------------------------------------------------------------

const WASM_PATH = resolve(Deno.cwd(), "dist/wasi/taglib_wasi.wasm");
export const HAS_WASI = fileExists(WASM_PATH);

export class WasiBackendAdapter implements BackendAdapter {
  readonly kind = "wasi" as const;
  #wasi: any = null;

  async init(): Promise<void> {
    const { loadWasiHost } = await import(
      "../src/runtime/wasi-host-loader.ts"
    );
    this.#wasi = await loadWasiHost({
      wasmPath: WASM_PATH,
      preopens: { "/test": TEST_FILES_DIR_PATH },
    });
  }

  async dispose(): Promise<void> {
    if (this.#wasi) {
      this.#wasi[Symbol.dispose]();
      this.#wasi = null;
    }
  }

  async readTags(buffer: Uint8Array, _ext: string): Promise<BasicTags> {
    const { readTagsViaBuffer } = await import("./wasi-test-helpers.ts");
    const raw = readTagsViaBuffer(this.#wasi, buffer);
    return normalizeTags(raw);
  }

  async readAudioProperties(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<BasicAudioProps> {
    const { readTagsViaBuffer } = await import("./wasi-test-helpers.ts");
    const raw: any = readTagsViaBuffer(this.#wasi, buffer);
    return {
      length: raw.length ?? 0,
      bitrate: raw.bitrate ?? 0,
      sampleRate: raw.sampleRate ?? 0,
      channels: raw.channels ?? 0,
    };
  }

  async readExtendedAudioProperties(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<ExtendedAudioProps> {
    const { WasiFileHandle } = await import(
      "../src/runtime/wasi-adapter/file-handle.ts"
    );
    const handle = new WasiFileHandle(this.#wasi);
    handle.loadFromBuffer(buffer);
    const props = handle.getAudioProperties();
    const result: ExtendedAudioProps = {
      length: props?.lengthInSeconds() ?? 0,
      bitrate: props?.bitrate() ?? 0,
      sampleRate: props?.sampleRate() ?? 0,
      channels: props?.channels() ?? 0,
      bitsPerSample: props?.bitsPerSample() ?? 0,
      codec: props?.codec() ?? "",
      containerFormat: props?.containerFormat() ?? "",
      isLossless: props?.isLossless() ?? false,
    };
    handle.destroy();
    return result;
  }

  async readProperties(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<Record<string, string[]>> {
    const { WasiFileHandle } = await import(
      "../src/runtime/wasi-adapter/file-handle.ts"
    );
    const handle = new WasiFileHandle(this.#wasi);
    handle.loadFromBuffer(buffer);
    const props = handle.getProperties();
    handle.destroy();
    return props;
  }

  async readFormat(buffer: Uint8Array, _ext: string): Promise<string> {
    const { WasiFileHandle } = await import(
      "../src/runtime/wasi-adapter/file-handle.ts"
    );
    const handle = new WasiFileHandle(this.#wasi);
    handle.loadFromBuffer(buffer);
    const format = handle.getFormat();
    handle.destroy();
    return format;
  }

  async readPictureCount(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<number> {
    const { WasiFileHandle } = await import(
      "../src/runtime/wasi-adapter/file-handle.ts"
    );
    const handle = new WasiFileHandle(this.#wasi);
    handle.loadFromBuffer(buffer);
    const count = handle.getPictures().length;
    handle.destroy();
    return count;
  }

  async readRatingCount(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<number> {
    const { WasiFileHandle } = await import(
      "../src/runtime/wasi-adapter/file-handle.ts"
    );
    const handle = new WasiFileHandle(this.#wasi);
    handle.loadFromBuffer(buffer);
    const count = handle.getRatings().length;
    handle.destroy();
    return count;
  }

  async writeTags(
    buffer: Uint8Array,
    tags: Partial<BasicTags>,
    ext: string,
  ): Promise<Uint8Array | null> {
    const { loadWasiHost } = await import(
      "../src/runtime/wasi-host-loader.ts"
    );
    const { writeTagsWasi } = await import(
      "./wasi-test-helpers.ts"
    );

    const tempDir = await Deno.makeTempDir();
    const filename = `test-write.${ext}`;
    const destPath = resolve(tempDir, filename);
    await Deno.writeFile(destPath, buffer);

    try {
      using wasi = await loadWasiHost({
        wasmPath: WASM_PATH,
        preopens: { "/tmp": tempDir },
      });
      writeTagsWasi(
        wasi,
        `/tmp/${filename}`,
        tags as unknown as import("../src/types.ts").ExtendedTag,
      );

      return await Deno.readFile(destPath);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  }

  supportsFeature(feature: string): boolean {
    const supported = new Set([
      "basic-tags",
      "audio-properties",
      "write-tags",
      "format-detection",
      "pictures",
      "ratings",
      "extended-audio",
    ]);
    return supported.has(feature);
  }
}

// ---------------------------------------------------------------------------
// Emscripten adapter
// ---------------------------------------------------------------------------

export const HAS_EMSCRIPTEN = fileExists(
  resolve(Deno.cwd(), "build/taglib-wrapper.js"),
) || fileExists(resolve(Deno.cwd(), "dist/taglib-wrapper.js"));

export class EmscriptenBackendAdapter implements BackendAdapter {
  readonly kind = "emscripten" as const;
  #taglib: any = null;

  async init(): Promise<void> {
    const { TagLib } = await import("../src/mod.ts");
    this.#taglib = await TagLib.initialize({ forceBufferMode: true });
  }

  async dispose(): Promise<void> {
    this.#taglib = null;
  }

  async readTags(buffer: Uint8Array, _ext: string): Promise<BasicTags> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      const tag = file.tag();
      return {
        title: tag.title ?? "",
        artist: tag.artist ?? "",
        album: tag.album ?? "",
        genre: tag.genre ?? "",
        comment: tag.comment ?? "",
        year: tag.year ?? 0,
        track: tag.track ?? 0,
      };
    } finally {
      file.dispose();
    }
  }

  async readAudioProperties(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<BasicAudioProps> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      const props = file.audioProperties();
      return {
        length: props?.length ?? 0,
        bitrate: props?.bitrate ?? 0,
        sampleRate: props?.sampleRate ?? 0,
        channels: props?.channels ?? 0,
      };
    } finally {
      file.dispose();
    }
  }

  async readExtendedAudioProperties(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<ExtendedAudioProps> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      const props = file.audioProperties();
      return {
        length: props?.length ?? 0,
        bitrate: props?.bitrate ?? 0,
        sampleRate: props?.sampleRate ?? 0,
        channels: props?.channels ?? 0,
        bitsPerSample: props?.bitsPerSample ?? 0,
        codec: props?.codec ?? "",
        containerFormat: props?.containerFormat ?? "",
        isLossless: props?.isLossless ?? false,
      };
    } finally {
      file.dispose();
    }
  }

  async readProperties(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<Record<string, string[]>> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      return file.properties();
    } finally {
      file.dispose();
    }
  }

  async readFormat(buffer: Uint8Array, _ext: string): Promise<string> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      return file.getFormat();
    } finally {
      file.dispose();
    }
  }

  async readPictureCount(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<number> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      const pics = file.getPictures();
      return pics?.length ?? 0;
    } finally {
      file.dispose();
    }
  }

  async readRatingCount(
    buffer: Uint8Array,
    _ext: string,
  ): Promise<number> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      const ratings = file.getRatings();
      return ratings?.length ?? 0;
    } finally {
      file.dispose();
    }
  }

  async writeTags(
    buffer: Uint8Array,
    tags: Partial<BasicTags>,
    _ext: string,
  ): Promise<Uint8Array | null> {
    const file = await this.#taglib.open(buffer.buffer);
    try {
      const tag = file.tag();
      if (tags.title !== undefined) tag.setTitle(tags.title);
      if (tags.artist !== undefined) tag.setArtist(tags.artist);
      if (tags.album !== undefined) tag.setAlbum(tags.album);
      if (tags.genre !== undefined) tag.setGenre(tags.genre);
      if (tags.comment !== undefined) tag.setComment(tags.comment);
      if (tags.year !== undefined) tag.setYear(tags.year);
      if (tags.track !== undefined) tag.setTrack(tags.track);
      file.save();
      return new Uint8Array(file.getFileBuffer());
    } finally {
      file.dispose();
    }
  }

  supportsFeature(feature: string): boolean {
    const supported = new Set([
      "basic-tags",
      "audio-properties",
      "write-tags",
      "format-detection",
      "pictures",
      "ratings",
      "extended-metadata",
      "codec-detection",
      "partial-loading",
    ]);
    return supported.has(feature);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeTags(raw: any): BasicTags {
  return {
    title: raw.title ?? "",
    artist: raw.artist ?? "",
    album: raw.album ?? "",
    genre: raw.genre ?? "",
    comment: raw.comment ?? "",
    year: raw.year ?? 0,
    track: raw.track ?? 0,
  };
}

export function getAdapters(): BackendAdapter[] {
  const adapters: BackendAdapter[] = [];
  if (HAS_WASI) adapters.push(new WasiBackendAdapter());
  if (HAS_EMSCRIPTEN) adapters.push(new EmscriptenBackendAdapter());
  return adapters;
}

export function forEachBackend(
  suiteName: string,
  fn: (adapter: BackendAdapter) => void,
): void {
  const adapters = getAdapters();
  for (const adapter of adapters) {
    describe(`${suiteName} [${adapter.kind}]`, () => {
      fn(adapter);
    });
  }
}

export async function readFixture(format: Format): Promise<Uint8Array> {
  return await Deno.readFile(FIXTURE_PATH[format]);
}

export function extForFormat(format: Format): string {
  return format === "m4a" ? "m4a" : format;
}
