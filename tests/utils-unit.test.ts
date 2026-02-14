import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, describe, it } from "@std/testing/bdd";
import {
  getFileSize,
  readFileData,
  readPartialFileData,
} from "../src/utils/file.ts";
import { writeFileData } from "../src/utils/write.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const TEMP_DIR = await Deno.makeTempDir();
const MP3_PATH = FIXTURE_PATH.mp3;

afterAll(async () => {
  await Deno.remove(TEMP_DIR, { recursive: true });
});

describe("readFileData", () => {
  it("should read from file path", async () => {
    const data = await readFileData(MP3_PATH);
    assertEquals(data instanceof Uint8Array, true);
    assertEquals(data.length > 0, true);
  });

  it("should return Uint8Array input unchanged", async () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const result = await readFileData(input);
    assertEquals(result, input);
  });

  it("should convert ArrayBuffer to Uint8Array", async () => {
    const buffer = new ArrayBuffer(4);
    new Uint8Array(buffer).set([10, 20, 30, 40]);
    const result = await readFileData(buffer);
    assertEquals(result, new Uint8Array([10, 20, 30, 40]));
  });

  it("should throw FileOperationError for non-existent path", async () => {
    await assertRejects(
      () => readFileData("/nonexistent/path/file.mp3"),
      Error,
    );
  });
});

describe("getFileSize", () => {
  it("should return correct file size", async () => {
    const size = await getFileSize(MP3_PATH);
    assertEquals(typeof size, "number");
    assertEquals(size > 0, true);
  });

  it("should match actual file data length", async () => {
    const size = await getFileSize(MP3_PATH);
    const data = await readFileData(MP3_PATH);
    assertEquals(size, data.length);
  });

  it("should throw for non-existent file", async () => {
    await assertRejects(
      () => getFileSize("/nonexistent/file.mp3"),
      Error,
    );
  });
});

describe("readPartialFileData", () => {
  it("should read header and footer sections", async () => {
    const fullData = await readFileData(MP3_PATH);
    const headerSize = 1024;
    const footerSize = 512;

    const partial = await readPartialFileData(MP3_PATH, headerSize, footerSize);

    if (fullData.length > headerSize + footerSize) {
      assertEquals(partial.length, headerSize + footerSize);
      assertEquals(
        partial.slice(0, headerSize),
        fullData.slice(0, headerSize),
      );
    }
  });

  it("should return full file for small files", async () => {
    const smallPath = `${TEMP_DIR}/small.bin`;
    const smallData = new Uint8Array([1, 2, 3, 4, 5]);
    await Deno.writeFile(smallPath, smallData);

    const partial = await readPartialFileData(smallPath, 1024, 1024);
    assertEquals(partial.length, smallData.length);
  });

  it("should throw for non-existent file", async () => {
    await assertRejects(
      () => readPartialFileData("/nonexistent/file.mp3", 1024, 512),
      Error,
    );
  });
});

describe("writeFileData", () => {
  it("should write data to file", async () => {
    const path = `${TEMP_DIR}/write-test.bin`;
    const data = new Uint8Array([100, 200, 150, 50]);
    await writeFileData(path, data);

    const readBack = await Deno.readFile(path);
    assertEquals(new Uint8Array(readBack), data);
  });

  it("should overwrite existing file", async () => {
    const path = `${TEMP_DIR}/overwrite-test.bin`;
    await writeFileData(path, new Uint8Array([1, 2, 3]));
    await writeFileData(path, new Uint8Array([4, 5, 6, 7]));

    const readBack = await Deno.readFile(path);
    assertEquals(new Uint8Array(readBack), new Uint8Array([4, 5, 6, 7]));
  });

  it("should handle empty data", async () => {
    const path = `${TEMP_DIR}/empty-test.bin`;
    await writeFileData(path, new Uint8Array(0));

    const readBack = await Deno.readFile(path);
    assertEquals(readBack.length, 0);
  });

  it("should roundtrip with readFileData", async () => {
    const path = `${TEMP_DIR}/roundtrip-test.bin`;
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;

    await writeFileData(path, original);
    const result = await readFileData(path);
    assertEquals(result, original);
  });
});
