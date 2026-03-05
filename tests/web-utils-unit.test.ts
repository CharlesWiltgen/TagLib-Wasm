import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  canvasToPicture,
  createPictureDownloadURL,
  dataURLToPicture,
  displayPicture,
  imageFileToPicture,
  pictureToDataURL,
  setCoverArtFromCanvas,
} from "../src/web-utils/index.ts";
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

describe("imageFileToPicture", () => {
  it("should convert a File to a Picture with default type", async () => {
    const fileData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const file = new File([fileData], "cover.jpg", { type: "image/jpeg" });

    const result = await imageFileToPicture(file);

    assertEquals(result.mimeType, "image/jpeg");
    assertEquals(result.data, fileData);
    assertEquals(result.type, "FrontCover");
    assertEquals(result.description, "cover.jpg");
  });

  it("should use provided type and description", async () => {
    const fileData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    const file = new File([fileData], "back.png", { type: "image/png" });

    const result = await imageFileToPicture(file, "BackCover", "Back cover");

    assertEquals(result.mimeType, "image/png");
    assertEquals(result.type, "BackCover");
    assertEquals(result.description, "Back cover");
  });

  it("should fall back to file name when description is omitted", async () => {
    const file = new File([new Uint8Array([1])], "art.webp", {
      type: "image/webp",
    });

    const result = await imageFileToPicture(file);

    assertEquals(result.description, "art.webp");
  });

  it("should handle empty file", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });

    const result = await imageFileToPicture(file);

    assertEquals(result.data, new Uint8Array(0));
    assertEquals(result.mimeType, "image/jpeg");
  });
});

describe("canvasToPicture", () => {
  function mockCanvas(
    blobData: Uint8Array | null,
  ): HTMLCanvasElement {
    return {
      toBlob(
        callback: (blob: Blob | null) => void,
        _format?: string,
        _quality?: number,
      ) {
        if (blobData === null) {
          callback(null);
        } else {
          callback(
            new Blob([blobData.buffer as ArrayBuffer], { type: "image/jpeg" }),
          );
        }
      },
    } as unknown as HTMLCanvasElement;
  }

  it("should convert canvas blob to Picture with defaults", async () => {
    const pixelData = new Uint8Array([0xFF, 0x00, 0xFF]);
    const canvas = mockCanvas(pixelData);

    const result = await canvasToPicture(canvas);

    assertEquals(result.mimeType, "image/jpeg");
    assertEquals(result.data, pixelData);
    assertEquals(result.type, "FrontCover");
    assertEquals(result.description, undefined);
  });

  it("should use provided options", async () => {
    const pixelData = new Uint8Array([0x89, 0x50]);
    const canvas = mockCanvas(pixelData);

    const result = await canvasToPicture(canvas, {
      format: "image/png",
      quality: 1.0,
      type: "BackCover",
      description: "Canvas art",
    });

    assertEquals(result.mimeType, "image/png");
    assertEquals(result.type, "BackCover");
    assertEquals(result.description, "Canvas art");
  });

  it("should reject when canvas produces null blob", async () => {
    const canvas = mockCanvas(null);

    await assertRejects(
      () => canvasToPicture(canvas),
      Error,
      "Failed to convert canvas to blob",
    );
  });
});

describe("setCoverArtFromCanvas", () => {
  it("should call toDataURL with correct format and quality", async () => {
    const calls: { format: string; quality: number }[] = [];
    const canvas = {
      toDataURL(format: string, quality: number): string {
        calls.push({ format, quality });
        return "data:image/jpeg;base64,AAEC";
      },
    } as unknown as HTMLCanvasElement;

    try {
      await setCoverArtFromCanvas(new Uint8Array([1]), canvas, {
        format: "image/png",
        quality: 0.8,
      });
    } catch {
      // applyPictures will throw because TagLib is not initialized
    }

    assertEquals(calls.length, 1);
    assertEquals(calls[0].format, "image/png");
    assertEquals(calls[0].quality, 0.8);
  });

  it("should use default format and quality", async () => {
    const calls: { format: string; quality: number }[] = [];
    const canvas = {
      toDataURL(format: string, quality: number): string {
        calls.push({ format, quality });
        return "data:image/jpeg;base64,AAEC";
      },
    } as unknown as HTMLCanvasElement;

    try {
      await setCoverArtFromCanvas(new Uint8Array([1]), canvas);
    } catch {
      // applyPictures will throw because TagLib is not initialized
    }

    assertEquals(calls.length, 1);
    assertEquals(calls[0].format, "image/jpeg");
    assertEquals(calls[0].quality, 0.92);
  });
});

describe("displayPicture", () => {
  it("should set imgElement.src to a blob URL", () => {
    const picture = makePicture({ data: new Uint8Array([0xFF, 0xD8]) });
    const listeners: { event: string; fn: () => void }[] = [];
    const imgElement = {
      src: "",
      addEventListener(
        event: string,
        fn: () => void,
        _opts?: { once: boolean },
      ) {
        listeners.push({ event, fn });
      },
    } as unknown as HTMLImageElement;

    displayPicture(picture, imgElement);

    assertEquals(imgElement.src.startsWith("blob:"), true);
    assertEquals(listeners.length, 1);
    assertEquals(listeners[0].event, "load");
  });

  it("should revoke previous blob URL before setting new one", () => {
    const revokedURLs: string[] = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url: string) => {
      revokedURLs.push(url);
    };

    try {
      const picture = makePicture({ data: new Uint8Array([0xFF]) });
      const imgElement = {
        src: "blob:http://localhost/old-uuid",
        addEventListener() {},
      } as unknown as HTMLImageElement;

      displayPicture(picture, imgElement);

      assertEquals(
        revokedURLs.includes("blob:http://localhost/old-uuid"),
        true,
      );
      assertEquals(imgElement.src.startsWith("blob:"), true);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("should not revoke non-blob src", () => {
    const revokedURLs: string[] = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url: string) => {
      revokedURLs.push(url);
    };

    try {
      const picture = makePicture({ data: new Uint8Array([0xFF]) });
      const imgElement = {
        src: "https://example.com/image.jpg",
        addEventListener() {},
      } as unknown as HTMLImageElement;

      displayPicture(picture, imgElement);

      assertEquals(revokedURLs.length, 0);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

describe("createPictureDownloadURL", () => {
  it("should return a blob URL", () => {
    const picture = makePicture({
      data: new Uint8Array([0xFF, 0xD8, 0xFF]),
    });

    const url = createPictureDownloadURL(picture);

    assertEquals(url.startsWith("blob:"), true);
    URL.revokeObjectURL(url);
  });

  it("should create distinct URLs for different pictures", () => {
    const picture1 = makePicture({ data: new Uint8Array([1, 2, 3]) });
    const picture2 = makePicture({ data: new Uint8Array([4, 5, 6]) });

    const url1 = createPictureDownloadURL(picture1);
    const url2 = createPictureDownloadURL(picture2);

    assertEquals(url1 !== url2, true);
    URL.revokeObjectURL(url1);
    URL.revokeObjectURL(url2);
  });

  it("should work with PNG MIME type", () => {
    const picture = makePicture({
      mimeType: "image/png",
      data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    });

    const url = createPictureDownloadURL(picture, "cover.png");

    assertEquals(url.startsWith("blob:"), true);
    URL.revokeObjectURL(url);
  });
});
