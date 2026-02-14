import type { TagLib } from "../taglib.ts";

export async function handleBatchOperations(
  taglib: TagLib,
  file: string | Uint8Array,
  operations: Array<{ method: string; args?: any[] }>,
): Promise<any> {
  const audioFile = await taglib.open(file);
  const result: any = {};

  try {
    for (const op of operations) {
      const { method, args = [] } = op;

      switch (method) {
        case "setTitle":
          audioFile.tag().setTitle(args[0]);
          break;
        case "setArtist":
          audioFile.tag().setArtist(args[0]);
          break;
        case "setAlbum":
          audioFile.tag().setAlbum(args[0]);
          break;
        case "setComment":
          audioFile.tag().setComment(args[0]);
          break;
        case "setGenre":
          audioFile.tag().setGenre(args[0]);
          break;
        case "setYear":
          audioFile.tag().setYear(args[0]);
          break;
        case "setTrack":
          audioFile.tag().setTrack(args[0]);
          break;
        case "setProperty":
          audioFile.setProperty(args[0], args[1]);
          break;
        case "setProperties":
          audioFile.setProperties(args[0]);
          break;
        case "setPictures":
          audioFile.setPictures(args[0]);
          break;
        case "addPicture":
          audioFile.addPicture(args[0]);
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
          throw new Error(`Unknown batch operation: ${method}`);
      }
    }
    return result;
  } finally {
    audioFile.dispose();
  }
}
