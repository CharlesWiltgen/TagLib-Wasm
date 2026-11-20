/**
 * Cross-backend parity for MP4 freeform items (taglib-1qn).
 *
 * Emscripten implements getMP4Item/setMP4Item/removeMP4Item via TagLib's
 * dedicated C++ MP4 Item API (full `----:mean:name` atom keys). WASI has only
 * the PropertyMap snapshot, where TagLib keys freeform atoms by their bare,
 * uppercased NAME — so the full iTunes atom key must be normalized for the
 * round-trip to survive a save. These tests pin that both backends agree.
 */

import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { TagLib } from "../src/taglib.ts";
import { clearTags } from "../src/simple.ts";
import type { MP4FreeformItem } from "../src/types.ts";
import { MetadataError, UnsupportedFormatError } from "../src/errors.ts";
import {
  fromRawFreeformItem,
  toRawFreeformItem,
} from "../src/utils/mp4-freeform.ts";
import { FIXTURE_PATH } from "./shared-fixtures.ts";

const BACKENDS = ["wasi", "emscripten"] as const;
// A standard uppercase freeform key (round-trips losslessly on both backends)
// plus the real-world Apple Sound Check atom that the dynamics reader falls back
// to via getMP4Item.
const CUSTOM = "----:com.apple.iTunes:CUSTOM_PARITY";
const ITUNNORM = "----:com.apple.iTunes:iTunNORM";
// A genuinely foreign mean (NOT com.apple.iTunes): TagLib's PropertyMap
// translation covers iTunes-mean freeform atoms but no others, so WASI's
// setProperties-based erase pass cannot delete this atom — the taglib-65nm
// defect half the saved-bytes assertions below exist to catch.
const FOREIGN = "----:org.example.test:FOREIGN_ATOM";

/** A unique temp path with the given suffix (Node has no makeTempFile). */
function tempFile(suffix: string): string {
  return join(tmpdir(), `taglib-${randomUUID()}${suffix}`);
}

/** True when `needle` appears verbatim in `haystack` (ASCII atom names). */
function bytesContain(haystack: Uint8Array, needle: string): boolean {
  const bytes = new TextEncoder().encode(needle);
  if (bytes.length === 0 || bytes.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - bytes.length; i++) {
    for (let j = 0; j < bytes.length; j++) {
      if (haystack[i + j] !== bytes[j]) continue outer;
    }
    return true;
  }
  return false;
}

for (const backend of BACKENDS) {
  it(`[${backend}] MP4 freeform item round-trips through save (taglib-1qn)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setMP4Item(CUSTOM, "parity-value");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const reopened = await tl.open(buf);
    const value = reopened.getMP4Item(CUSTOM);
    reopened.dispose();
    expect(
      value,
      `${backend}: freeform MP4 item lost on save round-trip`,
    ).toStrictEqual("parity-value");
  });

  it(`[${backend}] MP4 Sound Check (iTunNORM) item round-trips through save (taglib-1qn)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setMP4Item(ITUNNORM, " 00000200 00000200");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const reopened = await tl.open(buf);
    const value = reopened.getMP4Item(ITUNNORM);
    reopened.dispose();
    expect(
      value,
      `${backend}: iTunNORM item lost on save round-trip`,
    ).toStrictEqual(" 00000200 00000200");
  });

  it(`[${backend}] removeMP4Item clears a freeform item through save (taglib-1qn)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const seeded = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
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
    expect(
      value,
      `${backend}: removeMP4Item did not persist through save`,
    ).toStrictEqual(undefined);
  });

  it(`[${backend}] removeMP4Item clears a FOREIGN-mean atom through save (taglib-65nm)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const seeded = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    seeded.setMP4Item(FOREIGN, "to-remove");
    seeded.save();
    const withItem = seeded.getFileBuffer();
    seeded.dispose();

    // Seed check: the atom must actually be on disk before removal — a test
    // that only asserts post-removal absence cannot tell "removed" from
    // "never written" (AGENTS.md observed-failing rule).
    expect(
      bytesContain(withItem, "FOREIGN_ATOM"),
      `${backend}: seed did not write the foreign atom to disk`,
    ).toStrictEqual(true);

    const file = await tl.open(withItem);
    file.removeMP4Item(FOREIGN);
    // Layer 1 — same-handle JS view: the raw `----:` snapshot slot must clear
    // immediately (the WASI raw-key deletion fix; Emscripten applies at once).
    expect(
      file.getMP4Item(FOREIGN),
      `${backend}: removeMP4Item did not clear the live handle view`,
    ).toStrictEqual(undefined);
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    // Layer 2 — the on-disk half: the atom bytes must be gone from the saved
    // file. This is the assertion the WASI C++ deletion channel exists for;
    // a view-only test cannot fail on the defect (AGENTS.md).
    expect(
      bytesContain(buf, "FOREIGN_ATOM"),
      `${backend}: foreign-mean atom survives on disk after removeMP4Item`,
    ).toStrictEqual(false);

    // Layer 3 — reopened view: disk-backed read-back agrees.
    const reopened = await tl.open(buf);
    const value = reopened.getMP4Item(FOREIGN);
    reopened.dispose();
    expect(
      value,
      `${backend}: foreign-mean atom still reported after reopen`,
    ).toStrictEqual(undefined);
  });
}

