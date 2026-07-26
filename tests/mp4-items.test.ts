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
 * Atom-NAME casing (taglib-bnhl).
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
