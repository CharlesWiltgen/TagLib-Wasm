export { getTagLib, setBufferMode } from "./config.ts";

export {
  applyTags,
  applyTagsToFile,
  clearTags,
  isValidAudioFile,
  readFormat,
  readProperties,
  readTags,
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
  editTagsBatch,
  readMetadata,
  readMetadataBatch,
  readPropertiesBatch,
  readTagsBatch,
  writeTagsBatch,
} from "./batch-operations.ts";
export type {
  BatchItem,
  BatchOptions,
  BatchResult,
  FileMetadata,
  WriteTagUpdate,
} from "./batch-operations.ts";

export type {
  AudioProperties,
  ExtendedTag,
  Picture,
  PictureType,
  Tag,
  TagInput,
} from "../types.ts";
export { PICTURE_TYPE_NAMES, PICTURE_TYPE_VALUES } from "../types.ts";
