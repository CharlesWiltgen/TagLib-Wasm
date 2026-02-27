import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { dataURLToPicture, pictureToDataURL } from "../src/web-utils/index.ts";
import type { Picture } from "../src/types.ts";

function makePicture(
  overrides: Partial<Picture> & { data: Uint8Array } = {
    data: new Uint8Array([0xFF, 0xD8, 0xFF]),
  },
): Picture {
  return {
    mimeType: "image/jpeg",
    type: "FrontCover",
    ...overrides,
  };
}

describe("pictureToDataURL", () => {
  it("should produce a valid data URL with correct MIME type", () => {
    const picture = makePicture({ data: new Uint8Array([0x89, 0x50, 0x4E]) });
    const result = pictureToDataURL(picture);

    assertEquals(result.startsWith("data:image/jpeg;base64,"), true);
  });

  it("should encode image/png MIME type", () => {
    const picture = makePicture({
      mimeType: "image/png",
      data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    });
    const result = pictureToDataURL(picture);

    assertEquals(result.startsWith("data:image/png;base64,"), true);
  });

  it("should produce valid base64 for known input", () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]);
    const picture = makePicture({ data });
    const result = pictureToDataURL(picture);

    assertEquals(result, "data:image/jpeg;base64,SGVsbG8=");
  });

  it("should handle empty data", () => {
    const picture = makePicture({ data: new Uint8Array(0) });
    const result = pictureToDataURL(picture);

    assertEquals(result, "data:image/jpeg;base64,");
  });

  it("should handle single byte data", () => {
    const picture = makePicture({ data: new Uint8Array([0xFF]) });
    const result = pictureToDataURL(picture);

    assertEquals(result, "data:image/jpeg;base64,/w==");
  });

  it("should handle all byte values 0-255", () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const picture = makePicture({ data: allBytes });
    const result = pictureToDataURL(picture);

    assertEquals(result.startsWith("data:image/jpeg;base64,"), true);
    assertEquals(result.length > 23, true);
  });
});

describe("dataURLToPicture", () => {
  it("should parse a valid JPEG data URL", () => {
    const dataURL = "data:image/jpeg;base64,SGVsbG8=";
    const result = dataURLToPicture(dataURL);

    assertEquals(result.mimeType, "image/jpeg");
    assertEquals(result.data, new Uint8Array([72, 101, 108, 108, 111]));
    assertEquals(result.type, "FrontCover");
    assertEquals(result.description, undefined);
  });

  it("should parse a valid PNG data URL", () => {
    const dataURL = "data:image/png;base64,AAEC";
    const result = dataURLToPicture(dataURL);

    assertEquals(result.mimeType, "image/png");
    assertEquals(result.data, new Uint8Array([0x00, 0x01, 0x02]));
  });

  it("should default to FrontCover type when no type specified", () => {
    const dataURL = "data:image/jpeg;base64,AA==";
    const result = dataURLToPicture(dataURL);

    assertEquals(result.type, "FrontCover");
  });

  it("should accept a string PictureType", () => {
    const dataURL = "data:image/jpeg;base64,AA==";
    const result = dataURLToPicture(dataURL, "BackCover");

    assertEquals(result.type, "BackCover");
  });

  it("should accept a PictureType string", () => {
    const dataURL = "data:image/jpeg;base64,AA==";
    const result = dataURLToPicture(dataURL, "LeadArtist");

    assertEquals(result.type, "LeadArtist");
  });

  it("should include description when provided", () => {
    const dataURL = "data:image/jpeg;base64,AA==";
    const result = dataURLToPicture(dataURL, "FrontCover", "Album cover art");

    assertEquals(result.description, "Album cover art");
  });

  it("should throw on missing data: prefix", () => {
    assertThrows(
      () => dataURLToPicture("image/jpeg;base64,AA=="),
      Error,
      "Invalid data URL format",
    );
  });

  it("should throw on missing base64 marker", () => {
    assertThrows(
      () => dataURLToPicture("data:image/jpeg,AA=="),
      Error,
      "Invalid data URL format",
    );
  });

  it("should throw on empty string", () => {
    assertThrows(
      () => dataURLToPicture(""),
      Error,
      "Invalid data URL format",
    );
  });

  it("should throw on plain text", () => {
    assertThrows(
      () => dataURLToPicture("not a data url at all"),
      Error,
      "Invalid data URL format",
    );
  });

  it("should throw on data URL with empty base64 payload", () => {
    assertThrows(
      () => dataURLToPicture("data:image/jpeg;base64,"),
      Error,
      "Invalid data URL format",
    );
  });
});

describe("pictureToDataURL and dataURLToPicture roundtrip", () => {
  it("should preserve data through encode/decode cycle", () => {
    const originalData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const original = makePicture({
      mimeType: "image/jpeg",
      data: originalData,
    });

    const dataURL = pictureToDataURL(original);
    const restored = dataURLToPicture(dataURL);

    assertEquals(restored.mimeType, original.mimeType);
    assertEquals(restored.data, original.data);
  });

  it("should preserve PNG data through roundtrip", () => {
    const originalData = new Uint8Array([
      0x89,
      0x50,
      0x4E,
      0x47,
      0x0D,
      0x0A,
      0x1A,
      0x0A,
    ]);
    const original = makePicture({
      mimeType: "image/png",
      data: originalData,
    });

    const dataURL = pictureToDataURL(original);
    const restored = dataURLToPicture(dataURL);

    assertEquals(restored.mimeType, "image/png");
    assertEquals(restored.data, originalData);
  });

  it("should preserve all 256 byte values through roundtrip", () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const original = makePicture({ data: allBytes });

    const dataURL = pictureToDataURL(original);
    const restored = dataURLToPicture(dataURL);

    assertEquals(restored.data, allBytes);
  });

  it("should preserve single byte through roundtrip", () => {
    const original = makePicture({ data: new Uint8Array([0x00]) });

    const dataURL = pictureToDataURL(original);
    const restored = dataURLToPicture(dataURL);

    assertEquals(restored.data, new Uint8Array([0x00]));
  });

  it("should preserve image/webp MIME type through roundtrip", () => {
    const original = makePicture({
      mimeType: "image/webp",
      data: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
    });

    const dataURL = pictureToDataURL(original);
    const restored = dataURLToPicture(dataURL);

    assertEquals(restored.mimeType, "image/webp");
    assertEquals(restored.data, original.data);
  });
});
