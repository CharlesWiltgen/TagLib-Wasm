import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test";
import { cleanupTempFiles, createTempFile } from "../../tests/test-utils.ts";
import {
  _resetPlatformIO,
  _setPlatformIOForTesting,
  getPlatformIO,
} from "./platform-io.ts";

// `createTempFile` shares ONE `mkdtemp` directory per test module, so the
// cleanup belongs in `afterAll`; the previous per-call `mkdtemp` leaked a
// directory for every file the suite touched.
afterAll(cleanupTempFiles);

describe("getPlatformIO", () => {
  afterEach(() => {
    _resetPlatformIO();
  });

  it("should return a PlatformIO with all required methods", () => {
    const io = getPlatformIO();
    expect(typeof io.readFile).toBe("function");
    expect(typeof io.writeFile).toBe("function");
    expect(typeof io.stat).toBe("function");
    expect(typeof io.readDir).toBe("function");
  });

  it("should return the same singleton on repeated calls", () => {
    const io1 = getPlatformIO();
    const io2 = getPlatformIO();
    expect(io1).toBe(io2);
  });

  it("should return a fresh instance after _resetPlatformIO", () => {
    const io1 = getPlatformIO();
    _resetPlatformIO();
    const io2 = getPlatformIO();
    expect(io1).not.toBe(io2);
  });

  describe("readFile", () => {
    it("should read a file and return Uint8Array", async () => {
      const tmpFile = await createTempFile();
      try {
        const data = new TextEncoder().encode("hello platform-io");
        await writeFile(tmpFile, data);

        const io = getPlatformIO();
        const result = await io.readFile(tmpFile);
        expect(result).toEqual(data);
      } finally {
        await rm(tmpFile, { force: true });
      }
    });
  });

  describe("writeFile", () => {
    it("should write data to a file", async () => {
      const tmpFile = await createTempFile();
      try {
        const data = new TextEncoder().encode("written by platform-io");
        const io = getPlatformIO();
        await io.writeFile(tmpFile, data);

        const result = new Uint8Array(await readFile(tmpFile));
        expect(result).toEqual(data);
      } finally {
        await rm(tmpFile, { force: true });
      }
    });
  });

  describe("stat", () => {
    it("should return file size", async () => {
      const tmpFile = await createTempFile();
      try {
        const data = new Uint8Array(42);
        await writeFile(tmpFile, data);

        const io = getPlatformIO();
        const s = await io.stat(tmpFile);
        expect(s.size).toBe(42);
      } finally {
        await rm(tmpFile, { force: true });
      }
    });
  });

  describe("readDir", () => {
    it("should yield directory entries", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "platform-io-"));
      try {
        await writeFile(join(tmpDir, "a.txt"), "a");
        await mkdir(join(tmpDir, "subdir"));

        const io = getPlatformIO();
        const entries: {
          name: string;
          isFile: boolean;
          isDirectory: boolean;
        }[] = [];
        for await (const entry of io.readDir(tmpDir)) {
          entries.push(entry);
        }

        const names = entries
          .map((e) => e.name)
          .sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(["a.txt", "subdir"]);

        const fileEntry = entries.find((e) => e.name === "a.txt")!;
        expect(fileEntry.isFile).toBe(true);
        expect(fileEntry.isDirectory).toBe(false);

        const dirEntry = entries.find((e) => e.name === "subdir")!;
        expect(dirEntry.isFile).toBe(false);
        expect(dirEntry.isDirectory).toBe(true);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("readPartial", () => {
    it("should read header and footer of a file", async () => {
      const tmpFile = await createTempFile();
      try {
        const data = new Uint8Array(100);
        for (let i = 0; i < 100; i++) data[i] = i;
        await writeFile(tmpFile, data);

        const io = getPlatformIO();
        expect(io.readPartial).toBeDefined();
        const result = await io.readPartial!(tmpFile, 10, 10);
        expect(result.length).toBe(20);
        expect(result.slice(0, 10)).toEqual(data.slice(0, 10));
        expect(result.slice(10)).toEqual(data.slice(90));
      } finally {
        await rm(tmpFile, { force: true });
      }
    });

    it("should return full file when header and footer overlap", async () => {
      const tmpFile = await createTempFile();
      try {
        const data = new Uint8Array(15);
        for (let i = 0; i < 15; i++) data[i] = i;
        await writeFile(tmpFile, data);

        const io = getPlatformIO();
        const result = await io.readPartial!(tmpFile, 10, 10);
        expect(result.length).toBe(15);
        expect(result).toEqual(data);
      } finally {
        await rm(tmpFile, { force: true });
      }
    });
  });

  describe("_setPlatformIOForTesting", () => {
    let originalIO: ReturnType<typeof getPlatformIO>;

    beforeEach(() => {
      originalIO = getPlatformIO();
      _resetPlatformIO();
    });

    it("should override the singleton with a mock", async () => {
      const mockData = new Uint8Array([1, 2, 3]);
      _setPlatformIOForTesting({
        readFile: async () => mockData,
        writeFile: async () => {},
        stat: async () => ({ size: 99 }),
        async *readDir() {},
      });

      const io = getPlatformIO();
      const result = await io.readFile("anything");
      expect(result).toBe(mockData);
      expect((await io.stat("anything")).size).toBe(99);
    });
  });
});
