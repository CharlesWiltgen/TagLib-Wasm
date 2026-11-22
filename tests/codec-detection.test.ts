import { describe, expect, it } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TagLib } from "../src/taglib.ts";

describe("Codec Detection", () => {
  it("MP3 - both container and codec", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const mp3Path = join("tests", "test-files", "mp3", "kiss-snippet.mp3");
    const mp3Buffer = new Uint8Array(await readFile(mp3Path));
    const file = await taglib.open(mp3Buffer);

    try {
      const props = file.audioProperties();
      expect(props?.containerFormat).toStrictEqual("MP3");
      expect(props?.codec).toStrictEqual("MP3");
      expect(props?.isLossless).toStrictEqual(false);
      expect(props?.bitsPerSample).toStrictEqual(0);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("FLAC - both container and codec", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const flacPath = join("tests", "test-files", "flac", "kiss-snippet.flac");
    const flacBuffer = new Uint8Array(await readFile(flacPath));
    const file = await taglib.open(flacBuffer);

    try {
      const props = file.audioProperties();
      expect(props?.containerFormat).toStrictEqual("FLAC");
      expect(props?.codec).toStrictEqual("FLAC");
      expect(props?.isLossless).toStrictEqual(true);
      expect(props?.bitsPerSample).toStrictEqual(16);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("WAV container - uncompressed PCM codec", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const wavPath = join("tests", "test-files", "wav", "kiss-snippet.wav");
    const wavBuffer = new Uint8Array(await readFile(wavPath));
    const file = await taglib.open(wavBuffer);

    try {
      const props = file.audioProperties();
      expect(props?.containerFormat).toStrictEqual("WAV");
      expect(props?.codec).toStrictEqual("PCM");
      expect(props?.isLossless).toStrictEqual(true);
      expect(props?.bitsPerSample).toStrictEqual(16);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("OGG container - Vorbis codec", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const oggPath = join("tests", "test-files", "ogg", "kiss-snippet.ogg");
    const oggBuffer = new Uint8Array(await readFile(oggPath));
    const file = await taglib.open(oggBuffer);

    try {
      const props = file.audioProperties();
      expect(props?.containerFormat).toStrictEqual("OGG");
      expect(props?.codec).toStrictEqual("Vorbis");
      expect(props?.isLossless).toStrictEqual(false);
      expect(props?.bitsPerSample).toStrictEqual(0);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("MP4 container (M4A file) - AAC codec", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const m4aPath = join("tests", "test-files", "mp4", "kiss-snippet.m4a");
    const m4aBuffer = new Uint8Array(await readFile(m4aPath));
    const file = await taglib.open(m4aBuffer);

    try {
      const props = file.audioProperties();
      expect(props?.containerFormat).toStrictEqual("MP4");
      expect(props?.codec).toStrictEqual("AAC");
      expect(props?.isLossless).toStrictEqual(false);
      console.log(`M4A bits per sample: ${props?.bitsPerSample}`);
    } finally {
      file.save();
      file.dispose();
    }
  });

  for (const backend of ["wasi", "emscripten"] as const) {
    it(`AIFF-C A-law reports G.711 and lossy [${backend}]`, async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const path = join("lib", "taglib", "tests", "data", "alaw.aifc");
      const file = await taglib.open(new Uint8Array(await readFile(path)));

      try {
        const props = file.audioProperties();
        expect(props?.containerFormat).toStrictEqual("AIFF");
        expect(props?.codec).toStrictEqual("G.711");
        expect(props?.isLossless).toStrictEqual(false);
      } finally {
        file.dispose();
      }
    });

    it(`plain AIFF stays PCM and lossless [${backend}]`, async () => {
      const taglib = await TagLib.initialize({ forceWasmType: backend });
      const path = join("lib", "taglib", "tests", "data", "noise.aif");
      const file = await taglib.open(new Uint8Array(await readFile(path)));

      try {
        const props = file.audioProperties();
        expect(props?.containerFormat).toStrictEqual("AIFF");
        expect(props?.codec).toStrictEqual("PCM");
        expect(props?.isLossless).toStrictEqual(true);
      } finally {
        file.dispose();
      }
    });
  }
});
