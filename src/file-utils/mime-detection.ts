import type { Picture, PictureType } from "../types.ts";

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

const PICTURE_TYPE_FILENAMES: Record<PictureType, string> = {
  Other: "other",
  FileIcon: "file-icon",
  OtherFileIcon: "other-file-icon",
  FrontCover: "front-cover",
  BackCover: "back-cover",
  LeafletPage: "leaflet",
  Media: "media",
  LeadArtist: "lead-artist",
  Artist: "artist",
  Conductor: "conductor",
  Band: "band",
  Composer: "composer",
  Lyricist: "lyricist",
  RecordingLocation: "recording-location",
  DuringRecording: "during-recording",
  DuringPerformance: "during-performance",
  MovieScreenCapture: "screen-capture",
  ColouredFish: "fish",
  Illustration: "illustration",
  BandLogo: "band-logo",
  PublisherLogo: "publisher-logo",
};

export function generatePictureFilename(
  picture: Picture,
  index: number,
): string {
  const typeName = PICTURE_TYPE_FILENAMES[picture.type] ?? "other";
  const ext = picture.mimeType.split("/")[1] ?? "jpg";
  return `${typeName}-${index + 1}.${ext}`;
}
