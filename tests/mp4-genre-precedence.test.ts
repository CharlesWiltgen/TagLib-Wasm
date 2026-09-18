/**
 * @fileoverview MP4 genre precedence: a valid string `©gen` beats the legacy
 * numeric `gnre` on both backends, at read AND at save (taglib-lna2).
 *
 * TagLib folds `gnre` into the `©gen` item at parse (parseGnre ->
 * ID3v1::genre(idx - 1)) and `MP4::Tag::addItem` is first-wins, so an ilst
 * carrying `gnre` BEFORE a differing `©gen` reads the 8-bit table name and
 * every save re-renders `©gen` from that folded value — a bare `save()` with no
 * writes included, because save rebuilds the whole ilst from the parsed map.
 * `src/capi/taglib_mp4_genre.h` resolves the precedence at file open in our own
 * C++ boundary on both backends.
 *
 * The four fixtures come from `tests/test-files/_gen/make-gnre-first-mp4.py`
 * (`before`/`after` differ only in ilst order; `omit` is the control that
 * proves `©gen` parses alone; `only` is the gnre-only fallback arm). Every
 * assertion below is made through the public `AudioFile`/Simple surfaces, and
 * the written bytes are re-walked at the atom level — the genre a caller gets
 * back is not evidence about what landed in the file.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/taglib.ts";
import type { AudioFile } from "../src/taglib/audio-file-interface.ts";
import { applyTags, readTags } from "../src/simple/index.ts";
import { HAS_EMSCRIPTEN, HAS_WASI } from "./backend-adapter.ts";
import { GNRE_GENRE_FIXTURES } from "./shared-fixtures.ts";

const IN_CI = Deno.env.get("GITHUB_ACTIONS") === "true";
const SKIP = (!HAS_WASI || !HAS_EMSCRIPTEN) && !IN_CI;

type Fixture = keyof typeof GNRE_GENRE_FIXTURES;

/** The ID3v1 table name `gnre` index 18 folds to. */
const TABLE_GENRE = "Rock";
/** The string `©gen` carries in every fixture that has one. */
const STRING_GENRE = "Rock & Roll";

const BACKENDS = ["wasi", "emscripten"] as const;
type Backend = (typeof BACKENDS)[number];

// ---------------------------------------------------------------------------
// Atom walk
// ---------------------------------------------------------------------------

/** `©gen` in the ilst's 4-byte-namespace: © = 0xA9, stored Latin-1. */
const GEN = "\u00a9gen";
const GNRE = "gnre";
/** Child atom header (8) + data box header (size/"data"/type/locale = 16). */
const GENRE_PAYLOAD_OFFSET = 24;

interface Atom {
  name: string;
  /** Offset of the atom's own size field. */
  start: number;
  end: number;
}

function childAtoms(bytes: Uint8Array, start: number, end: number): Atom[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const atoms: Atom[] = [];
  let i = start;
  while (i + 8 <= end) {
    const size = dv.getUint32(i);
    if (size < 8 || i + size > end) break;
    // The 4-byte name is an arbitrary byte string (©gen is 0xA9 0x67 0x65 0x6E),
    // so it is read as Latin-1 rather than UTF-8.
    const name = new TextDecoder("latin1").decode(bytes.subarray(i + 4, i + 8));
    atoms.push({ name, start: i, end: i + size });
    i += size;
  }
  return atoms;
}

/** The single `moov > udta > meta > ilst` atom, walked from the real tree (the
 *  fixtures keep moov last, so a textual "ilst" search would be luck). */
function ilstAtom(bytes: Uint8Array): Atom | undefined {
  const top = childAtoms(bytes, 0, bytes.length);
  const moov = top.find((a) => a.name === "moov");
  if (!moov) return undefined;
  const udta = childAtoms(bytes, moov.start + 8, moov.end).find(
    (a) => a.name === "udta",
  );
  if (!udta) return undefined;
  const meta = childAtoms(bytes, udta.start + 8, udta.end).find(
    (a) => a.name === "meta",
  );
  if (!meta) return undefined;
  // meta carries a 4-byte version/flags word ahead of its children.
  return childAtoms(bytes, meta.start + 12, meta.end).find(
    (a) => a.name === "ilst",
  );
}

