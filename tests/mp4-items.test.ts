/// <reference lib="deno.ns" />

/**
 * Cross-backend parity for MP4 freeform items (taglib-1qn).
 *
 * Emscripten implements getMP4Item/setMP4Item/removeMP4Item via TagLib's
 * dedicated C++ MP4 Item API (full `----:mean:name` atom keys). WASI has only
 * the PropertyMap snapshot, where TagLib keys freeform atoms by their bare,
 * uppercased NAME — so the full iTunes atom key must be normalized for the
 * round-trip to survive a save. These tests pin that both backends agree.
 */

import { assertEquals } from "@std/assert";
import { TagLib } from "../src/taglib.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
// A standard uppercase freeform key (round-trips losslessly on both backends)
// plus the real-world Apple Sound Check atom that the dynamics reader falls back
// to via getMP4Item.
const CUSTOM = "----:com.apple.iTunes:CUSTOM_PARITY";
const ITUNNORM = "----:com.apple.iTunes:iTunNORM";

for (const backend of BACKENDS) {
  Deno.test(`[${backend}] MP4 freeform item round-trips through save (taglib-1qn)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    file.setMP4Item(CUSTOM, "parity-value");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const reopened = await tl.open(buf);
    const value = reopened.getMP4Item(CUSTOM);
    reopened.dispose();
    assertEquals(
      value,
      "parity-value",
      `${backend}: freeform MP4 item lost on save round-trip`,
    );
  });

  Deno.test(`[${backend}] MP4 Sound Check (iTunNORM) item round-trips through save (taglib-1qn)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    file.setMP4Item(ITUNNORM, " 00000200 00000200");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const reopened = await tl.open(buf);
    const value = reopened.getMP4Item(ITUNNORM);
    reopened.dispose();
    assertEquals(
      value,
      " 00000200 00000200",
      `${backend}: iTunNORM item lost on save round-trip`,
    );
  });

  Deno.test(`[${backend}] removeMP4Item clears a freeform item through save (taglib-1qn)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const seeded = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    seeded.setMP4Item(CUSTOM, "to-remove");
    seeded.save();
    const withItem = seeded.getFileBuffer();
    seeded.dispose();

    const file = await tl.open(withItem);
    file.removeMP4Item(CUSTOM);
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const reopened = await tl.open(buf);
    const value = reopened.getMP4Item(CUSTOM);
    reopened.dispose();
    assertEquals(
      value,
      undefined,
      `${backend}: removeMP4Item did not persist through save`,
    );
  });
}

/**
 * Atom-NAME fidelity (taglib-bnhl).
 *
 * TagLib::PropertyMap uppercases every key, so a freeform atom written through
 * it comes out as `----:com.apple.iTunes:ITUNNORM` rather than Apple's
 * `iTunNORM`. ExifTool recognises Apple's casing and not the upper-cased
 * variant, so this is not cosmetic.
 *
 * These tests deliberately assert on the atom names in the FILE BYTES, not on a
 * taglib-wasm read-back: TagLib reads both spellings as `appleSoundCheck`, so a
 * round-trip inside the library looks clean and cannot see the bug at all.
 */

/** Count occurrences of each atom-name spelling in the raw file bytes. */
function countAtomNames(
  buf: Uint8Array,
  names: string[],
): Record<string, number> {
  const haystack = new TextDecoder("latin1").decode(buf);
  const counts: Record<string, number> = {};
  for (const name of names) {
    // Match the exact spelling only — indexOf is case-sensitive, which is the
    // whole point here.
    let n = 0;
    for (
      let i = haystack.indexOf(name);
      i !== -1;
      i = haystack.indexOf(name, i + 1)
    ) n++;
    counts[name] = n;
  }
  return counts;
}

const SOUND_CHECK =
  " 00000599 00000308 00003460 00001D47 000061C7 000061DE 00007FEE 00007173 00007775 000056FC";

/** Atoms whose exact Apple casing must survive a write. */
const CANONICAL_ATOMS: Array<[name: string, value: string]> = [
  ["iTunNORM", SOUND_CHECK],
  // iTunSMPB carries encoder delay/padding for gapless playback, so an
  // ambiguous upper-cased duplicate is the worst case of this bug.
  [
    "iTunSMPB",
    " 00000000 00000840 000002CE 00000000000098F2 00000000 00000000",
  ],
];

for (const backend of BACKENDS) {
  Deno.test(`[${backend}] setProperties(appleSoundCheck) writes Apple's iTunNORM casing (taglib-bnhl)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    file.setProperties({ appleSoundCheck: [SOUND_CHECK] });
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    assertEquals(
      countAtomNames(buf, ["iTunNORM", "ITUNNORM"]),
      { iTunNORM: 1, ITUNNORM: 0 },
      `${backend}: wrong atom-name casing written to the file`,
    );

    // The value must still be readable, i.e. the correct casing is not bought
    // by breaking the round-trip.
    const reopened = await tl.open(buf);
    assertEquals(reopened.getProperty("appleSoundCheck"), SOUND_CHECK);
    reopened.dispose();
  });

  Deno.test(`[${backend}] re-saving an existing iTunNORM does not add an upper-cased twin (taglib-bnhl)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const seeded = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    seeded.setMP4Item(ITUNNORM, SOUND_CHECK);
    seeded.save();
    const withAtom = seeded.getFileBuffer();
    seeded.dispose();
    // Guard the premise: the seed itself must carry Apple's casing.
    assertEquals(countAtomNames(withAtom, ["iTunNORM", "ITUNNORM"]), {
      iTunNORM: 1,
      ITUNNORM: 0,
    }, `${backend}: seed did not use Apple's casing`);

    const file = await tl.open(withAtom);
    file.tag().setTitle("an unrelated edit");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    assertEquals(
      countAtomNames(buf, ["iTunNORM", "ITUNNORM"]),
      { iTunNORM: 1, ITUNNORM: 0 },
      `${backend}: an unrelated edit duplicated the atom under a new casing`,
    );
  });
}

