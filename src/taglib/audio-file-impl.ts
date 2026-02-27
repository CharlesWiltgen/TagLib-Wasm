import type { FileHandle, RawPicture, TagLibModule } from "../wasm.ts";
import type { AudioFileInput, OpenOptions, Picture } from "../types.ts";
import { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "../types.ts";
import type { Rating } from "../constants/complex-properties.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { readFileData } from "../utils/file.ts";
import { writeFileData } from "../utils/write.ts";
import type { AudioFile } from "./audio-file-interface.ts";
import { ExtendedAudioFileImpl } from "./audio-file-extended.ts";

/**
 * Implementation of AudioFile interface using Embind API.
 *
 * @internal This class is not meant to be instantiated directly.
 * Use TagLib.open() to create instances.
 */
export class AudioFileImpl extends ExtendedAudioFileImpl implements AudioFile {
  constructor(
    module: TagLibModule,
    fileHandle: FileHandle,
    sourcePath?: string,
    originalSource?: AudioFileInput,
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
    return buffer ?? new Uint8Array(0);
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
      const fullData = await readFileData(this.originalSource);
      const fullFileHandle = this.module.createFileHandle();
      try {
        const success = fullFileHandle.loadFromBuffer(fullData);
        if (!success) {
          throw new InvalidFormatError(
            "Failed to load full audio file for saving",
            fullData.byteLength,
          );
        }

        const partialTag = this.handle.getTag();
        const fullTag = fullFileHandle.getTag();
        if (partialTag && fullTag) {
          fullTag.setTitle(partialTag.title());
          fullTag.setArtist(partialTag.artist());
          fullTag.setAlbum(partialTag.album());
          fullTag.setComment(partialTag.comment());
          fullTag.setGenre(partialTag.genre());
          fullTag.setYear(partialTag.year());
          fullTag.setTrack(partialTag.track());
        }

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
      await writeFileData(targetPath, this.getFileBuffer());
    }
  }

  getPictures(): Picture[] {
    const picturesArray = this.handle.getPictures();
    const pictures: Picture[] = [];
    for (let i = 0; i < picturesArray.length; i++) {
      const pic = picturesArray[i];
      pictures.push({
        mimeType: pic.mimeType,
        data: pic.data,
        type: PICTURE_TYPE_NAMES[pic.type] ?? "Other",
        description: pic.description,
      });
    }
    return pictures;
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
