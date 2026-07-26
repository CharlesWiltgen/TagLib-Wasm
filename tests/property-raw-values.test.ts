/**
 * Cross-backend parity for RAW property strings (taglib-qpl).
 *
 * The WASI backend used to coerce the five `FIELD_NUMERIC` property keys
 * through `toInt()` at the msgpack wire boundary, so `properties()` answered
 * "3" for an on-disk `TRACKNUMBER` of "03" — and, worse, "3" for "3/12",
 * destroying the total on any read-modify-write. Emscripten passes the
 * `StringList` through verbatim and was always correct, so these tests pin
 * WASI to Emscripten's answer.
 *
 * The `PropertyMap` surface is the RAW text surface; the numeric narrowing
 * belongs to the typed surfaces (`tag().track`, `readTags()`), which are
 * asserted here too so the fix can't over-correct and break them.
 */

import { assertEquals } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import { applyTags, readTags } from "../src/simple/tag-operations.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
type Backend = (typeof BACKENDS)[number];

/**
 * Formats whose native track field is a free-form TEXT field, so a
 * zero-padded or "n/total" value is representable on disk:
 * ID3v2 TRCK, Vorbis TRACKNUMBER, RIFF INFO ITRK.
 */
const TEXT_TRACK_FORMATS = ["mp3", "flac", "ogg", "wav"] as const;

/**
 * MP4 `trkn` is a pair of binary integers, so "03" is genuinely
 * unrepresentable — both backends must normalize, and that is correct.
 */
const INT_PAIR_FORMAT = "m4a";

/**
 * Zero-padded values, legal in a TRCK / TRACKNUMBER / ITRK field and carrying
 * no "/" — so no format's int-pair handling reinterprets them.
 */
const RAW_TRACK_VALUES = ["03", "003"] as const;

/**
 * Formats whose track field is a binary int pair on disk (MP4 `trkn`) or is
 * conventionally written as "n/total" (ID3v2 TRCK). The C shim deliberately
 * splits "3/12" into trackNumber + totalTracks on read and merges it back on
 * write (`split_intpair_properties` / `merge_intpair_properties`), so these
 * formats present the pair as two fields rather than one raw string.
 */
const INT_PAIR_FORMATS = ["mp3", "m4a"] as const;

const taglibs = {} as Record<Backend, TagLib>;

beforeAll(async () => {
  for (const backend of BACKENDS) {
    taglibs[backend] = await TagLib.initialize({ forceWasmType: backend });
  }
});

/** Copy a fixture to a temp path so each case mutates an isolated file. */
async function tempCopy(format: string): Promise<string> {
  const src = await Deno.readFile(
    FIXTURE_PATH[format as keyof typeof FIXTURE_PATH],
  );
  const tmp = await Deno.makeTempFile({ suffix: `.${format}` });
  await Deno.writeFile(tmp, src);
  return tmp;
}

/** Write `props` through `backend` and persist the result to `path`. */
async function seedProperties(
  backend: Backend,
  path: string,
  props: Record<string, string[]>,
): Promise<void> {
  const file = await taglibs[backend].open(path);
  try {
    file.setProperties(props);
    file.save();
    const buf = file.getFileBuffer();
    await Deno.writeFile(path, buf);
  } finally {
    file.dispose();
  }
}

async function readProperty(
  backend: Backend,
  path: string,
  key: string,
): Promise<string[] | undefined> {
  const file = await taglibs[backend].open(path);
  try {
    return (file.properties() as Record<string, string[]>)[key];
  } finally {
    file.dispose();
  }
}