/**
 * isMP4() on the public surface. The WASI mock unit test
 * (wasi-adapter-unit.test.ts) covers magic-byte sniffing; this asserts both
 * backends agree on real fixtures, so a format-detection divergence on either
 * backend fails here.
 */
for (const backend of BACKENDS) {
  it(`[${backend}] isMP4() reflects the opened format`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const mp4 = await tl.open(new Uint8Array(await readFile(FIXTURE_PATH.m4a)));
    expect(
      mp4.isMP4(),
      `${backend}: m4a fixture not detected as MP4`,
    ).toStrictEqual(true);
    mp4.dispose();

    const mp3 = await tl.open(new Uint8Array(await readFile(FIXTURE_PATH.mp3)));
    expect(
      mp3.isMP4(),
      `${backend}: mp3 fixture detected as MP4`,
    ).toStrictEqual(false);
    mp3.dispose();
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
    )
      n++;
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
  it(`[${backend}] setProperties(appleSoundCheck) writes Apple's iTunNORM casing (taglib-bnhl)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setProperties({ appleSoundCheck: [SOUND_CHECK] });
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    expect(
      countAtomNames(buf, ["iTunNORM", "ITUNNORM"]),
      `${backend}: wrong atom-name casing written to the file`,
    ).toStrictEqual({ iTunNORM: 1, ITUNNORM: 0 });

    // The value must still be readable, i.e. the correct casing is not bought
    // by breaking the round-trip.
    const reopened = await tl.open(buf);
    expect(reopened.getProperty("appleSoundCheck")?.[0]).toStrictEqual(
      SOUND_CHECK,
    );
    reopened.dispose();
  });

  it(`[${backend}] re-saving an existing iTunNORM does not add an upper-cased twin (taglib-bnhl)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const seeded = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    seeded.setMP4Item(ITUNNORM, SOUND_CHECK);
    seeded.save();
    const withAtom = seeded.getFileBuffer();
    seeded.dispose();
    // Guard the premise: the seed itself must carry Apple's casing.
    expect(
      countAtomNames(withAtom, ["iTunNORM", "ITUNNORM"]),
      `${backend}: seed did not use Apple's casing`,
    ).toStrictEqual({ iTunNORM: 1, ITUNNORM: 0 });

    const file = await tl.open(withAtom);
    file.tag().setTitle("an unrelated edit");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    expect(
      countAtomNames(buf, ["iTunNORM", "ITUNNORM"]),
      `${backend}: an unrelated edit duplicated the atom under a new casing`,
    ).toStrictEqual({ iTunNORM: 1, ITUNNORM: 0 });
  });
}

