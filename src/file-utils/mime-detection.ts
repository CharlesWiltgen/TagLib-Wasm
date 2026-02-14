import type { Picture } from "../types.ts";
import { PICTURE_TYPE_VALUES } from "../types.ts";

const MIME_TYPES: Record<string, string> = {
  "jpg": "image/jpeg",
  "jpeg": "image/jpeg",
  "png": "image/png",
  "gif": "image/gif",
  "webp": "image/webp",
  "bmp": "image/bmp",
};

export function detectMimeType(path: string, override?: string): string {
  if (override) return override;
  const ext = path.split(".").pop()?.toLowerCase();
  return MIME_TYPES[ext ?? ""] ?? "image/jpeg";
}

export const PICTURE_TYPE_NAMES: Record<number, string> = {
  [PICTURE_TYPE_VALUES.FrontCover]: "front-cover",
  [PICTURE_TYPE_VALUES.BackCover]: "back-cover",
  [PICTURE_TYPE_VALUES.LeafletPage]: "leaflet",
  [PICTURE_TYPE_VALUES.Media]: "media",
  [PICTURE_TYPE_VALUES.LeadArtist]: "lead-artist",
  [PICTURE_TYPE_VALUES.Artist]: "artist",
  [PICTURE_TYPE_VALUES.Conductor]: "conductor",
  [PICTURE_TYPE_VALUES.Band]: "band",
  [PICTURE_TYPE_VALUES.Composer]: "composer",
  [PICTURE_TYPE_VALUES.Lyricist]: "lyricist",
  [PICTURE_TYPE_VALUES.RecordingLocation]: "recording-location",
  [PICTURE_TYPE_VALUES.DuringRecording]: "during-recording",
  [PICTURE_TYPE_VALUES.DuringPerformance]: "during-performance",
  [PICTURE_TYPE_VALUES.MovieScreenCapture]: "screen-capture",
  [PICTURE_TYPE_VALUES.ColouredFish]: "fish",
  [PICTURE_TYPE_VALUES.Illustration]: "illustration",
  [PICTURE_TYPE_VALUES.BandLogo]: "band-logo",
  [PICTURE_TYPE_VALUES.PublisherLogo]: "publisher-logo",
};

export function generatePictureFilename(
  picture: Picture,
  index: number,
): string {
  const typeName = PICTURE_TYPE_NAMES[picture.type] ?? "other";
  const ext = picture.mimeType.split("/")[1] ?? "jpg";
  return `${typeName}-${index + 1}.${ext}`;
}
