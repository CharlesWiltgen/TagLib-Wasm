import type { TagLib } from "../taglib.ts";
import type { AudioProperties, Picture, PropertyMap, Tag } from "../types.ts";
import { WorkerError } from "../errors/classes.ts";

type BatchOperation = {
  method: string;
  args?: unknown[];
};

type BatchResult = {
  saved?: boolean;
  buffer?: Uint8Array;
  tag?: Tag;
  properties?: PropertyMap;
  audioProperties?: AudioProperties | null;
  pictures?: Picture[];
};

export async function handleBatchOperations(
  taglib: TagLib,
  file: string | Uint8Array,
  operations: BatchOperation[],
): Promise<BatchResult> {
  const audioFile = await taglib.open(file);
  const result: BatchResult = {};

  try {
    for (const op of operations) {
      const { method, args = [] } = op;

      switch (method) {
        case "setTitle":
          audioFile.tag().setTitle(args[0] as string);
          break;
        case "setArtist":
          audioFile.tag().setArtist(args[0] as string);
          break;
        case "setAlbum":
          audioFile.tag().setAlbum(args[0] as string);
          break;
        case "setComment":
          audioFile.tag().setComment(args[0] as string);
          break;
        case "setGenre":
          audioFile.tag().setGenre(args[0] as string);
          break;
        case "setYear":
          audioFile.tag().setYear(args[0] as number);
          break;
        case "setTrack":
          audioFile.tag().setTrack(args[0] as number);
          break;
        case "setProperty":
          audioFile.setProperty(args[0] as string, args[1] as string);
          break;
        case "setProperties":
          audioFile.setProperties(args[0] as PropertyMap);
          break;
        case "setPictures":
          audioFile.setPictures(args[0] as Picture[]);
          break;
        case "addPicture":
          audioFile.addPicture(args[0] as Picture);
          break;
        case "removePictures":
          audioFile.removePictures();
          break;
        case "save":
          result.saved = audioFile.save();
          result.buffer = audioFile.getFileBuffer();
          break;
        case "tag": {
          const tag = audioFile.tag();
          result.tag = {
            title: tag.title,
            artist: tag.artist,
            album: tag.album,
            comment: tag.comment,
            genre: tag.genre,
            year: tag.year,
            track: tag.track,
          };
          break;
        }
        case "properties":
          result.properties = audioFile.properties();
          break;
        case "audioProperties":
          result.audioProperties = audioFile.audioProperties();
          break;
        case "getPictures":
          result.pictures = audioFile.getPictures();
          break;
        default:
          throw new WorkerError(`Unknown batch operation: ${method}`);
      }
    }
    return result;
  } finally {
    audioFile.dispose();
  }
}
