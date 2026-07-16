import type {
  FileHandle,
  RawChapter,
  RawLyrics,
  TagLibModule,
} from "../wasm.ts";
import type { OpenOptions, Picture } from "../types.ts";
import { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "../types.ts";
import type { Chapter, SetChaptersOptions } from "../types/chapters.ts";
import type { BroadcastAudioExtension } from "../types/bwf.ts";
import * as bwf from "./audio-file-bwf.ts";
import type {
  Id3v2Frame,
  Rating,
  UnsyncedLyrics,
} from "../constants/complex-properties.ts";
import {
  assertFrameBodies,
  assertFrameId,
  assertMp3,
  toPublicFrame,
} from "./id3v2-frames.ts";
import {
  errorMessage,
  FileOperationError,
  UnsupportedFormatError,
} from "../errors.ts";
import { writeFileData } from "../utils/write.ts";
import { getNodeFsSync } from "../utils/node-fs.ts";
import { isDeno } from "../runtime/detector.ts";
import type { AudioFile } from "./audio-file-interface.ts";
import { BaseAudioFileImpl } from "./audio-file-base.ts";
import { saveViaFreshHandle } from "./save-reconstruct.ts";

function sortChapters<T extends { startTimeMs: number }>(
  list: readonly T[],
): T[] {
  return [...list].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function inferEndTimeMs(
  sorted: readonly { startTimeMs: number; endTimeMs?: number }[],
  index: number,
  trackEndMs: number | undefined,
): number | undefined {
  const own = sorted[index].endTimeMs;
  if (own !== undefined) return own;
  const next = sorted[index + 1];
  return next ? next.startTimeMs : trackEndMs;
}

/** @internal Exported for unit tests (tests/node-fs-acquisition.test.ts). */
export function readFileSync(path: string): Uint8Array {
  if (isDeno()) return Deno.readFileSync(path);
  const fs = getNodeFsSync();
  if (fs) return new Uint8Array(fs.readFileSync(path));
  throw new FileOperationError(
    "read",
    "node:fs is unavailable in this runtime: cannot read file data from disk",
    path,
  );
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
    // taglib-a6c: drop the path-mode cache — save() rewrites the file on
    // disk, so a pre-save snapshot would be served as stale post-save data
    this.pathModeBuffer = null;
    return this.handle.save();
  }

  getFileBuffer(): Uint8Array {
    const buffer = this.handle.getBuffer();
    if (buffer.length > 0) return buffer;
    // Path-mode WASI: file data lives on disk, not in memory.
    if (this.pathModeBuffer) return this.pathModeBuffer;
    if (this.sourcePath) {
      // taglib-0sv: never swallow read failures into an empty buffer —
      // consumers write the result back to disk, truncating their file.
      try {
        this.pathModeBuffer = readFileSync(this.sourcePath);
        return this.pathModeBuffer;
      } catch (error) {
        if (error instanceof FileOperationError) throw error;
        throw new FileOperationError(
          "read",
          `Cannot return file data: ${errorMessage(error)}`,
          this.sourcePath,
          { cause: error },
        );
      }
    }
    throw new FileOperationError(
      "read",
      "No file data available: in-memory buffer is empty and no source path is set",
    );
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
      // Partial source: the editing handle read only header+footer, so an empty
      // extra field may just be unread — do not let it wipe the original.
      await saveViaFreshHandle(
        this.module,
        this.handle,
        this.originalSource,
        targetPath,
        false,
        this.partialDeletedPropertyKeys(),
      );
      this.isPartiallyLoaded = false;
      this.originalSource = undefined;
    } else if (
      this.module.isWasi && this.sourcePath &&
      targetPath !== this.sourcePath
    ) {
      // taglib-cd0: WASI path-mode "save as". this.save() writes in-place to the
      // source path and getBuffer() is empty in path mode, so the else branch
      // would silently mutate the source and never produce targetPath. Rebuild
      // the full file from the source bytes and write it to the target instead.
      // The editing handle is a full load, so explicit clears must propagate.
      // Exact-string compare (no @std/path resolve — that JSR import doesn't
      // bundle for browser/npm): any difference safely routes here, and a
      // same-file-via-different-string just reconstructs in place, still correct.
      await saveViaFreshHandle(
        this.module,
        this.handle,
        this.sourcePath,
        targetPath,
        true,
      );
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
    // taglib-a6c: the saveViaFreshHandle branches may have rewritten the
    // source on disk; a pre-save snapshot must not survive any save path
    this.pathModeBuffer = null;
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

  getChapters(): Chapter[] {
    const sorted = sortChapters(this.handle.getChapters());
    const trackEndMs = this.audioProperties()?.durationMs;
    return sorted.map((c, i) => ({
      startTimeMs: c.startTimeMs,
      endTimeMs: inferEndTimeMs(sorted, i, trackEndMs),
      title: c.title || undefined,
      id: c.id || undefined,
      source: c.source as Chapter["source"],
    }));
  }

  setChapters(chapters: Chapter[], options?: SetChaptersOptions): void {
    const fmt = this.getFormat();
    if (fmt !== "MP3" && fmt !== "MP4") {
      throw new UnsupportedFormatError(fmt, ["MP3", "MP4"], {
        operation: "setChapters",
      });
    }
    const sorted = sortChapters(chapters);
    const trackEndMs = this.audioProperties()?.durationMs;
    const style = options?.mp4ChapterStyle ?? "quicktime";
    // Stamp the target container so a later save-as reconstruct recovers the
    // style from RawChapter.source (the registry derives it from there).
    const source = fmt === "MP4" ? style : "id3";
    const raw: RawChapter[] = sorted.map((c, i) => ({
      id: c.id,
      startTimeMs: c.startTimeMs,
      endTimeMs: inferEndTimeMs(sorted, i, trackEndMs) ?? c.startTimeMs,
      title: c.title,
      source,
    }));
    this.handle.setChapters(raw, style);
  }

  getBext(): BroadcastAudioExtension | undefined {
    return bwf.getBext(this.handle);
  }

  setBext(bext: BroadcastAudioExtension): void {
    bwf.setBext(this.handle, this.getFormat(), bext);
  }

  getBextData(): Uint8Array | undefined {
    return bwf.getBextData(this.handle);
  }

  setBextData(data: Uint8Array | null): void {
    bwf.setBextData(this.handle, this.getFormat(), data);
  }

  getIxml(): string | undefined {
    return bwf.getIxml(this.handle);
  }

  setIxml(data: string | null): void {
    bwf.setIxml(this.handle, this.getFormat(), data);
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

  getLyrics(): UnsyncedLyrics[] {
    return this.handle.getLyrics().map((l: RawLyrics) => {
      const out: UnsyncedLyrics = { text: l.text };
      if (l.description) out.description = l.description;
      if (l.language) out.language = l.language;
      return out;
    });
  }

  setLyrics(lyrics: UnsyncedLyrics[]): void {
    this.handle.setLyrics(lyrics.map((l) => ({
      text: l.text,
      description: l.description ?? "",
      language: l.language ?? "",
    })));
  }

  getRating(): number | undefined {
    const ratings = this.getRatings();
    return ratings.length > 0 ? ratings[0].rating : undefined;
  }

  setRating(rating: number, email?: string): void {
    this.setRatings([{ rating, email, counter: 0 }]);
  }

  getId3v2Frames(id?: string): Id3v2Frame[] {
    assertMp3(this.getFormat());
    if (id !== undefined) assertFrameId(id, "read");
    return this.handle.getId3v2Frames(id ?? "").map(toPublicFrame);
  }

  setId3v2Frames(id: string, data: Uint8Array[]): void {
    assertMp3(this.getFormat());
    assertFrameId(id, "write");
    assertFrameBodies(id, data);
    this.handle.setId3v2Frames(id, data);
  }

  removeId3v2Frames(id: string): void {
    assertMp3(this.getFormat());
    assertFrameId(id, "write");
    this.handle.removeId3v2Frames(id);
  }

  hasId3Tags(): { v1: boolean; v2: boolean } {
    return this.handle.hasId3Tags();
  }

  stripId3Tags(opts?: { v1?: boolean; v2?: boolean }): void {
    this.handle.stripId3Tags({
      v1: opts?.v1 ?? true,
      v2: opts?.v2 ?? true,
    });
  }
}