for (const backend of BACKENDS) {
  for (const [atom, value] of CANONICAL_ATOMS) {
    const upper = atom.toUpperCase();

    Deno.test(`[${backend}] setMP4Item writes ${atom} with Apple's casing (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      file.setMP4Item(`----:com.apple.iTunes:${atom}`, value);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      assertEquals(
        countAtomNames(buf, [atom, upper]),
        { [atom]: 1, [upper]: 0 },
        `${backend}: ${atom} written with wrong casing`,
      );
    });

    Deno.test(`[${backend}] an unrelated edit does not duplicate ${atom} (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seeded = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      seeded.setMP4Item(`----:com.apple.iTunes:${atom}`, value);
      seeded.save();
      const withAtom = seeded.getFileBuffer();
      seeded.dispose();
      assertEquals(
        countAtomNames(withAtom, [atom, upper]),
        { [atom]: 1, [upper]: 0 },
        `${backend}: seed did not use Apple's casing for ${atom}`,
      );

      const file = await tl.open(withAtom);
      file.tag().setTitle("an unrelated edit");
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      assertEquals(
        countAtomNames(buf, [atom, upper]),
        { [atom]: 1, [upper]: 0 },
        `${backend}: an unrelated edit duplicated ${atom} under a new casing`,
      );
    });
  }
}

/**
 * General atom-name preservation (taglib-bnhl part a).
 *
 * The fix is not a list of known atoms: C++ snapshots the real freeform names
 * off the file before the PropertyMap write and repairs the mangled twins after,
 * so ANY atom name survives — including vendor atoms the library has never heard
 * of. These cases are the ones that were provably broken before that landed.
 */
const ARBITRARY_ATOMS = [
  "iTunes_CDDB_1", // real-world mixed case
  "MusicBrainz Track Id", // Title Case with spaces
  "lowercase", // no upper-case character at all
  "MiXeD_Vendor Atom", // nothing in any table could know this one
];

