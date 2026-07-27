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
import {
  applyTags,
  clearTags,
  readTags,
} from "../src/simple/tag-operations.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";
import type { AudioFile } from "../src/taglib/audio-file-interface.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
type Backend = (typeof BACKENDS)[number];

/**
 * Formats grouped by how the shim treats their track field. The distinction is
 * NOT "text versus binary on disk" — ID3v2 TRCK is a text frame — but whether
 * `split_intpair_properties` / `merge_intpair_properties` reinterpret an
 * "n/total" value, which is what decides the expected `properties()` shape.
 */

/** Zero-padding survives verbatim, and so does "n/total": no int-pair handling. */
const PLAIN_TRACK_FORMATS = ["flac", "ogg", "wav"] as const;

/**
 * The shim splits "n/total" into trackNumber + totalTracks on read and merges it
 * back on write. Zero-padding without a "/" is untouched, so these formats
 * appear in both the padded cases and the split cases below.
 */
const INT_PAIR_FORMATS = ["mp3", "m4a"] as const;

/** Every format whose track field is a string on disk, so padding can survive. */
const PADDABLE_TRACK_FORMATS = ["mp3", "flac", "ogg", "wav"] as const;

/**
 * MP4 `trkn` is a pair of binary integers, so even "03" is unrepresentable —
 * both backends must normalize it, and that is correct rather than a defect.
 */
const INT_PAIR_FORMAT = "m4a";

/**
 * Zero-padded values carrying no "/", so no format's int-pair handling
 * reinterprets them and every paddable format must round-trip them verbatim.
 */