for (const backend of BACKENDS) {
  for (const [atom, value] of CANONICAL_ATOMS) {
    const upper = atom.toUpperCase();

    it(`[${backend}] setMP4Item writes ${atom} with Apple's casing (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      file.setMP4Item(`----:com.apple.iTunes:${atom}`, value);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      expect(
        countAtomNames(buf, [atom, upper]),
        `${backend}: ${atom} written with wrong casing`,
      ).toStrictEqual({ [atom]: 1, [upper]: 0 });
    });

    it(`[${backend}] an unrelated edit does not duplicate ${atom} (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const seeded = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      seeded.setMP4Item(`----:com.apple.iTunes:${atom}`, value);
      seeded.save();
      const withAtom = seeded.getFileBuffer();
      seeded.dispose();
      expect(
        countAtomNames(withAtom, [atom, upper]),
        `${backend}: seed did not use Apple's casing for ${atom}`,
      ).toStrictEqual({ [atom]: 1, [upper]: 0 });

      const file = await tl.open(withAtom);
      file.tag().setTitle("an unrelated edit");
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      expect(
        countAtomNames(buf, [atom, upper]),
        `${backend}: an unrelated edit duplicated ${atom} under a new casing`,
      ).toStrictEqual({ [atom]: 1, [upper]: 0 });
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
    it(`[${backend}] setMP4Item preserves the atom name "${atom}" (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      file.setMP4Item(`----:com.apple.iTunes:${atom}`, "probe-value");
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      // Assert the WHOLE record, not just the canonical count: checking only
      // counts[atom] cannot fail if a future change re-introduces the
      // upper-cased twin alongside it, which is taglib-bnhl's headline symptom.
      expect(
        countAtomNames(buf, [atom, atom.toUpperCase()]),
        `${backend}: "${atom}" not written verbatim`,
      ).toStrictEqual({ [atom]: 1, [atom.toUpperCase()]: 0 });
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
    it(`[${backend}] ${property} writes the atom "${atom}" (taglib-bnhl)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      file.setProperties({ [property]: ["probe-value"] });
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      expect(
        countAtomNames(buf, [atom, atom.toUpperCase()]),
        `${backend}: ${property} wrote the wrong atom name`,
      ).toStrictEqual({ [atom]: 1, [atom.toUpperCase()]: 0 });

      // Correct casing must not cost the round-trip.
      const reopened = await tl.open(buf);
      expect(reopened.getProperty(property)?.[0]).toStrictEqual("probe-value");
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
    it(`[${backend}] removeMP4Item("${atom}") removes the atom (taglib-0piv)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });

      const seed = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      seed.setProperties({ [property]: [value] });
      seed.save();
      const withAtom = seed.getFileBuffer();
      seed.dispose();
      const check = await tl.open(withAtom);
      expect(
        (check.properties() as Record<string, string[]>)[property],
        `${backend}: seed did not write ${atom}`,
      ).toStrictEqual([value]);
      check.dispose();

      const file = await tl.open(withAtom);
      file.removeMP4Item(atom);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(buf);
      expect(
        (reopened.properties() as Record<string, string[]>)[property],
        `${backend}: removeMP4Item("${atom}") did not remove it`,
      ).toStrictEqual(undefined);
      if (property === "trackNumber") {
        // The numeric mirror must go with the raw value, or tag().track would
        // keep reporting a removed track (taglib-qpl mirror invariant).
        expect(reopened.tag().track).toStrictEqual(0);
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
    it(`[${backend}] setMP4Item round-trips ${atom}="${value}" — ${why} (taglib-uj2b)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const file = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      file.setMP4Item(atom, value);
      file.save();
      const buf = file.getFileBuffer();
      file.dispose();

      const reopened = await tl.open(buf);
      try {
        expect(
          reopened.getMP4Item(atom),
          `${backend}: ${atom} did not survive as "${value}"`,
        ).toStrictEqual(value);
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
  it(`[${backend}] saveToFile preserves freeform atom casing (reconstruct path)`, async () => {
    // The casing fix lived in the C++ write path; the saveToFile reconstruct
    // rebuilds the property map at the FileHandle layer, below the site that
    // supplies atom names, so casing silently reverted for save-as only.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const src = tempFile(".m4a");
    const dst = tempFile(".m4a");
    try {
      await writeFile(src, await readFile(FIXTURE_PATH.m4a));
      const file = await tl.open(src);
      file.setProperties({ replayGainTrackGain: ["-3.00 dB"] });
      await file.saveToFile(dst);
      file.dispose();

      expect(
        countAtomNames(new Uint8Array(await readFile(dst)), [
          "replaygain_track_gain",
          "REPLAYGAIN_TRACK_GAIN",
        ]),
        `${backend}: saveToFile reverted the atom casing`,
      ).toStrictEqual({ replaygain_track_gain: 1, REPLAYGAIN_TRACK_GAIN: 0 });
    } finally {
      await rm(src, { force: true }).catch(() => {});
      await rm(dst, { force: true }).catch(() => {});
    }
  });

  it(`[${backend}] setProperty (singular) writes the canonical atom name`, async () => {
    // The atom-name channel was wired into setProperties only.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setProperty("replayGainTrackGain", "-3.00 dB");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    expect(
      countAtomNames(buf, ["replaygain_track_gain", "REPLAYGAIN_TRACK_GAIN"]),
      `${backend}: setProperty wrote the upper-cased atom`,
    ).toStrictEqual({ replaygain_track_gain: 1, REPLAYGAIN_TRACK_GAIN: 0 });
  });

  it(`[${backend}] two atoms that fold alike both survive with their own values`, async () => {
    // The twin match folded away case AND separators, so "My_Atom" and "MyAtom"
    // looked like one atom: one was deleted and the survivor kept the other's
    // value, losing the value just written. Wrong casing is recoverable; a
    // deleted value is not.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const first = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
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
      expect(
        reopened.getMP4Item("----:com.apple.iTunes:My_Atom"),
        `${backend}: the pre-existing atom lost its value`,
      ).toStrictEqual("AAA");
      expect(
        reopened.getMP4Item("----:com.apple.iTunes:MyAtom"),
        `${backend}: the newly written value was lost`,
      ).toStrictEqual("BBB");
    } finally {
      reopened.dispose();
    }
  });
}

it("[wasi] removeMP4Item('trkn') does not resurrect the atom as 0/total", async () => {
  // trkn carries number AND total, so clearing the number while leaving
  // totalTracks let merge_intpair_properties re-create the atom as "0/12" —
  // a removal that silently corrupted the value instead.
  const tl = await TagLib.initialize({ forceWasmType: "wasi" });
  const seed = await tl.open(new Uint8Array(await readFile(FIXTURE_PATH.m4a)));
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
    expect(props.trackNumber, "atom resurrected").toStrictEqual(undefined);
    expect(props.totalTracks, "total outlived its atom").toStrictEqual(
      undefined,
    );
  } finally {
    reopened.dispose();
  }
});

/**
 * WRITE TWICE, then read. This is the pattern no test used, which is why a
 * regression that silently reverted the second write to most freeform-backed
 * properties survived a green suite: every existing test writes a field once,
 * and a design that restores the pre-edit on-disk value looks correct then.
 */
const REWRITE_FIELDS = [
  "label", // bare atom name is all-uppercase: LABEL
  "subtitle",
  "isrc",
  "conductor",
  "producer",
  "appleSoundCheck", // mixed-case bare name: iTunNORM
  "replayGainTrackGain", // lowercase bare name
  "acoustidFingerprint", // bare name differs by separator, not just case
];

for (const backend of BACKENDS) {
  for (const field of REWRITE_FIELDS) {
    it(`[${backend}] a second write to ${field} sticks [m4a]`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });

      const first = await tl.open(
        new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
      );
      first.setProperties({ [field]: ["First"] });
      first.save();
      const once = first.getFileBuffer();
      first.dispose();

      const second = await tl.open(once);
      // Read-modify-write, as a real consumer does.
      second.setProperties({ ...second.properties(), [field]: ["Second"] });
      second.save();
      const twice = second.getFileBuffer();
      second.dispose();

      const reopened = await tl.open(twice);
      try {
        expect(
          (reopened.properties() as Record<string, string[]>)[field],
          `${backend}: the second write to ${field} was lost`,
        ).toStrictEqual(["Second"]);
      } finally {
        reopened.dispose();
      }
    });
  }

  it(`[${backend}] writing a freeform property leaves no upper-cased twin [m4a]`, async () => {
    // acoustidFingerprint's atom name differs from its wire key by a separator
    // (space vs underscore), so a twin-detection scheme that only re-cases the
    // name misses it and both spellings end up on disk.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setProperties({ acoustidFingerprint: ["V1"] });
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    expect(
      countAtomNames(buf, ["Acoustid Fingerprint", "ACOUSTID_FINGERPRINT"]),
      `${backend}: an upper-cased twin atom was written alongside`,
    ).toStrictEqual({ "Acoustid Fingerprint": 1, ACOUSTID_FINGERPRINT: 0 });
  });

  it(`[${backend}] save-as preserves freeform-backed properties on a NON-MP4 file [flac]`, async () => {
    // A guard that assumes "MP4" while running for every container strips these
    // keys from the property map and then never writes them back.
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const src = tempFile(".flac");
    const dst = tempFile(".flac");
    try {
      await writeFile(src, await readFile(FIXTURE_PATH.flac));
      const seed = await tl.open(src);
      seed.setProperties({
        replayGainTrackGain: ["-3.00 dB"],
        appleSoundCheck: [" 0001"],
        musicbrainzTrackId: ["mbid"],
      });
      seed.save();
      await writeFile(src, seed.getFileBuffer());
      seed.dispose();

      const file = await tl.open(src);
      await file.saveToFile(dst);
      file.dispose();

      const reopened = await tl.open(dst);
      try {
        const props = reopened.properties() as Record<string, string[]>;
        expect(props.replayGainTrackGain).toStrictEqual(["-3.00 dB"]);
        expect(props.appleSoundCheck).toStrictEqual([" 0001"]);
        expect(props.musicbrainzTrackId).toStrictEqual(["mbid"]);
      } finally {
        reopened.dispose();
      }
    } finally {
      await rm(src, { force: true }).catch(() => {});
      await rm(dst, { force: true }).catch(() => {});
    }
  });
}

