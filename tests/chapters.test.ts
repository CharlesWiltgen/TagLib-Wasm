/// <reference lib="deno.ns" />

/**
 * @fileoverview Chapter read/write tests across both Wasm backends.
 *
 * Fixtures (see tests/test-files/_gen/make-chapter-fixtures.sh):
 * - mp3/chapters-id3.mp3   — 2 ID3v2 CHAP frames ("Intro" 0–2 s, "Chapter 1" 2–4 s)
 * - mp4/chapters-qt.m4a    — QuickTime chapter track only (Nero chpl disabled)
 * - mp4/chapters-both.m4a  — QuickTime track + Nero chpl atom (same 2 chapters)
 */

import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import fc from "fast-check";
import { TagLib } from "../src/taglib.ts";
import { UnsupportedFormatError } from "../src/errors.ts";
import type { Chapter, SetChaptersOptions } from "../index.ts";

// Compile-time: the public Chapter/SetChaptersOptions shapes.
const _chapter: Chapter = { startTimeMs: 0 };
const _opts: SetChaptersOptions = { mp4ChapterStyle: "both" };
void _chapter;
void _opts;

const FILES = {
  id3: join("tests", "test-files", "mp3", "chapters-id3.mp3"),
  qt: join("tests", "test-files", "mp4", "chapters-qt.m4a"),
  both: join("tests", "test-files", "mp4", "chapters-both.m4a"),
  plainMp3: join("tests", "test-files", "mp3", "kiss-snippet.mp3"),
  plainM4a: join("tests", "test-files", "mp4", "kiss-snippet.m4a"),
  flac: join("tests", "test-files", "flac", "kiss-snippet.flac"),
} as const;

const BACKENDS = ["wasi", "emscripten"] as const;

async function open(backend: typeof BACKENDS[number], path: string) {
  const taglib = await TagLib.initialize({ forceWasmType: backend });
  return taglib.open(await Deno.readFile(path));
}

/** Round-trip: setChapters → save → reopen the resulting buffer → getChapters. */
async function writeReadBack(
  backend: typeof BACKENDS[number],
  path: string,
  chapters: Chapter[],
  options?: SetChaptersOptions,
): Promise<Chapter[]> {
  const taglib = await TagLib.initialize({ forceWasmType: backend });
  const file = await taglib.open(await Deno.readFile(path));
  let out: Uint8Array;
  try {
    file.setChapters(chapters, options);
    file.save();
    out = file.getFileBuffer();
  } finally {
    file.dispose();
  }
  const reopened = await taglib.open(out);
  try {
    return reopened.getChapters();
  } finally {
    reopened.dispose();
  }
}

