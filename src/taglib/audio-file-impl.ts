import type { FileHandle, TagLibModule } from "../wasm.ts";
import type { OpenOptions, Picture } from "../types.ts";
import { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "../types.ts";
import type { Rating } from "../constants/complex-properties.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { readFileData } from "../utils/file.ts";
import { writeFileData } from "../utils/write.ts";
import type { AudioFile } from "./audio-file-interface.ts";
import { BaseAudioFileImpl } from "./audio-file-base.ts";
import { type EmbindFileHandle, wrapEmbindHandle } from "./taglib-class.ts";

let _nodeFs: { readFileSync(path: string): Uint8Array } | null | undefined;

function readFileSync(path: string): Uint8Array {
  if (typeof Deno !== "undefined") return Deno.readFileSync(path);
  if (_nodeFs === undefined) {
    try {
      // Dynamic import cached at module level. Uses Function constructor
      // to hide from bundlers that would try to resolve "node:fs".
      _nodeFs = new Function("return require('node:fs')")();
    } catch {
      _nodeFs = null;
    }
  }
  if (_nodeFs) return new Uint8Array(_nodeFs.readFileSync(path));
  return new Uint8Array(0);
}

/**
 * Implementation of AudioFile interface using Embind API.
 *
 * @internal This class is not meant to be instantiated directly.
 * Use TagLib.open() to create instances.
 */
export class AudioFileImpl extends BaseAudioFileImpl implements AudioFile {
  private pathModeBuffer: Uint8Array | null = null;

  constructor(
    module: TagLibModule,
    fileHandle: FileHandle,
    sourcePath?: string,
    originalSource?: string | Uint8Array | ArrayBuffer | File,
    isPartiallyLoaded: boolean = false,
    partialLoadOptions?: OpenOptions,
  ) {
    super(
      module,
      fileHandle,
      sourcePath,
      originalSource,
      isPartiallyLoaded,
      partialLoadOptions,
    );
  }

  save(): boolean {
    if (this.isPartiallyLoaded && this.originalSource) {
      throw new FileOperationError(
        "save",
        "Cannot save partially loaded file directly. Use saveToFile() instead",
      );
    }

    this.cachedAudioProperties = null;
    return this.handle.save();
  }

  getFileBuffer(): Uint8Array {
    const buffer = this.handle.getBuffer();
    if (buffer.length > 0) return buffer;
    // Path-mode WASI: file data lives on disk, not in memory.
    if (this.pathModeBuffer) return this.pathModeBuffer;
    if (this.sourcePath) {
      try {
        this.pathModeBuffer = readFileSync(this.sourcePath);
        return this.pathModeBuffer;
      } catch {
        return new Uint8Array(0);
      }
    }
    return new Uint8Array(0);
  }

  async saveToFile(path?: string): Promise<void> {
    const targetPath = path ?? this.sourcePath;
    if (!targetPath) {
      throw new FileOperationError(
        "save",
        "No file path available. Provide a path or open the file from a path",
      );
    }

    if (this.isPartiallyLoaded && this.originalSource) {
      const rawFullHandle = this.module.createFileHandle();
      const fullFileHandle = this.module.isWasi
        ? rawFullHandle
        : wrapEmbindHandle(rawFullHandle as unknown as EmbindFileHandle);
      try {
        // Scope fullData so it can be GC'd after copy to Wasm heap,
        // reducing peak memory from 3x to 2x file size.
        const success = await (async () => {
          const data = await readFileData(this.originalSource!);
          return fullFileHandle.loadFromBuffer(data);
        })();
        if (!success) {
          throw new InvalidFormatError(
            "Failed to load full audio file for saving",
          );
        }

        fullFileHandle.setTagData(this.handle.getTagData());

        fullFileHandle.setProperties(this.handle.getProperties());
        fullFileHandle.setPictures(this.handle.getPictures());

        if (!fullFileHandle.save()) {
          throw new FileOperationError(
            "save",
            "Failed to save changes to full file",
          );
        }

        const buffer = fullFileHandle.getBuffer();
        await writeFileData(targetPath, buffer);
      } finally {
        fullFileHandle.destroy();
      }

      this.isPartiallyLoaded = false;
      this.originalSource = undefined;
    } else {
      if (!this.save()) {
        throw new FileOperationError(
          "save",
          "Failed to save changes to in-memory buffer",
        );
      }
      // Path-mode WASI: save() wrote directly to disk via filesystem
      // syscalls — getFileBuffer() will be empty. Skip writeFileData.
      const buffer = this.handle.getBuffer();
      if (buffer.length > 0) {
        await writeFileData(targetPath, buffer);
      }
    }
  }

  getPictures(): Picture[] {
    const picturesArray = this.handle.getPictures();
    return picturesArray.map((pic) => ({
      mimeType: pic.mimeType,
      data: pic.data,
      type: PICTURE_TYPE_NAMES[pic.type] ?? "Other",
      description: pic.description,
    }));
  }

  setPictures(pictures: Picture[]): void {
    this.handle.setPictures(pictures.map((pic) => ({
      mimeType: pic.mimeType,
      data: pic.data,
      type: PICTURE_TYPE_VALUES[pic.type] ?? 0,
      description: pic.description ?? "",
    })));
  }

  addPicture(picture: Picture): void {
    this.handle.addPicture({
      mimeType: picture.mimeType,
      data: picture.data,
      type: PICTURE_TYPE_VALUES[picture.type] ?? 0,
      description: picture.description ?? "",
    });
  }

  removePictures(): void {
    this.handle.removePictures();
  }

  getRatings(): Rating[] {
    return this.handle.getRatings().map(
      (r: { rating: number; email: string; counter: number }) => ({
        rating: r.rating,
        email: r.email || undefined,
        counter: r.counter || undefined,
      }),
    );
  }

  setRatings(ratings: Rating[]): void {
    this.handle.setRatings(ratings.map((r) => ({
      rating: r.rating,
      email: r.email ?? "",
      counter: r.counter ?? 0,
    })));
  }

  getRating(): number | undefined {
    const ratings = this.getRatings();
    return ratings.length > 0 ? ratings[0].rating : undefined;
  }

  setRating(rating: number, email?: string): void {
    this.setRatings([{ rating, email, counter: 0 }]);
  }
}