// taglib-wkyi: WASI routes MP4 items through TagLib's PropertyMap, which knows
// exactly one freeform namespace — ItemFactory::nameForPropertyKey rebuilds every
// freeform key as `----:com.apple.iTunes:<NAME>`, upper-cased. So an atom with a
// foreign mean came back in Apple's namespace under a different name and the
// caller's atom was gone. The exact name the caller supplied crosses the boundary
// and is reinstated afterwards.
//
// Asserted on the raw bytes because the atom NAME is what the defect mangled; a
// reader that normalises names would hide exactly that.
for (const backend of BACKENDS) {
  it(`[${backend}] a foreign freeform mean survives a save (taglib-wkyi)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setMP4Item("----:com.acme.tool:MyTag", "v");
    file.save();
    const buf = file.getFileBuffer();
    file.dispose();

    const text = new TextDecoder("latin1").decode(buf);
    expect(
      (text.match(/com\.acme\.tool/g) ?? []).length,
      `${backend} moved the atom out of its own namespace`,
    ).toStrictEqual(1);
    expect(
      (text.match(/MyTag/g) ?? []).length,
      `${backend} did not keep the atom name verbatim`,
    ).toStrictEqual(1);
    expect(
      (text.match(/MYTAG/g) ?? []).length,
      `${backend} left an upper-cased twin behind`,
    ).toStrictEqual(0);
  });
}

// taglib-5ibr: the write fix above keeps the atom's bytes correct, but WASI
// resolved every ----: read through the PropertyMap, which never carries a
// foreign mean — so the library could not read back an atom it had itself just
// written, nor one any other tool wrote. The wkyi test passes on the raw bytes
// while the read is broken, so this one must assert the ROUND TRIP.
for (const backend of BACKENDS) {
  it(`[${backend}] a foreign freeform atom reads back after a save (taglib-5ibr)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    file.setMP4Item("----:com.acme.tool:MyTag", "acme-value");
    file.save();
    const sameHandle = file.getMP4Item("----:com.acme.tool:MyTag");
    const buf = file.getFileBuffer();
    file.dispose();

    expect(
      sameHandle,
      `${backend} lost the atom on its own handle across a save`,
    ).toStrictEqual("acme-value");

    const reopened = await tl.open(buf);
    try {
      expect(
        reopened.getMP4Item("----:com.acme.tool:MyTag"),
        `${backend} cannot read back the atom it wrote`,
      ).toStrictEqual("acme-value");
      // The atom rides a dedicated channel, not the property surface: TagLib's
      // PropertyMap never carries a foreign mean, so Emscripten's properties()
      // does not show it and WASI's must not either.
      const props = reopened.properties() as Record<string, string[]>;
      expect(
        props["----:com.acme.tool:MyTag"],
        `${backend} leaked the foreign atom into properties()`,
      ).toStrictEqual(undefined);
    } finally {
      reopened.dispose();
    }
  });
}