describe("properties() raw-string fidelity (taglib-qpl)", () => {
  // "3/12" has no int-pair reinterpretation on these formats, so the raw
  // string must survive verbatim — this is the data-loss case from taglib-qpl.
  for (const format of ["flac", "ogg", "wav"] as const) {
    it(`round-trips trackNumber "3/12" verbatim on both backends [${format}]`, async () => {
      for (const backend of BACKENDS) {
        const path = await tempCopy(format);
        try {
          await seedProperties(backend, path, { trackNumber: ["3/12"] });
          for (const reader of BACKENDS) {
            assertEquals(
              await readProperty(reader, path, "trackNumber"),
              ["3/12"],
              `${reader} disagrees about a file written by ${backend}`,
            );
          }
        } finally {
          await Deno.remove(path).catch(() => {});
        }
      }
    });
  }

  for (const value of RAW_TRACK_VALUES) {
    for (const format of TEXT_TRACK_FORMATS) {
      it(
        `round-trips trackNumber ${
          JSON.stringify(value)
        } identically on both backends [${format}]`,
        async () => {
          // Seed once per backend so the WRITE path is exercised on each, then
          // assert both backends read back the value they were given.
          for (const backend of BACKENDS) {
            const path = await tempCopy(format);
            try {
              await seedProperties(backend, path, { trackNumber: [value] });
              const readByWriter = await readProperty(
                backend,
                path,
                "trackNumber",
              );
              assertEquals(
                readByWriter,
                [value],
                `${backend} lost the raw string it wrote`,
              );

              // And the OTHER backend must agree about the same bytes.
              for (const reader of BACKENDS) {
                assertEquals(
                  await readProperty(reader, path, "trackNumber"),
                  [value],
                  `${reader} disagrees about a file written by ${backend}`,
                );
              }
            } finally {
              await Deno.remove(path).catch(() => {});
            }
          }
        },
      );
    }
  }

  // The int-pair split is a PRESENTATION difference between the backends, not
  // data loss: WASI reports the pair as trackNumber + totalTracks, Emscripten
  // reports the raw "3/12", and both write identical bytes back. Pinned here so
  // the divergence is a documented contract rather than a silent surprise, and
  // so a future change to either half has to update this test deliberately.
  for (const format of INT_PAIR_FORMATS) {
    it(`splits "3/12" on WASI and keeps it raw on Emscripten, losslessly [${format}]`, async () => {
      for (const backend of BACKENDS) {
        const path = await tempCopy(format);
        try {
          await seedProperties(backend, path, { trackNumber: ["3/12"] });

          const wasiFile = await taglibs.wasi.open(path);
          try {
            const props = wasiFile.properties() as Record<string, string[]>;
            assertEquals(props.trackNumber, ["3"]);
            assertEquals(props.totalTracks, ["12"], "total must survive");
          } finally {
            wasiFile.dispose();
          }

          assertEquals(
            await readProperty("emscripten", path, "trackNumber"),
            ["3/12"],
            "Emscripten reports the unsplit on-disk string",
          );
        } finally {
          await Deno.remove(path).catch(() => {});
        }
      }
    });
  }

  it(`normalizes to a bare integer on both backends [${INT_PAIR_FORMAT}]`, async () => {
    // Documented format constraint, not a defect: MP4 trkn is a binary int
    // pair, so "03" cannot survive. Both backends must agree it becomes "3".
    for (const backend of BACKENDS) {
      const path = await tempCopy(INT_PAIR_FORMAT);
      try {
        await seedProperties(backend, path, { trackNumber: ["03"] });
        assertEquals(await readProperty(backend, path, "trackNumber"), ["3"]);
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    }
  });

  // The other four FIELD_NUMERIC keys are the same defect class. BPM is the
  // one that loses PRECISION rather than padding, so it is the sharpest case.
  const OTHER_NUMERIC_CASES: Array<[string, string]> = [
    ["bpm", "120.5"],
    ["discNumber", "01"],
    ["totalDiscs", "02"],
    ["totalTracks", "012"],
  ];

  for (const [key, value] of OTHER_NUMERIC_CASES) {
    it(
      `round-trips ${key} ${
        JSON.stringify(value)
      } identically on both backends [flac]`,
      async () => {
        for (const backend of BACKENDS) {
          const path = await tempCopy("flac");
          try {
            await seedProperties(backend, path, { [key]: [value] });
            assertEquals(await readProperty(backend, path, key), [value]);
          } finally {
            await Deno.remove(path).catch(() => {});
          }
        }
      },
    );
  }
});

describe("read-modify-write preserves an untouched raw track total", () => {
  // The data-loss case: TRACKNUMBER="3/12" on a format with no int-pair split.
  // Editing ONLY the title must not rewrite the track field at all.
  for (const format of ["flac", "ogg", "wav"] as const) {
    it(`keeps "3/12" across a title-only applyTags [${format}]`, async () => {
      const path = await tempCopy(format);
      try {
        await seedProperties("emscripten", path, { trackNumber: ["3/12"] });

        const out = await applyTags(path, { title: "Unrelated edit" });
        await Deno.writeFile(path, out);

        for (const reader of BACKENDS) {
          assertEquals(
            await readProperty(reader, path, "trackNumber"),
            ["3/12"],
            `${reader} sees a truncated total after a title-only edit`,
          );
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }
});

describe("readTags() preserves the raw track string", () => {
  // Fixing only the wire boundary left this path lossy: readTags() kept just
  // the numeric `track`, so applyTags(readTags()) — the copy-tags-between-
  // formats flow in AGENTS.md — wrote back a bare "3" and destroyed the total.
  it("survives a readTags() -> applyTags() round-trip [flac]", async () => {
    const path = await tempCopy("flac");
    try {
      await seedProperties("emscripten", path, { trackNumber: ["3/12"] });

      const tags = await readTags(path);
      assertEquals(tags.trackNumber, "3/12", "raw string must be exposed");
      assertEquals(tags.track, 3, "numeric mirror still narrows");

      await Deno.writeFile(path, await applyTags(path, tags));

      for (const reader of BACKENDS) {
        assertEquals(
          await readProperty(reader, path, "trackNumber"),
          ["3/12"],
          `${reader} sees a truncated total after a readTags round-trip`,
        );
      }
    } finally {
      await Deno.remove(path).catch(() => {});
    }
  });

  it("prefers an explicit raw trackNumber over a numeric track [flac]", async () => {
    const path = await tempCopy("flac");
    try {
      await Deno.writeFile(
        path,
        await applyTags(path, { track: 9, trackNumber: "3/12" }),
      );
      assertEquals(await readProperty("emscripten", path, "trackNumber"), [
        "3/12",
      ]);
    } finally {
      await Deno.remove(path).catch(() => {});
    }
  });
});

describe("the numeric track mirror never outlives its raw string", () => {
  // Both cases used to leave a stale `track` behind on WASI only.
  it("clearing via setProperty removes the value on both backends [flac]", async () => {
    for (const backend of BACKENDS) {
      const path = await tempCopy("flac");
      try {
        await seedProperties("emscripten", path, { trackNumber: ["9"] });
        const file = await taglibs[backend].open(path);
        try {
          file.setProperty("trackNumber", "");
          assertEquals(
            file.properties().trackNumber,
            undefined,
            `${backend} still reports a cleared track in-handle`,
          );
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }
        assertEquals(
          await readProperty("emscripten", path, "trackNumber"),
          undefined,
          `${backend} wrote the stale number back to disk`,
        );
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    }
  });

  it("an unparseable setProperty value drops the mirror on both backends [flac]", async () => {
    for (const backend of BACKENDS) {
      const path = await tempCopy("flac");
      try {
        await seedProperties("emscripten", path, { trackNumber: ["5"] });
        const file = await taglibs[backend].open(path);
        try {
          file.setProperty("trackNumber", "unknown");
          assertEquals(
            file.tag().track,
            0,
            `${backend} reports a stale numeric track`,
          );
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    }
  });
});

describe("typed surfaces still narrow to numbers", () => {
  // Guard against over-correcting: the RAW string belongs to properties(),
  // but tag().track and readTags() promise numbers and must keep delivering
  // them — including from a value the PropertyMap reports as "3/12".
  for (const backend of BACKENDS) {
    it(`tag().track is the leading integer of "3/12" [${backend}]`, async () => {
      const path = await tempCopy("flac");
      try {
        await seedProperties(backend, path, { trackNumber: ["3/12"] });
        const file = await taglibs[backend].open(path);
        try {
          assertEquals(file.properties().trackNumber, ["3/12"]);
          assertEquals(file.tag().track, 3);
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }

  it("readTags() reports track and bpm as numbers", async () => {
    const path = await tempCopy("flac");
    try {
      await seedProperties("emscripten", path, {
        trackNumber: ["03"],
        bpm: ["120.5"],
      });
      const tags = await readTags(path);
      assertEquals(tags.track, 3);
      assertEquals(tags.bpm, 120);
    } finally {
      await Deno.remove(path).catch(() => {});
    }
  });

  it("setTrack() is visible on the raw properties() surface", async () => {
    // The numeric mirror and the raw string must not drift apart in-handle.
    for (const backend of BACKENDS) {
      const path = await tempCopy("flac");
      try {
        const file = await taglibs[backend].open(path);
        try {
          file.tag().setTrack(7);
          assertEquals(file.properties().trackNumber, ["7"]);
          assertEquals(file.tag().track, 7);
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    }
  });
});