for (const backend of BACKENDS) {
  Deno.test(`[${backend}] reads ID3v2 CHAP frames with explicit end times`, async () => {
    const file = await open(backend, FILES.id3);
    try {
      const ch = file.getChapters();
      assertEquals(ch.length, 2);
      assertEquals(ch.map((c) => c.source), ["id3", "id3"]);
      assertEquals(ch.map((c) => c.title), ["Intro", "Chapter 1"]);
      assertEquals(ch[0].endTimeMs, 2000);
      assertEquals(ch[1].endTimeMs, 4000);
      assertEquals(typeof ch[0].id, "string");
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] reads MP4 QuickTime chapters; id undefined, end inferred`, async () => {
    const file = await open(backend, FILES.qt);
    try {
      const ch = file.getChapters();
      assertEquals(ch.length, 2);
      assertEquals(ch.map((c) => c.source), ["quicktime", "quicktime"]);
      assertEquals(ch[0].id, undefined);
      assertEquals(ch[0].endTimeMs, ch[1].startTimeMs); // interior: next start
      assertEquals(ch[1].endTimeMs, file.audioProperties()?.durationMs); // last: track end
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] MP4 with both QuickTime and Nero chapters — QuickTime wins`, async () => {
    const file = await open(backend, FILES.both);
    try {
      assertEquals(
        file.getChapters().every((c) => c.source === "quicktime"),
        true,
      );
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] files without chapters return []`, async () => {
    const file = await open(backend, FILES.plainMp3);
    try {
      assertEquals(file.getChapters(), []);
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] MP3 round-trip; omitted endTimeMs is filled`, async () => {
    const file = await open(backend, FILES.plainMp3);
    const trackEndMs = file.audioProperties()?.durationMs ?? 0;
    file.dispose();
    const ch = await writeReadBack(backend, FILES.plainMp3, [
      { startTimeMs: 0, title: "A", id: "intro" },
      { startTimeMs: 1000, title: "B" },
    ]);
    assertEquals(ch.map((c) => [c.startTimeMs, c.title, c.source]), [
      [0, "A", "id3"],
      [1000, "B", "id3"],
    ]);
    assertEquals(ch[0].id, "intro");
    assertEquals(ch[0].endTimeMs, 1000); // filled from next chapter's start
    assertEquals(ch[1].endTimeMs, trackEndMs); // filled from track length
  });

  Deno.test(`[${backend}] MP4 setChapters default style is quicktime`, async () => {
    const ch = await writeReadBack(backend, FILES.plainM4a, [
      { startTimeMs: 0, title: "X" },
      { startTimeMs: 1000, title: "Y" },
    ]);
    assertEquals(ch.map((c) => [c.startTimeMs, c.title, c.source]), [
      [0, "X", "quicktime"],
      [1000, "Y", "quicktime"],
    ]);
  });

  Deno.test(`[${backend}] MP4 setChapters nero style; QuickTime track removed`, async () => {
    const ch = await writeReadBack(
      backend,
      FILES.plainM4a,
      [{ startTimeMs: 0, title: "N0" }, { startTimeMs: 2000, title: "N1" }],
      { mp4ChapterStyle: "nero" },
    );
    assertEquals(ch.map((c) => [c.startTimeMs, c.title]), [[0, "N0"], [
      2000,
      "N1",
    ]]);
    assertEquals(ch.every((c) => c.source === "nero"), true);
  });

  Deno.test(`[${backend}] MP4 "both" with >255 chapters: QuickTime keeps all`, async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      startTimeMs: i * 10,
      title: `c${i}`,
    }));
    const ch = await writeReadBack(backend, FILES.plainM4a, many, {
      mp4ChapterStyle: "both",
    });
    assertEquals(ch.length, 300); // getChapters prefers the QuickTime track
    assertEquals(ch.every((c) => c.source === "quicktime"), true);
  });

  Deno.test(`[${backend}] setChapters([]) clears all chapters`, async () => {
    assertEquals(await writeReadBack(backend, FILES.both, []), []);
  });

  Deno.test(`[${backend}] setChapters on an unsupported format throws`, async () => {
    const file = await open(backend, FILES.flac);
    try {
      assertThrows(
        () => file.setChapters([{ startTimeMs: 0, title: "x" }]),
        UnsupportedFormatError,
      );
    } finally {
      file.dispose();
    }
  });

  Deno.test(`[${backend}] property: MP3 chapter list round-trips`, async () => {
    const taglib = await TagLib.initialize({ forceWasmType: backend });
    const sourceBuffer = await Deno.readFile(FILES.plainMp3);
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            startTimeMs: fc.integer({ min: 0, max: 3_600_000 }),
            title: fc.string({ maxLength: 32 }).filter((s) =>
              !s.includes("\0")
            ),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        async (raw) => {
          // De-dup by start time and sort so the expected list is well-defined.
          const expected = [
            ...new Map(raw.map((r) => [r.startTimeMs, r])).values(),
          ]
            .sort((a, b) => a.startTimeMs - b.startTimeMs);
          const file = await taglib.open(sourceBuffer);
          let out: Uint8Array;
          try {
            file.setChapters(expected.map((e) => ({ ...e })));
            file.save();
            out = file.getFileBuffer();
          } finally {
            file.dispose();
          }
          const reopened = await taglib.open(out);
          try {
            const back = reopened.getChapters().map((c) => ({
              startTimeMs: c.startTimeMs,
              title: c.title ?? "",
            }));
            return JSON.stringify(back) ===
              JSON.stringify(expected.map((e) => ({
                startTimeMs: e.startTimeMs,
                title: e.title,
              })));
          } finally {
            reopened.dispose();
          }
        },
      ),
      { numRuns: 60 }, // round-trip integrity; re-opens the Wasm file each run
    );
  });
}