// ---------------------------------------------------------------------------
// Typed MP4 freeform items (taglib-gja)
// ---------------------------------------------------------------------------

const FREEFORM_ITEMS: MP4FreeformItem[] = [
  {
    mean: "com.apple.iTunes",
    name: "Test Text",
    type: "utf8",
    value: "héllo",
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Binary",
    type: "jpeg",
    value: new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]),
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Implicit",
    type: "implicit",
    value: new Uint8Array([0, 1, 2, 0xff]),
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Utf16",
    type: "utf16",
    value: new Uint8Array([0xff, 0xfe, 0x41, 0x00]),
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Int",
    type: "integer",
    value: -123456,
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Other",
    type: "other",
    typeCode: 99,
    value: new Uint8Array([9, 8, 7]),
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Multi",
    type: "utf8",
    value: "one",
  },
  {
    mean: "com.apple.iTunes",
    name: "Test Multi",
    type: "utf8",
    value: "two",
  },
];

/** Group one-item-per-value results by atom/type; values keep their order. */
function freeformGroups(items: readonly MP4FreeformItem[]): unknown[] {
  const groups = new Map<
    string,
    {
      type: MP4FreeformItem["type"];
      typeCode?: number | undefined;
      values: unknown[];
    }
  >();
  for (const item of items) {
    const key = `${item.mean}\u0000${item.name}\u0000${item.type}\u0000${
      item.typeCode ?? ""
    }`;
    const value =
      item.value instanceof Uint8Array ? Array.from(item.value) : item.value;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        type: item.type,
        typeCode: item.typeCode,
        values: [value],
      });
    } else {
      group.values.push(value);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

for (const backend of BACKENDS) {
  it(`[${backend}] typed freeform items round-trip through save (taglib-gja)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems(FREEFORM_ITEMS);
      expect(
        freeformGroups(file.getMP4FreeformItems()),
        `${backend}: staged reads disagree`,
      ).toStrictEqual(freeformGroups(FREEFORM_ITEMS));

      file.save();
      const buf = file.getFileBuffer();
      for (const reader of BACKENDS) {
        const readerTl = await TagLib.initialize({ forceWasmType: reader });
        const reopened = await readerTl.open(new Uint8Array(buf));
        try {
          expect(
            freeformGroups(reopened.getMP4FreeformItems()),
            `${reader} reading a file written by ${backend}`,
          ).toStrictEqual(freeformGroups(FREEFORM_ITEMS));
        } finally {
          reopened.dispose();
        }
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] freeform items survive a property-map write (taglib-gja)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems(FREEFORM_ITEMS);
      file.save();
      const withItems = file.getFileBuffer();

      const reopened = await tl.open(withItems);
      try {
        const props = reopened.properties() as Record<string, string[]>;
        reopened.setProperties({ ...props, title: ["Freeform Survivor"] });
        reopened.save();
        const afterEdit = reopened.getFileBuffer();

        const again = await tl.open(afterEdit);
        try {
          expect(
            freeformGroups(again.getMP4FreeformItems()),
            `${backend}: property write dropped freeform items`,
          ).toStrictEqual(freeformGroups(FREEFORM_ITEMS));
        } finally {
          again.dispose();
        }
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] setMP4FreeformItems([]) clears every freeform item (taglib-gja)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems(FREEFORM_ITEMS);
      file.save();
      const withItems = file.getFileBuffer();

      const reopened = await tl.open(withItems);
      try {
        reopened.setMP4FreeformItems([]);
        reopened.save();
        const cleared = reopened.getFileBuffer();

        const again = await tl.open(cleared);
        try {
          expect(
            again.getMP4FreeformItems(),
            `${backend}: freeform items survived an explicit clear`,
          ).toStrictEqual([]);
        } finally {
          again.dispose();
        }
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] freeform methods reject non-MP4 files (taglib-gja)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.mp3)),
    );
    try {
      expect(() => file.getMP4FreeformItems()).toThrow(UnsupportedFormatError);
      expect(() => file.setMP4FreeformItems([])).toThrow(
        UnsupportedFormatError,
      );
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] freeform setters validate mean/name/type/value (taglib-gja)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      expect(() =>
        file.setMP4FreeformItems([
          { mean: "a:b", name: "X", type: "utf8", value: "x" },
        ]),
      ).toThrow(MetadataError);
      expect(() =>
        file.setMP4FreeformItems([
          { mean: "com.apple.iTunes", name: "X", type: "integer", value: 1.5 },
        ]),
      ).toThrow(MetadataError);
      expect(() =>
        file.setMP4FreeformItems([
          {
            mean: "com.apple.iTunes",
            name: "X",
            type: "utf8",
            value: new Uint8Array([1]),
          },
        ]),
      ).toThrow(MetadataError);
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] clearTags clears a property-backed freeform atom (taglib-gja review)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const source = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
    const seeded = await tl.open(source);
    try {
      seeded.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "iTunNORM",
          type: "utf8",
          value: "clear-me-12345",
        },
      ]);
      seeded.save();
      const cleared = await clearTags(seeded.getFileBuffer());

      const reopened = await tl.open(cleared);
      try {
        expect(
          reopened.getMP4FreeformItems().filter((i) => i.name === "iTunNORM"),
          `${backend}: clearTags left the freeform item`,
        ).toStrictEqual([]);
        expect(
          (reopened.properties() as Record<string, unknown>).appleSoundCheck,
          `${backend}: clearTags left the property slot`,
        ).toBeUndefined();
      } finally {
        reopened.dispose();
      }
    } finally {
      seeded.dispose();
    }
  });

  if (backend === "emscripten") {
    it(`[${backend}] replace-style setProperties clears a text freeform atom (taglib-gja review)`, async () => {
      const tl = await TagLib.initialize({ forceWasmType: backend });
      const source = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
      const seeded = await tl.open(source);
      try {
        seeded.setMP4FreeformItems([
          {
            mean: "com.apple.iTunes",
            name: "MOOD",
            type: "utf8",
            value: "Clear Me",
          },
        ]);
        seeded.save();
        const file = await tl.open(seeded.getFileBuffer());
        try {
          file.setProperties({ title: ["Replace Style"] });
          file.save();
          const reopened = await tl.open(file.getFileBuffer());
          try {
            expect(
              reopened.getMP4FreeformItems().filter((i) => i.name === "MOOD"),
              `${backend}: replace-style setProperties kept the freeform item`,
            ).toStrictEqual([]);
          } finally {
            reopened.dispose();
          }
        } finally {
          file.dispose();
        }
      } finally {
        seeded.dispose();
      }
    });
  }

  it(`[${backend}] a property write over a binary freeform atom wins (taglib-gja review)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const source = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
    const seeded = await tl.open(source);
    try {
      seeded.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "MOOD",
          type: "jpeg",
          value: new Uint8Array([1, 2, 3]),
        },
      ]);
      seeded.save();

      const file = await tl.open(seeded.getFileBuffer());
      try {
        file.setProperty("MOOD", "Happy");
        file.save();
        const reopened = await tl.open(file.getFileBuffer());
        try {
          expect(
            reopened.getMP4FreeformItems().map((i) => ({
              name: i.name,
              type: i.type,
              value: i.value,
            })),
            `${backend}: the explicit property write did not replace the binary atom`,
          ).toStrictEqual([{ name: "MOOD", type: "utf8", value: "Happy" }]);
          expect(
            (reopened.properties() as Record<string, unknown>).mood,
            `${backend}: the property slot is missing the explicit value`,
          ).toStrictEqual(["Happy"]);
        } finally {
          reopened.dispose();
        }
      } finally {
        file.dispose();
      }
    } finally {
      seeded.dispose();
    }
  });

  it(`[${backend}] a property write after setMP4FreeformItems wins in the same save`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "MOOD",
          type: "jpeg",
          value: new Uint8Array([1, 2, 3]),
        },
      ]);
      // Same handle, same save: last write wins, as on the live Emscripten tag.
      file.setProperty("MOOD", "Happy");
      file.save();

      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(
          reopened.getMP4FreeformItems().map((i) => ({
            name: i.name,
            type: i.type,
            value: i.value,
          })),
          `${backend}: the later property write was discarded`,
        ).toStrictEqual([{ name: "MOOD", type: "utf8", value: "Happy" }]);
        expect(
          (reopened.properties() as Record<string, unknown>).mood,
          `${backend}: the property slot is missing the later value`,
        ).toStrictEqual(["Happy"]);
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] a foreign-mean UTF-8 typed item gets no Apple twin`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems([
        {
          mean: "org.example.test",
          name: "FOREIGN_TEXT",
          type: "utf8",
          value: "foreign-value",
        },
      ]);
      // The PropertyMap only expresses com.apple.iTunes; a slot here would
      // save a SECOND atom in Apple's namespace.
      expect(
        (file.properties() as Record<string, unknown>).foreignText,
        `${backend}: a foreign atom was mirrored into the PropertyMap`,
      ).toBeUndefined();
      file.save();

      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(
          reopened.getMP4FreeformItems().map((i) => ({
            mean: i.mean,
            name: i.name,
            type: i.type,
            value: i.value,
          })),
          `${backend}: the foreign atom did not round-trip alone`,
        ).toStrictEqual([
          {
            mean: "org.example.test",
            name: "FOREIGN_TEXT",
            type: "utf8",
            value: "foreign-value",
          },
        ]);
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] setMP4Item updates the typed freeform view`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "MOOD",
          type: "utf8",
          value: "old",
        },
      ]);
      file.setMP4Item("----:com.apple.iTunes:MOOD", "new");
      expect(
        file
          .getMP4FreeformItems()
          .filter((i) => i.name === "MOOD")
          .map((i) => i.value),
        `${backend}: getMP4FreeformItems served a stale value`,
      ).toStrictEqual(["new"]);

      file.save();
      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(
          reopened.getMP4Item("----:com.apple.iTunes:MOOD"),
          `${backend}: the saved atom kept the pre-setMP4Item value`,
        ).toStrictEqual("new");
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] a typed replacement clears a freeform property written earlier`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setProperty("MOOD", "Happy");
      file.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "BAR",
          type: "utf8",
          value: "b",
        },
      ]);
      file.save();

      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(
          reopened.getMP4FreeformItems().map((i) => i.name),
          `${backend}: the replacement left an earlier property atom behind`,
        ).toStrictEqual(["BAR"]);
        expect(
          (reopened.properties() as Record<string, unknown>).mood,
          `${backend}: the earlier property survived the replacement`,
        ).toBeUndefined();
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] setMP4Item updates the typed view on a file with no freeform atoms`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4Item("----:com.apple.iTunes:NEW_ATOM", "hello");
      expect(
        file.getMP4FreeformItems().map((i) => ({
          name: i.name,
          type: i.type,
          value: i.value,
        })),
        `${backend}: the item write is missing from the typed view`,
      ).toStrictEqual([{ name: "NEW_ATOM", type: "utf8", value: "hello" }]);

      file.save();
      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(
          reopened.getMP4Item("----:com.apple.iTunes:NEW_ATOM"),
        ).toStrictEqual("hello");
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] setMP4Item(key, "") removes the typed entry`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "MOOD",
          type: "utf8",
          value: "old",
        },
      ]);
      file.setMP4Item("----:com.apple.iTunes:MOOD", "");
      expect(
        file.getMP4FreeformItems(),
        `${backend}: the cleared item is still in the typed view`,
      ).toStrictEqual([]);

      file.save();
      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(reopened.getMP4FreeformItems()).toStrictEqual([]);
        expect(
          reopened.getMP4Item("----:com.apple.iTunes:MOOD"),
        ).toBeUndefined();
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] a property write after saving a binary atom updates the typed view`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "MOOD",
          type: "jpeg",
          value: new Uint8Array([1, 2, 3]),
        },
      ]);
      file.save();
      file.setProperty("MOOD", "Happy");
      expect(
        file.getMP4FreeformItems().map((i) => ({
          name: i.name,
          type: i.type,
          value: i.value,
        })),
        `${backend}: the typed view still shows the binary atom`,
      ).toStrictEqual([{ name: "MOOD", type: "utf8", value: "Happy" }]);

      file.save();
      const reopened = await tl.open(file.getFileBuffer());
      try {
        expect(
          reopened.getMP4FreeformItems().map((i) => ({
            name: i.name,
            type: i.type,
            value: i.value,
          })),
        ).toStrictEqual([{ name: "MOOD", type: "utf8", value: "Happy" }]);
        expect(
          (reopened.properties() as Record<string, unknown>).mood,
        ).toStrictEqual(["Happy"]);
      } finally {
        reopened.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] a numeric-looking freeform value persists and replaces the old one`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const key = "----:com.apple.iTunes:PROBE_NUM";
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      file.setMP4Item(key, "old-value");
      file.save();

      const overwrite = await tl.open(file.getFileBuffer());
      try {
        overwrite.setMP4Item(key, "42");
        overwrite.save();

        const reopened = await tl.open(overwrite.getFileBuffer());
        try {
          expect(
            reopened.getMP4Item(key),
            `${backend}: a numeric-looking value must not become an Int item`,
          ).toStrictEqual("42");
          expect(
            reopened.getMP4FreeformItems().map((i) => i.name),
            `${backend}: the atom was deleted instead of updated`,
          ).toStrictEqual(["PROBE_NUM"]);
        } finally {
          reopened.dispose();
        }
      } finally {
        overwrite.dispose();
      }
    } finally {
      file.dispose();
    }
  });

  it(`[${backend}] a typed text update is stable across two saves (taglib-gja review)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const source = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
    const seeded = await tl.open(source);
    try {
      seeded.setMP4FreeformItems([
        {
          mean: "com.apple.iTunes",
          name: "MOOD",
          type: "utf8",
          value: "Old",
        },
      ]);
      seeded.save();

      const file = await tl.open(seeded.getFileBuffer());
      try {
        file.setMP4FreeformItems([
          {
            mean: "com.apple.iTunes",
            name: "MOOD",
            type: "utf8",
            value: "New",
          },
        ]);
        expect(
          (file.properties() as Record<string, unknown>).mood,
          `${backend}: staged property slot is stale`,
        ).toStrictEqual(["New"]);
        file.save();
        file.save();

        const reopened = await tl.open(file.getFileBuffer());
        try {
          expect(
            reopened.getMP4FreeformItems().map((i) => ({
              name: i.name,
              type: i.type,
              value: i.value,
            })),
            `${backend}: the second save reverted the typed value`,
          ).toStrictEqual([{ name: "MOOD", type: "utf8", value: "New" }]);
          expect(
            (reopened.properties() as Record<string, unknown>).mood,
            `${backend}: the second save reverted the property slot`,
          ).toStrictEqual(["New"]);
        } finally {
          reopened.dispose();
        }
      } finally {
        file.dispose();
      }
    } finally {
      seeded.dispose();
    }
  });

  it(`[${backend}] saveToFile carries staged typed freeform items (taglib-gja review)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const source = new Uint8Array(await readFile(FIXTURE_PATH.m4a));
    const target = tempFile(".m4a");
    try {
      const file = await tl.open(source);
      try {
        file.setMP4FreeformItems(FREEFORM_ITEMS);
        await file.saveToFile(target);
      } finally {
        file.dispose();
      }
      const reopened = await tl.open(target);
      try {
        expect(
          freeformGroups(reopened.getMP4FreeformItems()),
          `${backend}: saveToFile dropped the staged typed items`,
        ).toStrictEqual(freeformGroups(FREEFORM_ITEMS));
      } finally {
        reopened.dispose();
      }
    } finally {
      await rm(target, { force: true });
    }
  });

  it(`[${backend}] mixed types for one freeform atom are rejected (taglib-gja review)`, async () => {
    const tl = await TagLib.initialize({ forceWasmType: backend });
    const file = await tl.open(
      new Uint8Array(await readFile(FIXTURE_PATH.m4a)),
    );
    try {
      expect(() =>
        file.setMP4FreeformItems([
          {
            mean: "com.apple.iTunes",
            name: "Mixed",
            type: "utf8",
            value: "text",
          },
          {
            mean: "com.apple.iTunes",
            name: "Mixed",
            type: "jpeg",
            value: new Uint8Array([1]),
          },
        ]),
      ).toThrow(MetadataError);
    } finally {
      file.dispose();
    }
  });
}

it("a non-int32 AtomDataType 21 atom stays writable", () => {
  const raw = {
    mean: "com.apple.iTunes",
    name: "SHORT_INT",
    type: 21,
    value: new Uint8Array([0, 7]),
  };
  const item = fromRawFreeformItem(raw);
  expect(item.type).toStrictEqual("other");
  expect(item.typeCode).toStrictEqual(21);
  expect(toRawFreeformItem(item)).toStrictEqual(raw);
});