for (const backend of BACKENDS) {
  for (const atom of ARBITRARY_ATOMS) {
    Deno.test(`[${backend}] setMP4Item preserves the atom name "${atom}" (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      file.setMP4Item(`----:com.apple.iTunes:${atom}`, "probe-value");
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      // Assert the WHOLE record, not just the canonical count: checking only
      // counts[atom] cannot fail if a future change re-introduces the
      // upper-cased twin alongside it, which is taglib-bnhl's headline symptom.
      assertEquals(
        countAtomNames(buf, [atom, atom.toUpperCase()]),
        { [atom]: 1, [atom.toUpperCase()]: 0 },
        `${backend}: "${atom}" not written verbatim`,
      );
    });
  }
}

/**
 * Typed properties whose MP4 atom is a mixed-case freeform atom. These were
 * written upper-cased on BOTH backends, which matters most for ReplayGain:
 * `replaygain_track_gain` is the ecosystem's spelling, so an upper-cased atom is
 * invisible to other players.
 */
const TYPED_FREEFORM: Array<[property: string, atom: string]> = [
  ["replayGainTrackGain", "replaygain_track_gain"],
  ["replayGainAlbumGain", "replaygain_album_gain"],
  ["acoustidFingerprint", "Acoustid Fingerprint"],
  ["acoustidId", "Acoustid Id"],
];

for (const backend of BACKENDS) {
  for (const [property, atom] of TYPED_FREEFORM) {
    Deno.test(`[${backend}] ${property} writes the atom "${atom}" (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      file.setProperties({ [property]: ["probe-value"] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      assertEquals(
        countAtomNames(buf, [atom, atom.toUpperCase()]),
        { [atom]: 1, [atom.toUpperCase()]: 0 },
        `${backend}: ${property} wrote the wrong atom name`,
      );

      // Correct casing must not cost the round-trip.
      const reopened = await tl.open(buf);
      assertEquals(reopened.getProperty(property), "probe-value");
      reopened.dispose();
    });
  }
}

/**
 * Standard (non-freeform) atoms (taglib-0piv).
 *
 * `mp4ItemPropertyKey` only understood `----:`-prefixed names; a plain atom like
 * "trkn" or "©nam" fell through unchanged, so WASI looked for tagData["trkn"]
 * while the value actually lives under `trackNumber`. removeMP4Item was
 * therefore a silent no-op on WASI for every standard atom, while Emscripten's
 * Item API removed them correctly.
 *
 * Seeded through the typed property rather than setMP4Item, so the seed is known
 * to have written the atom — an earlier version of this check seeded with
 * setMP4Item, which silently wrote nothing, making "removed" vacuously true.
 */
const STANDARD_ATOMS: Array<[atom: string, property: string, value: string]> = [
  ["trkn", "trackNumber", "7"],
  ["disk", "discNumber", "2"],
  ["©nam", "title", "Seeded Title"],
  ["©gen", "genre", "Funk"],
];

for (const backend of BACKENDS) {
  for (const [atom, property, value] of STANDARD_ATOMS) {
    Deno.test(`[${backend}] removeMP4Item("${atom}") removes the atom (taglib-0piv)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });

      const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      seed.setProperties({ [property]: [value] });
      seed.save();
      const withAtom = seed.getFileBuffer();
      seed.dispose();
      const check = await tl.open(withAtom);
      assertEquals(
        (check.properties() as Record<string, string[]>)[property],
        [value],
        `${backend}: seed did not write ${atom}`,
      );
      check.dispose();

      const file = await tl.open(withAtom);
      file.removeMP4Item(atom);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(buf);
      assertEquals(
        (reopened.properties() as Record<string, string[]>)[property],
        undefined,
        `${backend}: removeMP4Item("${atom}") did not remove it`,
      );
      if (property === "trackNumber") {
        // The numeric mirror must go with the raw value, or tag().track would
        // keep reporting a removed track (taglib-qpl mirror invariant).
        assertEquals(reopened.tag().track, 0);
      }
      reopened.dispose();
    });
  }
}

/**
 * Item TYPE selection (taglib-uj2b).
 *
 * Emscripten's setMP4Item guessed the MP4 item type from the value string: a
 * value that parsed as an integer became an Int item. But the ATOM NAME
 * determines the type, not the value's spelling — `trkn`/`disk` are IntPair
 * atoms, so an Int item is the wrong shape and never renders, and a text atom
 * whose value happens to be all digits was filed as an Int.
 */
const TYPED_ATOM_CASES: Array<[atom: string, value: string, why: string]> = [
  ["trkn", "7", "IntPair atom, integer value"],
  ["disk", "2", "IntPair atom, integer value"],
  ["©nam", "Text Title", "Text atom, text value"],
  ["©nam", "2024", "Text atom whose value is all digits"],
  ["©gen", "Funk", "Text atom"],
];

for (const backend of BACKENDS) {
  for (const [atom, value, why] of TYPED_ATOM_CASES) {
    Deno.test(`[${backend}] setMP4Item round-trips ${atom}="${value}" — ${why} (taglib-uj2b)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      file.setMP4Item(atom, value);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(buf);
      try {
        assertEquals(
          reopened.getMP4Item(atom),
          value,
          `${backend}: ${atom} did not survive as "${value}"`,
        );
      } finally {
        reopened.dispose();
      }
    });
  }
}

/**
 * Regressions from the taglib-bnhl code review. Each of these shipped broken and
 * was caught only by probing a path the tests did not reach.
 */
for (const backend of BACKENDS) {
  Deno.test(`[${backend}] saveToFile preserves freeform atom casing (reconstruct path)`, async () => {
    // The casing fix lived in the C++ write path; the saveToFile reconstruct
    // rebuilds the property map at the FileHandle layer, below the site that
    // supplies atom names, so casing silently reverted for save-as only.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const src = await Deno.makeTempFile({ suffix: ".m4a" });
    const dst = await Deno.makeTempFile({ suffix: ".m4a" });
    try {
      await Deno.writeFile(src, await Deno.readFile(FIXTURE_PATH.m4a));
      const file = await tl.open(src);
      file.setProperties({ replayGainTrackGain: ["-3.00 dB"] });
      await file.saveToFile(dst);
      file.dispose();

      assertEquals(
        countAtomNames(await Deno.readFile(dst), [
          "replaygain_track_gain",
          "REPLAYGAIN_TRACK_GAIN",
        ]),
        { replaygain_track_gain: 1, REPLAYGAIN_TRACK_GAIN: 0 },
        `${backend}: saveToFile reverted the atom casing`,
      );
    } finally {
      await Deno.remove(src).catch(() => {});
      await Deno.remove(dst).catch(() => {});
    }
  });

  Deno.test(`[${backend}] setProperty (singular) writes the canonical atom name`, async () => {
    // The atom-name channel was wired into setProperties only.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    file.setProperty("replayGainTrackGain", "-3.00 dB");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    assertEquals(
      countAtomNames(buf, ["replaygain_track_gain", "REPLAYGAIN_TRACK_GAIN"]),
      { replaygain_track_gain: 1, REPLAYGAIN_TRACK_GAIN: 0 },
      `${backend}: setProperty wrote the upper-cased atom`,
    );
  });

  Deno.test(`[${backend}] two atoms that fold alike both survive with their own values`, async () => {
    // The twin match folded away case AND separators, so "My_Atom" and "MyAtom"
    // looked like one atom: one was deleted and the survivor kept the other's
    // value, losing the value just written. Wrong casing is recoverable; a
    // deleted value is not.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const first = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    first.setMP4Item("----:com.apple.iTunes:My_Atom", "AAA");
    first.save();
    const withFirst = first.getFileBuffer();
    first.dispose();

    const second = await tl.open(withFirst);
    second.setMP4Item("----:com.apple.iTunes:MyAtom", "BBB");
    second.save();
    const buf = second.getFileBuffer();
    second.dispose();

    const reopened = await tl.open(buf);
    try {
      assertEquals(
        reopened.getMP4Item("----:com.apple.iTunes:My_Atom"),
        "AAA",
        `${backend}: the pre-existing atom lost its value`,
      );
      assertEquals(
        reopened.getMP4Item("----:com.apple.iTunes:MyAtom"),
        "BBB",
        `${backend}: the newly written value was lost`,
      );
    } finally {
      reopened.dispose();
    }
  });
}