const RAW_TRACK_VALUES = ["03", "003"] as const;

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
  for (const format of PLAIN_TRACK_FORMATS) {
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
    for (const format of PADDABLE_TRACK_FORMATS) {
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

  // Formerly a PINNED DIVERGENCE: the shim split "3/12" into
  // trackNumber + totalTracks for MPEG/MP4 while Emscripten reported the raw
  // string, so the same file read differently per backend — and once the raw
  // string became a public typed field, the same input produced different FILES.
  // The shim no longer transforms the PropertyMap at all, so the raw string is
  // canonical everywhere and the backends agree by construction (taglib-asg).
  for (const format of INT_PAIR_FORMATS) {
    it(`reports "3/12" raw and identically on both backends [${format}]`, async () => {
      for (const backend of BACKENDS) {
        const path = await tempCopy(format);
        try {
          await seedProperties(backend, path, { trackNumber: ["3/12"] });
          for (const reader of BACKENDS) {
            const file = await taglibs[reader].open(path);
            try {
              const props = file.properties() as Record<string, string[]>;
              assertEquals(
                props.trackNumber,
                ["3/12"],
                `${reader} did not report the raw pair`,
              );
              assertEquals(
                props.totalTracks,
                undefined,
                `${reader} still splits the pair into a separate total`,
              );
            } finally {
              file.dispose();
            }
          }
          // The total stays reachable on the TYPED surface, where narrowing is
          // additive and cannot destroy the raw value.
          const tags = await readTags(path);
          assertEquals(tags.trackNumber, "3/12");
          assertEquals(tags.track, 3);
          assertEquals(tags.totalTracks, 12);
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
  for (const format of PLAIN_TRACK_FORMATS) {
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

describe("setTrack() preserves an existing track total (taglib-eq3)", () => {
  // ID3v2::Tag::setTrack replaces the whole TRCK frame, so Emscripten wrote a
  // bare "7" over a "3/12" and destroyed the total, while WASI preserved it via
  // its separate totalTracks field. Asserted on the RAW TRCK frame bytes so the
  // check is identical on both backends despite their different PropertyMap
  // presentation of an int pair.
  for (const backend of BACKENDS) {
    it(`keeps the total when setting only the number [${backend}]`, async () => {
      const path = await tempCopy("mp3");
      try {
        await seedProperties("emscripten", path, { trackNumber: ["3/12"] });

        const file = await taglibs[backend].open(path);
        try {
          file.tag().setTrack(7);
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }

        const reopened = await taglibs[backend].open(path);
        try {
          const frames = reopened.getId3v2Frames("TRCK");
          assertEquals(frames.length, 1, "expected exactly one TRCK frame");
          // Text frame body: 1 encoding byte, then the value.
          const raw = new TextDecoder().decode(frames[0]!.data.slice(1))
            .replace(/\0+$/, "");
          assertEquals(raw, "7/12", `${backend} dropped the track total`);
          assertEquals(reopened.tag().track, 7);
        } finally {
          reopened.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }

  // setTrack(0) is a CLEAR, not a renumbering: it must not stage "0/12". Asserts
  // the in-handle state AND the saved file, because a first version of the fix
  // staged "0/12" while the save path happened to drop it — the file looked right
  // and properties() did not, so either half alone misses a direction.
  for (const backend of BACKENDS) {
    it(`setTrack(0) clears the field rather than zeroing the pair [${backend}]`, async () => {
      const path = await tempCopy("mp3");
      try {
        await seedProperties("emscripten", path, { trackNumber: ["3/12"] });
        const file = await taglibs[backend].open(path);
        try {
          file.tag().setTrack(0);
          assertEquals(
            file.properties().trackNumber,
            undefined,
            `${backend} staged a zeroed pair instead of clearing`,
          );
          assertEquals(file.tag().track, 0);
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }

        // And the on-disk half: the WASI merge can resurrect "0/<total>" on an
        // int-pair format, which the in-handle assertion above cannot see.
        const reopened = await taglibs[backend].open(path);
        try {
          assertEquals(
            (reopened.properties() as Record<string, string[]>).trackNumber,
            undefined,
            `${backend}: a cleared track came back from disk`,
          );
        } finally {
          reopened.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }
});

describe("the date/year mirror obeys the same rules as trackNumber/track", () => {
  // taglib-iyfr: the raw/mirror rule was hand-written at seven sites, and the
  // copies drifted — only the trackNumber/track copy had been fixed, so BOTH
  // taglib-qpl defects were still live for date/year on WASI. Generalizing the
  // rule fixed them; these pin the two pairs to one behaviour.
  const PAIRS: Array<
    [
      raw: string,
      numericOf: (f: AudioFile) => number | undefined,
    ]
  > = [
    ["date", (f) => f.tag().year],
    ["trackNumber", (f) => f.tag().track],
  ];

  for (const backend of BACKENDS) {
    for (const [raw, readNumeric] of PAIRS) {
      it(`drops the numeric mirror when ${raw} becomes unparseable [${backend}]`, async () => {
        const path = await tempCopy("flac");
        try {
          await seedProperties("emscripten", path, { [raw]: ["1975"] });
          const file = await taglibs[backend].open(path);
          try {
            file.setProperty(raw, "unknown");
            assertEquals(
              readNumeric(file),
              0,
              `${backend}: stale numeric mirror for ${raw}`,
            );
          } finally {
            file.dispose();
          }
        } finally {
          await Deno.remove(path).catch(() => {});
        }
      });

      it(`clears both halves when ${raw} is set to "" [${backend}]`, async () => {
        const path = await tempCopy("flac");
        try {
          await seedProperties("emscripten", path, { [raw]: ["1975"] });
          const file = await taglibs[backend].open(path);
          try {
            file.setProperty(raw, "");
            assertEquals(
              (file.properties() as Record<string, string[]>)[raw],
              undefined,
              `${backend}: ${raw} not cleared`,
            );
            assertEquals(
              readNumeric(file),
              0,
              `${backend}: mirror not cleared`,
            );
          } finally {
            file.dispose();
          }
        } finally {
          await Deno.remove(path).catch(() => {});
        }
      });
    }
  }
});

describe("an MPEG save keeps a TRCK/TDRC that narrows to 0 (taglib-9m0w)", () => {
  // DATA LOSS, both backends. MPEG::File::read() ends with ID3v1Tag(true)
  // (mpegfile.cpp:511-512), so ID3v1Tag() is never null and the v1 -> v2 half of
  // MPEG::File::save()'s Duplicate pass (mpegfile.cpp:221-222) runs on EVERY
  // save, even for a file carrying no ID3v1 tag at all. That pass is
  // Tag::duplicate(v1, v2, overwrite=false), whose guard is
  //
  //     if(target->track() == 0) target->setTrack(source->track());
  //
  // and ID3v2::Tag::track() narrows the frame text with String::toInt(). A vinyl
  // "A1" therefore reads 0 — indistinguishable from an ABSENT frame — so the
  // empty ID3v1 source makes this setTrack(0), which id3v2tag.cpp:309-315
  // defines as removeFrames("TRCK"). An ordinary open + save deleted the value
  // with no error and no signal on read. year/TDRC dies by the same chain via
  // setYear(0).
  //
  // The trigger is exactly "the frame is present but the typed getter reads 0",
  // so these cases are the boundary. Values narrowing to a positive int were
  // never affected and are pinned below so the fix cannot over-correct.
  const NARROWS_TO_ZERO: Array<
    [frameId: string, property: string, value: string]
  > = [
    // Vinyl side/track numbering, which rippers emit — the reported case.
    ["TRCK", "trackNumber", "A1"],
    ["TRCK", "trackNumber", "B2"],
    ["TRCK", "trackNumber", "Side A"],
    ["TRCK", "trackNumber", "0"],
    ["TDRC", "date", "unknown"],
    ["TDRC", "date", "n/a"],
  ];

  /** ID3v2 text-frame body: one encoding byte (UTF-8) then the value. */
  function textFrameBody(value: string): Uint8Array {
    const encoded = new TextEncoder().encode(value);
    const body = new Uint8Array(encoded.length + 1);
    body[0] = 0x03;
    body.set(encoded, 1);
    return body;
  }

  /**
   * Seed a frame that the defect destroys, WITHOUT going through the property
   * write path — a raw write to an ID3v1-mapped ID trips the taglib-b67
   * DoNotDuplicate hatch, so it is the one route that survives the defect. That
   * keeps the no-op-save assertions below independent of the write path, which
   * this defect breaks too and which is asserted separately.
   */
  async function seedRawFrame(
    path: string,
    frameId: string,
    value: string,
  ): Promise<void> {
    const file = await taglibs.emscripten.open(path);
    try {
      file.setId3v2Frames(frameId, [textFrameBody(value)]);
      file.save();
      await Deno.writeFile(path, file.getFileBuffer());
    } finally {
      file.dispose();
    }
  }

  for (const backend of BACKENDS) {
    for (const [frameId, property, value] of NARROWS_TO_ZERO) {
      it(
        `keeps ${frameId} ${
          JSON.stringify(value)
        } across a no-op open+save [${backend}]`,
        async () => {
          const path = await tempCopy("mp3");
          try {
            await seedRawFrame(path, frameId, value);
            assertEquals(
              await readProperty("emscripten", path, property),
              [value],
              "seed did not land — the rest of this test would be vacuous",
            );

            // The reported scenario: open and save, changing nothing at all.
            const file = await taglibs[backend].open(path);
            try {
              file.save();
              await Deno.writeFile(path, file.getFileBuffer());
            } finally {
              file.dispose();
            }

            for (const reader of BACKENDS) {
              assertEquals(
                await readProperty(reader, path, property),
                [value],
                `${backend} deleted ${frameId} on a save that changed nothing`,
              );
            }
          } finally {
            await Deno.remove(path).catch(() => {});
          }
        },
      );

      it(
        `can write ${frameId} ${
          JSON.stringify(value)
        } through setProperties [${backend}]`,
        async () => {
          // The same duplication pass runs after a property write, so the value
          // could not be written at all — not just not preserved.
          const path = await tempCopy("mp3");
          try {
            await seedProperties(backend, path, { [property]: [value] });
            assertEquals(
              await readProperty("emscripten", path, property),
              [value],
              `${backend} could not write ${frameId}=${value}`,
            );
          } finally {
            await Deno.remove(path).catch(() => {});
          }
        },
      );
    }
  }

  // TCON dies by the same chain, and the first fix missed it. ID3v2::Tag::genre()
  // maps a purely numeric field through ID3v1::genre(n) (id3v2tag.cpp:200-217),
  // which answers "" for an index outside the ID3v1 list -- so a TCON of "255"
  // reads back empty while the frame is plainly there. Tag::duplicate's
  // `if(target->genre().isEmpty()) target->setGenre(source->genre())` then calls
  // setGenre(""), which is defined as removeFrames("TCON").
  //
  // Asserted on the raw frame rather than properties().genre, because the two
  // backends disagree about how to present a numeric genre -- Emscripten reports
  // [""], WASI reports nothing -- and the loss under test is the frame itself.
  //
  // WASI still loses it, by a DIFFERENT and pre-existing route: an empty-valued
  // property is dropped at the msgpack boundary, so GENRE never reaches the
  // snapshot, and setProperties() removes every frame the incoming map does not
  // represent. That is taglib-yc1x, it predates this work, and its fix is
  // entangled with taglib-nft5's "absent vs deleted" problem. Pinned per-backend
  // rather than asserted uniformly so this guard cannot pass by doing nothing.
  const TCON_FRAMES_AFTER_SAVE: Record<Backend, number> = {
    emscripten: 1,
    wasi: 0,
  };

  for (const backend of BACKENDS) {
    it(`keeps a numeric TCON across a no-op open+save [${backend}]`, async () => {
      const path = await tempCopy("mp3");
      try {
        await seedRawFrame(path, "TCON", "255");
        const seeded = await taglibs[backend].open(path);
        try {
          assertEquals(
            seeded.getId3v2Frames("TCON").length,
            1,
            "seed did not land — the rest of this test would be vacuous",
          );
        } finally {
          seeded.dispose();
        }

        const file = await taglibs[backend].open(path);
        try {
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }

        const reopened = await taglibs.emscripten.open(path);
        try {
          assertEquals(
            reopened.getId3v2Frames("TCON").length,
            TCON_FRAMES_AFTER_SAVE[backend],
            `${backend} changed how a numeric TCON survives a no-op save`,
          );
        } finally {
          reopened.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }

  // Guards against over-correcting. The fix replaces the destructive Duplicate
  // pass with an equivalent one, so BOTH directions of the ID3v1 <-> ID3v2 sync
  // must still happen.
  for (const backend of BACKENDS) {
    it(`still writes the ID3v1 tag alongside a preserved TRCK [${backend}]`, async () => {
      const path = await tempCopy("mp3");
      try {
        await seedRawFrame(path, "TRCK", "A1");
        const file = await taglibs[backend].open(path);
        try {
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }

        // v2 -> v1: MPEG::File::save() creates and populates an ID3v1 tag on
        // every save, and skipping duplication outright would silently stop it.
        const bytes = await Deno.readFile(path);
        assertEquals(
          new TextDecoder().decode(
            bytes.slice(bytes.length - 128, bytes.length - 125),
          ),
          "TAG",
          `${backend} stopped writing the ID3v1 tag`,
        );
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });

    it(`still fills an absent TRCK from the ID3v1 tag [${backend}]`, async () => {
      // v1 -> v2: the half that carries the defect still has a legitimate job,
      // and protecting a hidden TDRC on the same file must not cost it. A frame
      // that is genuinely ABSENT still has to be filled in from ID3v1.
      //
      // Both backends now agree here. They did not before taglib-nft5: WASI's
      // declarative save writes the JS snapshot through
      // MPEG::File::setProperties(), which rewrites the ID3v1 tag too
      // (mpegfile.cpp:191-192), and the generic Tag::setProperties() zeroes every
      // field the map omits. The map only ever describes ID3v2, so ID3v1's track
      // was ERASED — and the fill-in then had nothing left to copy. Preserving
      // the ID3v1-only value across that write restores both halves at once.
      const path = await tempCopy("mp3");
      try {
        // Clear every frame, then seed only the hidden TDRC — no TRCK.
        await seedProperties("emscripten", path, { title: ["Kiss"] });
        await seedRawFrame(path, "TDRC", "unknown");
        assertEquals(
          await readProperty("emscripten", path, "trackNumber"),
          undefined,
          "fixture still carries a TRCK, so the fill-in cannot be observed",
        );

        // Patch the ID3v1.1 track byte in place (offset 125 is 0, 126 is track).
        const seeded = await Deno.readFile(path);
        assertEquals(
          new TextDecoder().decode(
            seeded.slice(seeded.length - 128, seeded.length - 125),
          ),
          "TAG",
          "expected an ID3v1 tag to patch",
        );
        seeded[seeded.length - 3] = 0x00;
        seeded[seeded.length - 2] = 5;
        await Deno.writeFile(path, seeded);

        const file = await taglibs[backend].open(path);
        try {
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }

        assertEquals(
          await readProperty("emscripten", path, "trackNumber"),
          ["5"],
          `${backend} dropped the ID3v1 -> ID3v2 track fill-in`,
        );

        // And the ID3v1 tag still holds its own copy: the write must PRESERVE
        // the value, not move it. Reading it back by hand because properties()
        // never surfaces ID3v1 (TagUnion returns ID3v2's map wholesale).
        const saved = await Deno.readFile(path);
        assertEquals(
          saved[saved.length - 2],
          5,
          `${backend} erased the ID3v1 track byte`,
        );
        assertEquals(
          await readProperty("emscripten", path, "date"),
          ["unknown"],
          `${backend} destroyed the hidden TDRC`,
        );
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });

    it(`still narrows a normal date and track [${backend}]`, async () => {
      const path = await tempCopy("mp3");
      try {
        await seedProperties(backend, path, {
          date: ["1986-03-25"],
          trackNumber: ["3/12"],
        });
        const file = await taglibs[backend].open(path);
        try {
          assertEquals(file.properties().date, ["1986-03-25"]);
          assertEquals(file.properties().trackNumber, ["3/12"]);
          assertEquals(file.tag().year, 1986);
          assertEquals(file.tag().track, 3);
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }
});

describe("ID3v1-only values are visible, writable and clearable (taglib-nft5)", () => {
  // properties() used to report ID3v2's map alone (TagUnion::properties(),
  // tagunion.cpp:108-114), so a value living only in ID3v1 was INVISIBLE. Every
  // problem in this area came from that: the declarative save could not carry
  // what it could not see, so it erased it; preserving it in C++ instead then
  // made a deliberate clear inexpressible, because clearTags() builds its map
  // from properties() and so could never name the field it needed to remove.
  //
  // Surfacing the value on READ settles both: a round-trip carries it, and a
  // clear can finally address it.

  /** An MP3 whose ID3v2 lacks `frameId` while ID3v1 carries `value`. */
  async function id3v1Only(
    field: "title" | "track",
    value: string,
  ): Promise<string> {
    const path = await tempCopy("mp3");
    // A non-empty ID3v2 that deliberately omits the field under test, and a
    // save so TagLib writes the ID3v1 tag this then patches.
    await seedProperties("emscripten", path, { artist: ["KeepArtist"] });
    const bytes = await Deno.readFile(path);
    const tag = bytes.length - 128;
    assertEquals(
      new TextDecoder().decode(bytes.slice(tag, tag + 3)),
      "TAG",
      "expected an ID3v1 tag to patch",
    );
    if (field === "title") {
      bytes.set(new Uint8Array(30), tag + 3);
      bytes.set(new TextEncoder().encode(value), tag + 3);
    } else {
      bytes[bytes.length - 3] = 0x00; // ID3v1.1 marker
      bytes[bytes.length - 2] = Number(value);
    }
    await Deno.writeFile(path, bytes);
    return path;
  }

  for (const backend of BACKENDS) {
    it(`reports an ID3v1-only value from properties() [${backend}]`, async () => {
      const path = await id3v1Only("title", "GhostTitle");
      try {
        assertEquals(
          await readProperty(backend, path, "title"),
          ["GhostTitle"],
          `${backend} cannot see a value held only in ID3v1`,
        );
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });

    it(`clearTags() removes an ID3v1-only value [${backend}]`, async () => {
      // The regression this redesign exists to kill: the value came back as a
      // ghost in ID3v2 after a clear, because the clear could not name it.
      const path = await id3v1Only("title", "GhostTitle");
      try {
        await Deno.writeFile(path, await clearTags(path));
        assertEquals(
          await readProperty(backend, path, "title"),
          undefined,
          `${backend}: a cleared ID3v1 value came back`,
        );
        const file = await taglibs[backend].open(path);
        try {
          assertEquals(file.tag().title, "", `${backend}: stale typed title`);
        } finally {
          file.dispose();
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });

    it(`carries an ID3v1-only track through an unrelated edit [${backend}]`, async () => {
      // And the original defect: an ordinary save must not lose it.
      const path = await id3v1Only("track", "5");
      try {
        const file = await taglibs[backend].open(path);
        try {
          file.setProperty("title", "Unrelated edit");
          file.save();
          await Deno.writeFile(path, file.getFileBuffer());
        } finally {
          file.dispose();
        }
        assertEquals(
          await readProperty(backend, path, "trackNumber"),
          ["5"],
          `${backend} lost an ID3v1-only track across an unrelated edit`,
        );
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }
});

describe("track and disc totals land in the standard on-disk field", () => {
  // Every totals test in the suite used FLAC, which stores TRACKTOTAL as its own
  // Vorbis field — so nothing covered the formats where the total belongs INSIDE
  // the number field (ID3v2 TRCK/TPOS, MP4 trkn/disk). A caller supplying
  // separate track + totalTracks must still end up with the combined form there,
  // or ordinary players show no total.
  for (const format of ["mp3", "m4a"] as const) {
    it(`stores a separate track/disc total in the combined field [${format}]`, async () => {
      const path = await tempCopy(format);
      try {
        await Deno.writeFile(
          path,
          await applyTags(path, {
            track: 3,
            totalTracks: 12,
            discNumber: 1,
            totalDiscs: 2,
          }),
        );

        for (const reader of BACKENDS) {
          const file = await taglibs[reader].open(path);
          try {
            const props = file.properties() as Record<string, string[]>;
            assertEquals(
              props.trackNumber,
              ["3/12"],
              `${reader}: the track total is not in the combined field`,
            );
            assertEquals(
              props.discNumber,
              ["1/2"],
              `${reader}: the disc total is not in the combined field`,
            );
            // And not ALSO stashed in a separate tag.
            assertEquals(props.totalTracks, undefined);
            assertEquals(props.totalDiscs, undefined);
          } finally {
            file.dispose();
          }
        }
      } finally {
        await Deno.remove(path).catch(() => {});
      }
    });
  }

  it("applyTags({track}) preserves an existing total, like tag().setTrack() [mp3]", async () => {
    // The two write surfaces expressed the same intent and produced different
    // files: setTrack(5) kept "5/12" while applyTags({track:5}) wrote "5".
    const path = await tempCopy("mp3");
    try {
      await seedProperties("emscripten", path, { trackNumber: ["3/12"] });
      await Deno.writeFile(path, await applyTags(path, { track: 5 }));
      assertEquals(
        await readProperty("emscripten", path, "trackNumber"),
        ["5/12"],
        "applyTags dropped the total that setTrack preserves",
      );
    } finally {
      await Deno.remove(path).catch(() => {});
    }
  });

  it("a new raw pair does not leave a contradicting stale total [flac]", async () => {
    // mergeTagUpdates spreads the file's current properties first, so a total
    // that the incoming pair supersedes could survive and disagree with it.
    const path = await tempCopy("flac");
    try {
      await seedProperties("wasi", path, {
        trackNumber: ["1"],
        totalTracks: ["5"],
      });
      await Deno.writeFile(
        path,
        await applyTags(path, { trackNumber: "3/12", totalTracks: 12 }),
      );
      const props = await readProperty("wasi", path, "trackNumber");
      assertEquals(props, ["3/12"]);
      assertEquals(
        await readProperty("wasi", path, "totalTracks"),
        undefined,
        "a stale total survived alongside the new pair",
      );
      const tags = await readTags(path);
      assertEquals(tags.totalTracks, 12, "readTags reported the stale total");
    } finally {
      await Deno.remove(path).catch(() => {});
    }
  });
});
