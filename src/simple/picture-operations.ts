import type { Picture, PictureType } from "../types.ts";
import { PICTURE_TYPE_VALUES } from "../types.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { getTagLib } from "./config.ts";

export async function readPictures(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Picture[]> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    return audioFile.getPictures();
  } finally {
    audioFile.dispose();
  }
}

export async function applyPictures(
  file: string | Uint8Array | ArrayBuffer | File,
  pictures: Picture[],
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    audioFile.setPictures(pictures);

    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save picture changes. The file may be read-only or corrupted.",
      );
    }

    return audioFile.getFileBuffer();
  } finally {
    audioFile.dispose();
  }
}

export async function addPicture(
  file: string | Uint8Array | ArrayBuffer | File,
  picture: Picture,
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    audioFile.addPicture(picture);

    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save picture changes. The file may be read-only or corrupted.",
      );
    }

    return audioFile.getFileBuffer();
  } finally {
    audioFile.dispose();
  }
}

export async function clearPictures(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Uint8Array> {
  return applyPictures(file, []);
}

export async function readCoverArt(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Uint8Array | null> {
  const pictures = await readPictures(file);
  if (pictures.length === 0) {
    return null;
  }

  const frontCover = pictures.find((pic) =>
    pic.type === PICTURE_TYPE_VALUES.FrontCover
  );
  if (frontCover) {
    return frontCover.data;
  }

  return pictures[0].data;
}

export async function applyCoverArt(
  file: string | Uint8Array | ArrayBuffer | File,
  imageData: Uint8Array,
  mimeType: string,
): Promise<Uint8Array> {
  const picture: Picture = {
    mimeType,
    data: imageData,
    type: PICTURE_TYPE_VALUES.FrontCover,
    description: "Front Cover",
  };
  return applyPictures(file, [picture]);
}

export function findPictureByType(
  pictures: Picture[],
  type: PictureType | number,
): Picture | null {
  const typeValue = typeof type === "string" ? PICTURE_TYPE_VALUES[type] : type;
  return pictures.find((pic) => pic.type === typeValue) || null;
}

export async function replacePictureByType(
  file: string | Uint8Array | ArrayBuffer | File,
  newPicture: Picture,
): Promise<Uint8Array> {
  const pictures = await readPictures(file);

  const filteredPictures = pictures.filter((pic) =>
    pic.type !== newPicture.type
  );

  filteredPictures.push(newPicture);

  return applyPictures(file, filteredPictures);
}

export async function readPictureMetadata(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<
  Array<{
    type: number;
    mimeType: string;
    description?: string;
    size: number;
  }>
> {
  const pictures = await readPictures(file);
  return pictures.map((pic) => ({
    type: pic.type,
    mimeType: pic.mimeType,
    description: pic.description,
    size: pic.data.length,
  }));
}