Deno.test("[wasi] removeMP4Item('trkn') does not resurrect the atom as 0/total", async () => {
  // trkn carries number AND total, so clearing the number while leaving
  // totalTracks let merge_intpair_properties re-create the atom as "0/12" —
  // a removal that silently corrupted the value instead.
  const tl = await TagLib.initialize({ forceWasmType: "wasi" });
  const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
  seed.setProperties({ trackNumber: ["3"], totalTracks: ["12"] });
  seed.save();
  const withTotal = seed.getFileBuffer();
  seed.dispose();

  const file = await tl.open(withTotal);
  file.removeMP4Item("trkn");
  file.save();
  const buf = file.getFileBuffer();
  file.dispose();

  const reopened = await tl.open(buf);
  try {
    const props = reopened.properties() as Record<string, string[]>;
    assertEquals(props.trackNumber, undefined, "atom resurrected");
    assertEquals(props.totalTracks, undefined, "total outlived its atom");
  } finally {
    reopened.dispose();
  }
});

/**
 * Freeform atoms bypass the PropertyMap entirely (taglib-wkyi).
 *
 * The PropertyMap destroys three properties of a freeform atom: its casing, its
 * identity (setProperties duplicates it), and its NAMESPACE — a non-Apple `mean`
 * was re-emitted under `----:com.apple.iTunes:`, so the caller's atom vanished
 * and a wrong-namespace twin appeared. Repairing names after the write could not
 * fix the namespace at all, because the mean is gone before the write happens.
 */