/**
 * Every genre atom in the file's ilst, in file order, as `"<name>:<payload>"`.
 * `gnre` is numeric; its payload is reported as hex so an unexpected re-created
 * atom is visible rather than silently decoded as text.
 */
function genreAtoms(bytes: Uint8Array): string[] {
  const ilst = ilstAtom(bytes);
  if (!ilst) return [];
  return childAtoms(bytes, ilst.start + 8, ilst.end)
    .filter((a) => a.name === GEN || a.name === GNRE)
    .map((a) => {
      const payload = bytes.subarray(a.start + GENRE_PAYLOAD_OFFSET, a.end);
      const value = a.name === GEN
        ? new TextDecoder().decode(payload)
        : [...payload].map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${a.name}:${value}`;
    });
}

/** The raw bytes of the file's `©gen` atom, or undefined when it has none. */
function genAtomBytes(bytes: Uint8Array): Uint8Array | undefined {
  const ilst = ilstAtom(bytes);
  if (!ilst) return undefined;
  const gen = childAtoms(bytes, ilst.start + 8, ilst.end).find(
    (a) => a.name === GEN,
  );
  return gen && bytes.subarray(gen.start, gen.end);
}

async function withFile<T>(
  backend: Backend,
  bytes: Uint8Array,
  fn: (file: AudioFile) => T | Promise<T>,
): Promise<T> {
  const taglib = await TagLib.initialize({ forceWasmType: backend });
  const file = await taglib.open(bytes);
  try {
    return await fn(file);
  } finally {
    file.dispose();
  }
}

/** Open, run `mutate` (omitted for a bare save), save, and return the bytes. */
async function savedBytes(
  backend: Backend,
  bytes: Uint8Array,
  mutate?: (file: AudioFile) => void,
): Promise<Uint8Array> {
  return await withFile(backend, bytes, (file) => {
    mutate?.(file);
    assert(file.save(), "save() reported failure");
    return file.getFileBuffer();
  });
}

for (const backend of BACKENDS) {
  describe(`MP4 genre precedence [${backend}]`, { ignore: SKIP }, () => {
    it("reads the string ©gen when gnre precedes it", async () => {
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["before"]);
      assertEquals(genreAtoms(bytes), [`gnre:0012`, `${GEN}:${STRING_GENRE}`]);
      await withFile(backend, bytes, (file) => {
        assertEquals(file.tag().genre, STRING_GENRE);
        assertEquals(file.properties().genre, [STRING_GENRE]);
        assertEquals(file.getProperty("GENRE"), [STRING_GENRE]);
        assertEquals(file.getMP4Item(GEN), STRING_GENRE);
      });
    });

    it("a bare save keeps the string and writes no gnre", async () => {
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["before"]);
      const out = await savedBytes(backend, bytes);
      assertEquals(genreAtoms(out), [`${GEN}:${STRING_GENRE}`]);
      const gen = genAtomBytes(out);
      assertExists(gen);
      // The data box's type word must be 1 (UTF-8): TagLib's parseText accepts
      // nothing else, so any other value makes the atom invisible on re-read.
      // Layout of the child: size + "©gen" (8) + size + "data" + type + locale.
      assertEquals(
        new DataView(gen.buffer, gen.byteOffset, gen.byteLength).getUint32(16),
        1,
      );
      await withFile(backend, out.slice(), (file) => {
        assertEquals(file.tag().genre, STRING_GENRE);
        assertEquals(file.properties().genre, [STRING_GENRE]);
      });
    });

    it("a readTags -> applyTags round-trip preserves the string", async () => {
      await TagLib.initialize({ forceWasmType: backend });
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["before"]);
      const tags = await readTags(bytes);
      assertExists(tags.genre);
      assertEquals(tags.genre, [STRING_GENRE]);
      const out = await applyTags(bytes, { genre: tags.genre });
      assertEquals(genreAtoms(out), [`${GEN}:${STRING_GENRE}`]);
      assertEquals((await readTags(out)).genre, [STRING_GENRE]);
    });

    it("a title-only edit preserves the string", async () => {
      await TagLib.initialize({ forceWasmType: backend });
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["before"]);
      const out = await applyTags(bytes, { title: "Genre Precedence" });
      assertEquals(genreAtoms(out), [`${GEN}:${STRING_GENRE}`]);
      const tags = await readTags(out);
      assertEquals(tags.title, ["Genre Precedence"]);
      assertEquals(tags.genre, [STRING_GENRE]);
    });

    it("an explicit setGenre wins, including the table name", async () => {
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["before"]);
      const jazz = await savedBytes(
        backend,
        bytes,
        (file) => file.tag().setGenre("Jazz"),
      );
      assertEquals(genreAtoms(jazz), [`${GEN}:Jazz`]);
      const table = await savedBytes(
        backend,
        bytes,
        (file) => file.tag().setGenre(TABLE_GENRE),
      );
      assertEquals(genreAtoms(table), [`${GEN}:${TABLE_GENRE}`]);
    });

    it("leaves the ©gen of the after and omit controls untouched", async () => {
      for (const name of ["after", "omit"] as const) {
        const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES[name]);
        const before = genAtomBytes(bytes);
        assertExists(before);
        await withFile(backend, bytes, (file) => {
          assertEquals(file.tag().genre, STRING_GENRE);
        });
        const out = await savedBytes(backend, bytes);
        assertEquals(genAtomBytes(out), before, `${name}: ©gen rewritten`);
        assertEquals(genreAtoms(out), [`${GEN}:${STRING_GENRE}`]);
      }
    });

    it("still reads the ID3v1 table name for a gnre-only file", async () => {
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["only"]);
      assertEquals(genreAtoms(bytes), ["gnre:0012"]);
      await withFile(backend, bytes, (file) => {
        assertEquals(file.tag().genre, TABLE_GENRE);
        assertEquals(file.properties().genre, [TABLE_GENRE]);
      });
      // The save rewrites the numeric atom as a string; the value must survive.
      const out = await savedBytes(backend, bytes);
      assertEquals(genreAtoms(out), [`${GEN}:${TABLE_GENRE}`]);
      await withFile(backend, out.slice(), (file) => {
        assertEquals(file.tag().genre, TABLE_GENRE);
      });
    });

    it("does not resurrect a ©gen TagLib dropped", async () => {
      // TagLib accepts a text atom only when its data box type word is 1
      // (parseText's expectedFlags); anything else is discarded at parse, and
      // the gnre table name is then the only genre in the file. Pinned here by
      // patching that word in memory — the rule is a single comparison in the
      // boundary probe, and nothing else in the suite can fail if it goes.
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES["before"]);
      const ilst = ilstAtom(bytes);
      assertExists(ilst);
      const gen = childAtoms(bytes, ilst.start + 8, ilst.end).find(
        (a) => a.name === GEN,
      );
      assertExists(gen);
      const typeWord = gen.start + 16;
      assertEquals(
        new DataView(bytes.buffer, bytes.byteOffset).getUint32(typeWord),
        1,
      );
      new DataView(bytes.buffer, bytes.byteOffset).setUint32(typeWord, 0);

      await withFile(backend, bytes, (file) => {
        assertEquals(file.tag().genre, TABLE_GENRE);
        assertEquals(file.properties().genre, [TABLE_GENRE]);
      });
      const out = await savedBytes(backend, bytes);
      assertEquals(genreAtoms(out), [`${GEN}:${TABLE_GENRE}`]);
    });
  });
}

describe("MP4 genre precedence parity", { ignore: SKIP }, () => {
  it("both backends write the same genre atoms for every fixture", async () => {
    for (const name of Object.keys(GNRE_GENRE_FIXTURES) as Fixture[]) {
      const bytes = await Deno.readFile(GNRE_GENRE_FIXTURES[name]);
      const written: Record<string, string[]> = {};
      for (const backend of BACKENDS) {
        written[backend] = genreAtoms(await savedBytes(backend, bytes));
      }
      assertEquals(
        written.wasi,
        written.emscripten,
        `${name}: WASI and Emscripten wrote different genre atoms`,
      );
    }
  });
});
