export { getTagLib, setBufferMode, setSidecarConfig } from "./config.ts";

export {
  applyTagsToBuffer,
  clearTags,
  isValidAudioFile,
  readFormat,
  readProperties,
  readTags,
  writeTagsToFile,
} from "./tag-operations.ts";

export {
  addPicture,
  applyCoverArt,
  applyPictures,
  clearPictures,
  findPictureByType,
  readCoverArt,
  readPictureMetadata,
  readPictures,
  replacePictureByType,
} from "./picture-operations.ts";

export {
  readMetadataBatch,
  readPropertiesBatch,
  readTagsBatch,
} from "./batch-operations.ts";
export type { BatchOptions, BatchResult } from "./batch-operations.ts";

export {
  Album,
  AlbumArtist,
  Artist,
  Comment,
  Composer,
  DiscNumber,
  Genre,
  Title,
  Track,
  Year,
} from "./field-constants.ts";

export type {
  AudioProperties,
  Picture,
  PictureType,
  Tag,
  TagInput,
} from "../types.ts";
export { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "../types.ts";