const MEANS = [
  "----:com.apple.iTunes:iTunNORM", // Apple mean, mixed case
  "----:com.apple.iTunes:lowercase", // Apple mean, no upper-case at all
  "----:com.acme.tool:MyTag", // NON-Apple mean — unrepresentable as a property
  "----:org.example.tool:Nested_Name", // non-Apple mean, underscores + case
  // NOT covered: a name containing a colon. A freeform key is exactly
  // "----:mean:name", so an extra colon is not a shape TagLib can store — both
  // backends refuse it identically, which is correct rather than a divergence.
];

for (const backend of BACKENDS) {
  for (const atom of MEANS) {
    Deno.test(`[${backend}] freeform atom "${atom}" round-trips by exact name (taglib-wkyi)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      file.setMP4Item(atom, "probe-value");
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      // The mean and the name must both be in the bytes, verbatim.
      const mean = atom.slice(
        "----:".length,
        atom.indexOf(":", "----:".length),
      );
      const bare = atom.slice(atom.lastIndexOf(":") + 1);
      const counts = countAtomNames(buf, [mean, bare, bare.toUpperCase()]);
      assertEquals(counts[mean], 1, `${backend}: mean "${mean}" not preserved`);
      assertEquals(counts[bare], 1, `${backend}: name "${bare}" not preserved`);
      if (bare !== bare.toUpperCase()) {
        assertEquals(
          counts[bare.toUpperCase()],
          0,
          `${backend}: an upper-cased twin was written`,
        );
      }

      // And it must be readable back by the same exact name.
      const reopened = await tl.open(buf);
      try {
        assertEquals(reopened.getMP4Item(atom), "probe-value");
      } finally {
        reopened.dispose();
      }
    });

    Deno.test(`[${backend}] removing freeform atom "${atom}" persists (taglib-wkyi)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
      seed.setMP4Item(atom, "to-remove");
      seed.save();
      const withAtom = seed.getFileBuffer();
      seed.dispose();
      const check = await tl.open(withAtom);
      assertEquals(check.getMP4Item(atom), "to-remove", "seed did not land");
      check.dispose();

      const file = await tl.open(withAtom);
      file.removeMP4Item(atom);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(buf);
      try {
        assertEquals(
          reopened.getMP4Item(atom),
          undefined,
          `${backend}: removal did not persist`,
        );
      } finally {
        reopened.dispose();
      }
    });
  }

  Deno.test(`[${backend}] an unrelated edit leaves every freeform atom untouched (taglib-wkyi)`, async () => {
    // The collect-and-apply design must preserve atoms it was told nothing
    // about, including means the property surface cannot even see.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const seed = await tl.open(await Deno.readFile(FIXTURE_PATH.m4a));
    for (const atom of MEANS) seed.setMP4Item(atom, `v-${atom}`);
    seed.save();
    const seeded = seed.getFileBuffer();
    seed.dispose();

    const file = await tl.open(seeded);
    file.tag().setTitle("an unrelated edit");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const reopened = await tl.open(buf);
    try {
      for (const atom of MEANS) {
        assertEquals(
          reopened.getMP4Item(atom),
          `v-${atom}`,
          `${backend}: "${atom}" did not survive an unrelated edit`,
        );
      }
    } finally {
      reopened.dispose();
    }
  });
}
