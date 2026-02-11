import type { TagLibModule } from "../wasm.ts";
import type { AudioFileInput, OpenOptions, Picture } from "../types.ts";
import type { Rating } from "../constants/complex-properties.ts";
import { InvalidFormatError } from "../errors.ts";
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
    fileHandle: any,
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
      throw new Error(
        "Cannot save partially loaded file directly. Use saveToFile() instead, which will automatically load the full file.",
      );
    }

    this.cachedTag = null;
    this.cachedAudioProperties = null;
    return this.fileHandle.save();
  }

  getFileBuffer(): Uint8Array {
    const buffer = this.fileHandle.getBuffer();
    return buffer ?? new Uint8Array(0);
  }

  async saveToFile(path?: string): Promise<void> {
    const targetPath = path ?? this.sourcePath;
    if (!targetPath) {
      throw new Error(
        "No file path available. Either provide a path or open the file from a path.",
      );
    }

    if (this.isPartiallyLoaded && this.originalSource) {
      const fullData = await readFileData(this.originalSource);
      const fullFileHandle = this.module.createFileHandle();
      const success = fullFileHandle.loadFromBuffer(fullData);
      if (!success) {
        throw new InvalidFormatError(
          "Failed to load full audio file for saving",
          fullData.byteLength,
        );
      }

      const partialTag = this.fileHandle.getTag();
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

      fullFileHandle.setProperties(this.fileHandle.getProperties());
      fullFileHandle.setPictures(this.fileHandle.getPictures());

      if (!fullFileHandle.save()) {
        fullFileHandle.destroy();
        throw new Error("Failed to save changes to full file");
      }

      const buffer = fullFileHandle.getBuffer();
      fullFileHandle.destroy();
      await writeFileData(targetPath, buffer);

      this.isPartiallyLoaded = false;
      this.originalSource = undefined;
    } else {
      if (!this.save()) {
        throw new Error("Failed to save changes to in-memory buffer");
      }
      await writeFileData(targetPath, this.getFileBuffer());
    }
  }

  getPictures(): Picture[] {
    const picturesArray = this.fileHandle.getPictures();
    const pictures: Picture[] = [];
    for (let i = 0; i < picturesArray.length; i++) {
      const pic = picturesArray[i];
      pictures.push({
        mimeType: pic.mimeType,
        data: pic.data,
        type: pic.type,
        description: pic.description,
      });
    }
    return pictures;
  }

  setPictures(pictures: Picture[]): void {
    this.fileHandle.setPictures(pictures.map((pic) => ({
      mimeType: pic.mimeType,
      data: pic.data,
      type: pic.type,
      description: pic.description ?? "",
    })));
  }

  addPicture(picture: Picture): void {
    this.fileHandle.addPicture({
      mimeType: picture.mimeType,
      data: picture.data,
      type: picture.type,
      description: picture.description ?? "",
    });
  }

  removePictures(): void {
    this.fileHandle.removePictures();
  }

  getRatings(): Rating[] {
    return this.fileHandle.getRatings().map(
      (r: { rating: number; email: string; counter: number }) => ({
        rating: r.rating,
        email: r.email || undefined,
        counter: r.counter || undefined,
      }),
    );
  }

  setRatings(ratings: Rating[]): void {
    this.fileHandle.setRatings(ratings.map((r) => ({
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
