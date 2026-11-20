/**
 * @fileoverview Album grouping tests (2026-08-03 spec, testing section).
 *
 * groupAlbums is pure TypeScript — no wasm, no disk I/O. Each test defends a
 * contract from the spec: recognizer grammar, corroboration, fallback walk,
 * flat prefixes, disc assembly, mixed albums, invariants, singles,
 * compilation, error paths.
 */

import { describe, expect, it } from "vite-plus/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectDefined } from "./_assert-helpers.ts";
import type {
  AlbumDisc,
  AlbumGroup,
  AlbumGroupingResult,
  GroupAlbumsOptions,
} from "../src/folder-api/album-types.ts";
import { discFolderInfo } from "../src/folder-api/folder-disc.ts";
import { groupAlbums } from "../src/folder-api/album-grouping.ts";
import { scanForAlbums } from "../src/folder-api/index.ts";
import type { ExtendedTag, FolderScanItem } from "../src/folder-api/types.ts";

const ROOT = "/music";

/** Test-side tag seed: single-string convenience over ExtendedTag arrays. */
interface TagSeed {
  album?: string;
  albumArtist?: string;
  title?: string;
  discNumber?: number;
  totalDiscs?: number;
  track?: number;
  compilation?: boolean;
}

function toTags(seed: TagSeed): ExtendedTag {
  const tags: Record<string, unknown> = {};
  if (seed.album !== undefined) tags.album = [seed.album];
  if (seed.albumArtist !== undefined) tags.albumArtist = [seed.albumArtist];
  if (seed.title !== undefined) tags.title = [seed.title];
  if (seed.discNumber !== undefined) tags.discNumber = seed.discNumber;
  if (seed.totalDiscs !== undefined) tags.totalDiscs = seed.totalDiscs;
  if (seed.track !== undefined) tags.track = seed.track;
  if (seed.compilation !== undefined) tags.compilation = seed.compilation;
  return tags as ExtendedTag;
}

function okFile(path: string, tags: TagSeed = {}): FolderScanItem {
  return { status: "ok", path, tags: toTags(tags) };
}

function errorFile(path: string): FolderScanItem {
  return { status: "error", path, error: new Error("boom") };
}

/** Build a scan from [path, tags?] pairs. */
function makeScan(files: Array<[string, TagSeed?]>): {
  items: FolderScanItem[];
} {
  return {
    items: files.map(([path, tags]) => okFile(path, tags ?? {})),
  };
}

function group(
  files: Array<[string, TagSeed?]>,
  options?: GroupAlbumsOptions,
): AlbumGroupingResult {
  return groupAlbums(makeScan(files) as never, { scanRoot: ROOT, ...options });
}

function albumByTitle(result: AlbumGroupingResult, title: string): AlbumGroup {
  const found = result.albums.find((a) => a.album === title);
  expectDefined(
    found,
    `no album "${title}" in ${JSON.stringify(
      result.albums.map((a) => a.album),
    )}`,
  );
  return found;
}

function discOf(album: AlbumGroup, n: number | undefined): AlbumDisc {
  const found = album.discs.find((d) => d.discNumber === n);
  expectDefined(
    found,
    `no disc ${n} in ${JSON.stringify(album.discs.map((d) => d.discNumber))}`,
  );
  return found;
}

const R = (dir: string) => `${ROOT}/${dir}`;

// ---------------------------------------------------------------------------
// 1b. Standalone recognizer (discFolderInfo)
// ---------------------------------------------------------------------------

describe("discFolderInfo (standalone recognizer)", () => {
  it("classifies the grammar forms with base confidence", () => {
    expect(discFolderInfo("CD1")).toStrictEqual({
      kind: "exact",
      gated: false,
      number: 1,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      confidence: "high",
    });
    expect(discFolderInfo("Disc One")).toStrictEqual({
      kind: "exact",
      gated: false,
      number: 1,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      confidence: "low",
    });
    expect(discFolderInfo("Album (Disc 1)")).toStrictEqual({
      kind: "embedded",
      gated: false,
      number: 1,
      total: undefined,
      title: "Album",
      discTitle: undefined,
      confidence: "medium",
    });
    expect(discFolderInfo("Vol 2")).toStrictEqual({
      kind: "volume",
      gated: false,
      number: 2,
      total: undefined,
      title: undefined,
      discTitle: undefined,
      confidence: "medium",
    });
  });

  it("gates title-word markers and side letters", () => {
    const tape = discFolderInfo("Tape 4")!;
    expect(tape.gated).toStrictEqual(true);
    expect(tape.number).toStrictEqual(4);
    expect(tape.confidence).toStrictEqual("low");

    const side = discFolderInfo("Album (CD D)")!;
    expect(side.gated).toStrictEqual(true);
    expect(side.number).toStrictEqual(undefined);
    expect(side.kind).toStrictEqual("embedded");
    expect(side.title).toStrictEqual("Album");

    const sideA = discFolderInfo("CD A")!;
    expect(sideA.gated).toStrictEqual(true);
    expect(sideA.number).toStrictEqual(undefined);
  });

  it("returns undefined for non-disc names", () => {
    for (const name of [
      "Greatest Hits",
      "2001 A Space Odyssey",
      "CD",
      "Help 1",
      "Abcd1",
      "Scalp 1",
      "Extras",
      "Bonus",
    ]) {
      expect(discFolderInfo(name), name).toStrictEqual(undefined);
    }
  });

  it("markers need a right word boundary: record inside Recordings/Records is not a disc", () => {
    // 2026-08-04 report: five real folders under the Harry Smith anthology
    // ("Robert Johnson - The Complete Recordings (41 Tracks)", ...) parsed as
    // discs — "record" matched the first letters of "ings", and the
    // single-letter token consumed them.
    for (const name of [
      "Recordings 1",
      "Records",
      "Recorded",
      "The Complete Recordings (41 Tracks)",
      "Robert Johnson - The Complete Recordings (41 Tracks)",
      "Bukka White - The Vintage Recordings 1930 - 1940",
      "CD-ROM",
      "Discography 1",
      "Disco 1",
      // Marker-half guards: only these fail if the marker-level lookahead
      // alone is reverted (the side-letter token still matches at end/space).
      "CDs",
      "DVDs",
      "Vinyls",
      "LPs",
      // Token-branch guards: the roman and word alternatives of the token
      // lookahead (the side-letter branch is covered by CD-ROM above).
      "Disc IVB",
      "Disc Oner",
      // Roman plausibility: all-roman-letter words are titles, not numerals.
      "Disc Mic",
      "Disc Mix 1",
      "CD Mix 1",
    ]) {
      expect(discFolderInfo(name), name).toStrictEqual(undefined);
    }
  });

  it("roman numerals stay discs within a plausible bound", () => {
    expect(discFolderInfo("Disc IV")!.number).toStrictEqual(4);
    expect(discFolderInfo("Disc XII")!.number).toStrictEqual(12);
    expect(discFolderInfo("Disc L")!.gated).toStrictEqual(true); // single char: side label
  });

  it("record-marker siblings must not fold to the parent (anthology regression)", () => {
    const root = R("Harry Smith_'s Anthology of American Folk Music");
    const result = group([
      [
        `${root}/Robert Johnson - The Complete Recordings (41 Tracks)/track1.flac`,
      ],
      [
        `${root}/Robert Johnson - The Complete Recordings (41 Tracks)/track2.flac`,
      ],
      [`${root}/Bukka White - The Vintage Recordings 1930 - 1940/track1.flac`],
      [`${root}/Bukka White - The Vintage Recordings 1930 - 1940/track2.flac`],
    ]);
    // Each folder is its own album; nothing folds to the anthology root.
    expect(result.albums.length).toStrictEqual(2);
    for (const album of result.albums) {
      expect(album.directory).toStrictEqual(`${root}/${album.album}`);
    }
  });

  it("does not resolve to a parent — the caller decides", () => {
    // Standalone recognizer: no albumDir semantics. Tuneup's placeholder
    // path consumes this without inheriting resolve-to-parent. The folder
    // "Felbm - Tape 4" is an embedded form: title "Felbm", gated tape
    // marker, disc 4 — the library resolves it to the parent inside
    // groupAlbums, the standalone recognizer just reports the parse.
    const info = discFolderInfo("Felbm - Tape 4")!;
    expect(info.kind).toStrictEqual("embedded");
    expect(info.title).toStrictEqual("Felbm");
    expect(info.gated).toStrictEqual(true);
    expect(info.number).toStrictEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 1. Recognizer table (via groupAlbums)
// ---------------------------------------------------------------------------

describe("disc-folder recognizer (via groupAlbums)", () => {
  // A single "Artist/Album/DISC/" fixture: the disc folder is confirmed and
  // the album title comes from the parent.
  const exactForms: Array<[string, number]> = [
    ["CD1", 1],
    ["CD 01", 1],
    ["Disc-02", 2],
    ["Disc One", 1],
    ["Disc II", 2],
    ["DVD 1", 1],
    ["SACD 2", 2],
    ["CD1 - Bonus Tracks", 1],
    ["Disc 2 [Live]", 2],
    ["Vol 2", 2],
    ["Pt. 1", 1],
  ];
  for (const [dir, discNumber] of exactForms) {
    it(`${dir} is a disc folder with number ${discNumber}`, () => {
      const result = group([
        [R(`Album/${dir}/track1.flac`), { title: "A" }],
        [R(`Album/${dir}/track2.flac`), { title: "B" }],
      ]);
      const album = albumByTitle(result, "Album");
      expect(discOf(album, discNumber).items.length).toStrictEqual(2);
    });
  }

  it("Disc 2 [Remastered] carries the bracketed suffix as folderDiscTitle", () => {
    const result = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 2 [Remastered]/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    const disc2 = discOf(album, 2);
    expect(disc2.folderDiscTitle).toStrictEqual("Remastered");
  });

  it("negatives are not disc folders: Greatest Hits, 2001 A Space Odyssey, CD, Help 1, Abcd1, Scalp 1, Extras, Bonus", () => {
    for (const dir of [
      "Greatest Hits",
      "2001 A Space Odyssey",
      "CD",
      "Help 1",
      "Abcd1",
      "Scalp 1",
      "Extras",
      "Bonus",
    ]) {
      const result = group([
        [R(`${dir}/track1.flac`), { album: "X" }],
        [R(`${dir}/track2.flac`), { album: "X" }],
      ]);
      const album = albumByTitle(result, "X");
      // No disc evidence: the files sit in one undefined-number disc.
      expect(
        album.discs.length,
        `${dir} must not create disc evidence`,
      ).toStrictEqual(1);
      expect(album.discs[0].discNumber).toStrictEqual(undefined);
      expect(album.discs[0].folderDiscNumber).toStrictEqual(undefined);
    }
  });

  it("CD 1 of 2 parses the of-N total", () => {
    const result = group([
      [R("Album/CD 1 of 2/track1.flac")],
      [R("Album/CD 2 of 2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(discOf(album, 1).totalDiscs).toStrictEqual(2);
  });

  it("title-word markers are gated: lone 'Tape 4' is an album title, not a disc", () => {
    // Sleep/Felbm "Tape 4" regression (2026-08-04 feedback): the release is
    // titled "Tape 4"; it must NOT resolve up to its parent as disc 4.
    const result = group([
      [R("Artist/Felbm - Tape 4/track1.flac")],
      [R("Artist/Felbm - Tape 4/track2.flac")],
    ]);
    const album = albumByTitle(result, "Felbm - Tape 4");
    expect(album.directory).toStrictEqual(R("Artist/Felbm - Tape 4"));
    expect(album.discs.length).toStrictEqual(1);
    expect(album.discs[0].discNumber).toStrictEqual(undefined);
  });

  it("gated marker siblings still fold: Tape 1 + Tape 2", () => {
    const result = group([
      [R("Album/Tape 1/track1.flac")],
      [R("Album/Tape 2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.length).toStrictEqual(2);
    expect(discOf(album, 1).confidence).toStrictEqual("low");
  });

  it("gated vinyl and LP siblings fold; lone vinyl does not", () => {
    const lone = group([
      [R("Artist/Vinyl 1/track1.flac")],
      [R("Artist/Vinyl 1/track2.flac")],
    ]);
    expect(albumByTitle(lone, "Vinyl 1").discs.length).toStrictEqual(1);

    const pair = group([
      [R("Album/Vinyl 1/track1.flac")],
      [R("Album/Vinyl 2/track1.flac")],
    ]);
    expect(albumByTitle(pair, "Album").discs.length).toStrictEqual(2);

    const lpPair = group([
      [R("Album/LP 1/track1.flac")],
      [R("Album/LP 2/track1.flac")],
    ]);
    expect(albumByTitle(lpPair, "Album").discs.length).toStrictEqual(2);
  });

  it("single-letter tokens are gated: lone 'Album (CD D)' is not a disc", () => {
    // 2026-08-04 feedback: a letter-labeled folder ("CD D" side label) must
    // not promote to a disc without a sibling. Previously D parsed as roman
    // 500, resolving the folder to its parent.
    const result = group([
      [R("Artist/Album (CD D)/track1.flac")],
      [R("Artist/Album (CD D)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album (CD D)");
    expect(album.discs.length).toStrictEqual(1);
    expect(album.discs[0].discNumber).toStrictEqual(undefined);
    expect(album.directory).toStrictEqual(R("Artist/Album (CD D)"));
  });

  it("side-letter siblings corroborate each other: (CD D) + (CD E) fold", () => {
    const result = group([
      [R("Artist/Album (CD D)/track1.flac")],
      [R("Artist/Album (CD E)/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.length).toStrictEqual(2);
    expect(album.discs[0].discNumber).toStrictEqual(undefined);
    expect(album.discs[1].discNumber).toStrictEqual(undefined);
  });

  it("multi-letter roman numerals stay unconditional: Disc II is disc 2", () => {
    const result = group([
      [R("Album/Disc II/track1.flac")],
      [R("Album/Disc III/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.map((d) => d.discNumber)).toStrictEqual([2, 3]);
  });
});

// ---------------------------------------------------------------------------
// 2. Corroboration
// ---------------------------------------------------------------------------

describe("sibling corroboration", () => {
  it("lone embedded disc folder is a disc at medium confidence", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac")],
      [R("Album (Disc 1)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(discOf(album, 1).confidence).toStrictEqual("medium");
  });

  it("embedded pair with a common prefix corroborates to high", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac")],
      [R("Album (Disc 2)/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(discOf(album, 1).confidence).toStrictEqual("high");
    expect(discOf(album, 2).confidence).toStrictEqual("high");
  });

  it("embedded folders with divergent prefixes do not collapse", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac")],
      [R("Album (Disc 1)/track2.flac")],
      [R("Other (Disc 2)/track1.flac")],
      [R("Other (Disc 2)/track2.flac")],
    ]);
    expect(result.albums.length).toStrictEqual(2);
  });

  it("a lone bare number is not a disc folder (cannot confirm itself)", () => {
    const result = group([
      [R("Album/1/track1.flac"), { album: "X" }],
      [R("Album/1/track2.flac"), { album: "X" }],
    ]);
    // "1" at medium-less confidence is not confirmed: files stay in one disc.
    const album = albumByTitle(result, "X");
    expect(album.discs.length).toStrictEqual(1);
    expect(album.discs[0].folderDiscNumber).toStrictEqual(undefined);
  });

  it("bare numbers 1 and 2 as a set confirm each other", () => {
    const result = group([
      [R("Album/1/track1.flac")],
      [R("Album/2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.length).toStrictEqual(2);
    expect(album.discs.map((d) => d.discNumber)).toStrictEqual([1, 2]);
  });

  it("Bonus Disc alone is not a disc; with numbered siblings it is", () => {
    const alone = group([
      [R("Album/Bonus Disc/track1.flac"), { album: "X" }],
      [R("Album/Bonus Disc/track2.flac"), { album: "X" }],
    ]);
    expect(albumByTitle(alone, "X").discs.length).toStrictEqual(1);

    const withSiblings = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 2/track1.flac")],
      [R("Album/Bonus Disc/track1.flac")],
    ]);
    const album = albumByTitle(withSiblings, "Album");
    expect(album.discs.length).toStrictEqual(3);
    expect(discOf(album, 1).items.length).toStrictEqual(1);
  });

  it("Volume 1 + Volume 2 confirm each other by sibling numbering", () => {
    const result = group([
      [R("Album/Volume 1/track1.flac")],
      [R("Album/Volume 2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.map((d) => d.discNumber)).toStrictEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// 3. Fallback walk
// ---------------------------------------------------------------------------

describe("folder fallback walk (untagged)", () => {
  it("CD1/ at the scan root, untagged, is unmatched", () => {
    const result = group([[R("CD1/track1.flac")]], { scanRoot: ROOT });
    expect(result.albums.length).toStrictEqual(0);
    expect(result.unmatched.length).toStrictEqual(1);
    expect(result.unmatched[0].path).toStrictEqual(R("CD1/track1.flac"));
  });

  it("Artist/Album/CD1/ resolves to album Artist's 'Album', disc 1", () => {
    const result = group([
      [R("Artist/Album/CD1/track1.flac")],
      [R("Artist/Album/CD1/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.source).toStrictEqual("folder");
    expect(album.directory).toStrictEqual(R("Artist/Album"));
    expect(discOf(album, 1).items.length).toStrictEqual(2);
    expect(discOf(album, 1).items[0].albumDir).toStrictEqual(R("Artist/Album"));
  });

  it("Album (Disc 1)/ yields album 'Album'", () => {
    const result = group([
      [R("Artist/Album (Disc 1)/track1.flac")],
      [R("Artist/Album (Disc 1)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.directory).toStrictEqual(R("Artist"));
  });

  it("sibling embedded folders under one parent collapse into one album", () => {
    const result = group([
      [R("Artist/Album (Disc 1)/track1.flac")],
      [R("Artist/Album (Disc 2)/track1.flac")],
    ]);
    expect(result.albums.length).toStrictEqual(1);
    expect(albumByTitle(result, "Album").discs.length).toStrictEqual(2);
  });

  it("embedded folders under different parents stay separate", () => {
    const result = group([
      [R("Artist A/Album (Disc 1)/track1.flac")],
      [R("Artist A/Album (Disc 1)/track2.flac")],
      [R("Artist B/Album (Disc 1)/track1.flac")],
      [R("Artist B/Album (Disc 1)/track2.flac")],
    ]);
    expect(result.albums.length).toStrictEqual(2);
  });

  it("single album folder names the group after the root folder (beets)", () => {
    const result = group([
      [R("Greatest Hits/track1.flac")],
      [R("Greatest Hits/track2.flac")],
    ]);
    const album = albumByTitle(result, "Greatest Hits");
    expect(album.source).toStrictEqual("folder");
  });

  it("folderFallback: false leaves untagged files unmatched", () => {
    const result = group([[R("Album/track1.flac")]], { folderFallback: false });
    expect(result.albums.length).toStrictEqual(0);
    expect(result.unmatched.length).toStrictEqual(1);
  });

  it("mixed tagged/untagged Album (Disc 1)/ merges into the tag-keyed group", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac"), { album: "Album", albumArtist: "VA" }],
      [R("Album (Disc 1)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.source).toStrictEqual("tags");
    expect(album.items.length).toStrictEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Flat filename prefixes
// ---------------------------------------------------------------------------

describe("flat filename prefixes", () => {
  it("1-01 / 2-01 split into two discs", () => {
    const result = group([
      [R("Album/1-01 A.flac"), { album: "Album" }],
      [R("Album/2-01 B.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.map((d) => d.discNumber)).toStrictEqual([1, 2]);
  });

  it("101 / 201 split; 101 + 102 stay one disc", () => {
    const split = group([
      [R("Album/101 A.flac"), { album: "Album" }],
      [R("Album/201 B.flac"), { album: "Album" }],
    ]);
    expect(albumByTitle(split, "Album").discs.length).toStrictEqual(2);

    const one = group([
      [R("Album/101 A.flac"), { album: "Album" }],
      [R("Album/102 B.flac"), { album: "Album" }],
    ]);
    expect(albumByTitle(one, "Album").discs.length).toStrictEqual(1);

    // Disc 3 from an array position cannot be derived when only two discs are
    // present (3 > distinct.length): the parser's guess is not plausible, so
    // the folder stays ONE disc instead of being subdivided.
    const outOfRange = group([
      [R("Album/101 A.flac"), { album: "Album" }],
      [R("Album/301 B.flac"), { album: "Album" }],
    ]);
    expect(albumByTitle(outOfRange, "Album").discs.length).toStrictEqual(1);
  });

  it("10-01 / 11-01 split (separated forms are explicit)", () => {
    const result = group([
      [R("Album/10-01 A.flac"), { album: "Album" }],
      [R("Album/11-01 B.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.map((d) => d.discNumber)).toStrictEqual([10, 11]);
  });

  it("01-01 and 1-01 are the same disc", () => {
    const result = group([
      [R("Album/01-01 A.flac"), { album: "Album" }],
      [R("Album/1-02 B.flac"), { album: "Album" }],
    ]);
    expect(albumByTitle(result, "Album").discs.length).toStrictEqual(1);
  });

  it("a prefix-less file in a subdivided folder joins the lowest disc", () => {
    const result = group([
      [R("Album/1-01 A.flac"), { album: "Album" }],
      [R("Album/2-01 B.flac"), { album: "Album" }],
      [R("Album/00 - Intro.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    expect(discOf(album, 1).items.length).toStrictEqual(2);
    expect(discOf(album, 2).items.length).toStrictEqual(1);
  });

  it("a single-prefix folder stays one disc", () => {
    const result = group([
      [R("Album/1-01 A.flac"), { album: "Album" }],
      [R("Album/1-02 B.flac"), { album: "Album" }],
    ]);
    expect(albumByTitle(result, "Album").discs.length).toStrictEqual(1);
  });

  it("flatDiscPrefixes: false disables subdivision", () => {
    const result = group(
      [
        [R("Album/1-01 A.flac"), { album: "Album" }],
        [R("Album/2-01 B.flac"), { album: "Album" }],
      ],
      { flatDiscPrefixes: false },
    );
    expect(albumByTitle(result, "Album").discs.length).toStrictEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Disc assembly
// ---------------------------------------------------------------------------

describe("disc assembly", () => {
  it("tag discNumber wins over the folder; both are exposed", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac"), { album: "Album", discNumber: 3 }],
      [R("Album/Disc 2/track2.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    const disc = discOf(album, 3);
    expect(disc.tagDiscNumber).toStrictEqual(3);
    expect(disc.folderDiscNumber).toStrictEqual(2);
    expect(disc.items[0].discNumber).toStrictEqual(3);
    expect(disc.items[0].albumDir).toStrictEqual(R("Album"));
  });

  it("folder number is the fallback when tags are absent", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac")],
      [R("Album/Disc 2/track2.flac")],
    ]);
    const disc = discOf(albumByTitle(result, "Album"), 2);
    expect(disc.tagDiscNumber).toStrictEqual(undefined);
    expect(disc.folderDiscNumber).toStrictEqual(2);
  });

  it("conflicting tag disc numbers fall back to the folder", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac"), { album: "Album", discNumber: 1 }],
      [R("Album/Disc 2/track2.flac"), { album: "Album", discNumber: 3 }],
    ]);
    const disc = discOf(albumByTitle(result, "Album"), 2);
    expect(disc.tagDiscNumber).toStrictEqual(undefined);
  });

  it("folders with matching tag disc numbers merge even when folder numbers differ", () => {
    const result = group([
      [R("Box/Disc 1/track1.flac"), { album: "X", discNumber: 1 }],
      [R("Box/Disc 3/track1.flac"), { album: "X", discNumber: 1 }],
    ]);
    const album = albumByTitle(result, "X");
    expect(album.discs.length).toStrictEqual(1);
    expect(discOf(album, 1).items.length).toStrictEqual(2);
  });

  it("Disc 1 and Disc 1 (Bonus) merge into one disc", () => {
    const result = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 1 (Bonus)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.length).toStrictEqual(1);
    expect(discOf(album, 1).items.length).toStrictEqual(2);
  });

  it("minFolderConfidence: high drops a lone embedded disc folder", () => {
    const result = group(
      [[R("Album (Disc 1)/track1.flac")], [R("Album (Disc 1)/track2.flac")]],
      {
        minFolderConfidence: "high",
      },
    );
    // The folder is no longer a disc: it becomes a plain folder album.
    const album = albumByTitle(result, "Album (Disc 1)");
    expect(album.discs[0].discNumber).toStrictEqual(undefined);
  });

  it("totalDiscs chain: tag total wins, then of-N, then max sibling", () => {
    const tagged = group([
      [R("Album/Disc 1/track1.flac"), { album: "Album", totalDiscs: 2 }],
      [R("Album/Disc 2/track1.flac"), { album: "Album", totalDiscs: 2 }],
    ]);
    expect(discOf(albumByTitle(tagged, "Album"), 1).totalDiscs).toStrictEqual(
      2,
    );

    const ofN = group([
      [R("Album/CD 1 of 3/track1.flac")],
      [R("Album/CD 2 of 3/track1.flac")],
    ]);
    expect(discOf(albumByTitle(ofN, "Album"), 1).totalDiscs).toStrictEqual(3);

    const maxSibling = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 3/track1.flac")],
    ]);
    expect(
      discOf(albumByTitle(maxSibling, "Album"), 1).totalDiscs,
    ).toStrictEqual(3);
  });

  it("files without disc evidence join the lowest-numbered disc", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac")],
      [R("Album/Disc 3/track1.flac")],
      [R("Album/loose.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(discOf(album, 2).items.length).toStrictEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Nested / flattened triggers
// ---------------------------------------------------------------------------

describe("nested and flattened triggers", () => {
  it("audio-less parent whose disc children share a prefix collapses", () => {
    const result = group([
      [R("Artist/Album/CD1/track1.flac")],
      [R("Artist/Album/CD2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    expect(album.discs.length).toStrictEqual(2);
    expect(album.directory).toStrictEqual(R("Artist/Album"));
  });

  it("a directory whose own name parses as a disc folder carries evidence into its parent context", () => {
    const result = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    // track1 disc 1; track2 has no evidence -> joins disc 1.
    expect(discOf(album, 1).items.length).toStrictEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 7. Mixed albums
// ---------------------------------------------------------------------------

describe("mixed albums", () => {
  it("one folder, two album tags -> separate groups, disc evidence attaches to both", () => {
    const result = group([
      [R("Box/Disc 1/track1.flac"), { album: "Album A" }],
      [R("Box/Disc 1/track2.flac"), { album: "Album A" }],
      [R("Box/Disc 1/track3.flac"), { album: "Album B" }],
      [R("Box/Disc 1/track4.flac"), { album: "Album B" }],
    ]);
    expect(result.albums.length).toStrictEqual(2);
    const a = albumByTitle(result, "Album A");
    const b = albumByTitle(result, "Album B");
    expect(discOf(a, 1).items.length).toStrictEqual(2);
    expect(discOf(b, 1).items.length).toStrictEqual(2);
    expect(a.items[0].albumDir).toStrictEqual(R("Box"));
    expect(b.items[0].albumDir).toStrictEqual(R("Box"));
  });

  it("generic album artist folds into an album-only key", () => {
    const result = group([
      [R("Comp/1-01.flac"), { album: "Hits", albumArtist: "Various Artists" }],
      [R("Comp/1-02.flac"), { album: "hits", albumArtist: "VA" }],
    ]);
    expect(result.albums.length).toStrictEqual(1);
    const album = albumByTitle(result, "Hits");
    expect(album.albumArtist).toStrictEqual(undefined);
    expect(album.items.length).toStrictEqual(2);
  });

  it("tagged and untagged files across sibling disc folders collapse into one album", () => {
    const result = group([
      [R("Psychocandy/CD1/01 - A.flac")],
      [R("Psychocandy/CD1/02 - B.flac")],
      [R("Psychocandy/CD2/06 - C.flac"), { album: "Psychocandy" }],
      [R("Psychocandy/CD2/07 - D.flac"), { album: "Psychocandy" }],
    ]);
    expect(result.albums.length).toStrictEqual(1);
    const album = albumByTitle(result, "Psychocandy");
    expect(album.source).toStrictEqual("tags");
    expect(album.items.length).toStrictEqual(4);
    expect(album.discs.length).toStrictEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 8. Invariants
// ---------------------------------------------------------------------------

describe("invariants", () => {
  const FIXTURES: Array<[string, Array<[string, TagSeed?]>]> = [
    ["empty", []],
    [
      "discs+flat+untagged",
      [
        [
          R("Artist/Album/Disc 1/track1.flac"),
          {
            album: "Album",
            discNumber: 1,
          },
        ],
        [R("Artist/Album/Disc 2/track2.flac"), { album: "Album" }],
        [R("Flat/1-01 A.flac"), { album: "Flat" }],
        [R("Flat/2-01 B.flac"), { album: "Flat" }],
        [R("Untagged/CD1/track1.flac")],
        [R("Untagged/CD2/track1.flac")],
      ],
    ],
    [
      "singles+errors",
      [
        [R("Single/track1.flac"), { album: "Solo" }],
        [R("Album/track1.flac"), { album: "Album" }],
        [R("Album/track2.flac"), { album: "Album" }],
      ],
    ],
  ];

  for (const [name, files] of FIXTURES) {
    it(`${name}: partition invariant (exactly once; errors disjoint)`, () => {
      const items = makeScan(files).items as never[];
      const withErrors = [...items, errorFile("/music/broken.flac")] as never[];
      const result = groupAlbums({ items: withErrors } as never, {
        scanRoot: ROOT,
      });

      const okPaths = new Set(
        (items as Array<{ path: string }>).map((i) => i.path),
      );
      const seen = new Set<string>();
      for (const album of result.albums) {
        for (const item of album.items) {
          expect(
            okPaths.has(item.path),
            `album item ${item.path} not in input`,
          ).toBeTruthy();
          expect(
            !seen.has(item.path),
            `duplicate ${item.path} in albums`,
          ).toBeTruthy();
          seen.add(item.path);
        }
        expect(album.discs.length >= 1, `${name}: discs >= 1`).toBeTruthy();
        for (const disc of album.discs) {
          expect(disc.items.length >= 1, `${name}: items >= 1`).toBeTruthy();
          for (const item of disc.items) {
            expect(
              item.discNumber,
              `${name}: item.discNumber must match its disc`,
            ).toStrictEqual(disc.discNumber);
            expect(
              item.albumDir,
              `${name}: item.albumDir must be consistent within a disc`,
            ).toStrictEqual(disc.items[0].albumDir);
          }
        }
      }
      for (const item of result.singles) {
        expect(
          !seen.has(item.path),
          `duplicate ${item.path} in singles`,
        ).toBeTruthy();
        seen.add(item.path);
      }
      for (const item of result.unmatched) {
        expect(
          !seen.has(item.path),
          `duplicate ${item.path} in unmatched`,
        ).toBeTruthy();
        seen.add(item.path);
      }
      expect(seen.size, `${name}: partition covers all ok items`).toStrictEqual(
        okPaths.size,
      );
      for (const err of result.errors) {
        expect(err.path).toStrictEqual("/music/broken.flac");
      }
    });
  }

  it("key is stable across identical input", () => {
    const files: Array<[string, TagSeed?]> = [
      [R("Artist/Album/Disc 1/track1.flac"), { album: "Album" }],
      [R("Artist/Album/Disc 2/track2.flac"), { album: "Album" }],
      [R("Solo/track1.flac")],
    ];
    const a = group(files);
    const b = group(files);
    expect(a.albums.map((x) => x.key)).toStrictEqual(
      b.albums.map((x) => x.key),
    );
  });

  it("no 1-item AlbumGroup; singles holds exactly those files", () => {
    const result = group([
      [R("Single/track1.flac"), { album: "Solo" }],
      [R("Album/track1.flac"), { album: "Album" }],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    for (const album of result.albums) {
      expect(album.items.length >= 2).toBeTruthy();
    }
    expect(result.singles.length).toStrictEqual(1);
    expect(result.singles[0].path).toStrictEqual(R("Single/track1.flac"));
  });

  it("empty input returns empty collections", () => {
    const result = group([]);
    expect(result.albums.length).toStrictEqual(0);
    expect(result.singles.length).toStrictEqual(0);
    expect(result.unmatched.length).toStrictEqual(0);
    expect(result.errors.length).toStrictEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Error paths
// ---------------------------------------------------------------------------

describe("error paths", () => {
  it("input error items map to errors and never enter groups", () => {
    const result = groupAlbums(
      {
        items: [
          okFile(R("Album/track1.flac"), { album: "Album" }),
          okFile(R("Album/track2.flac"), { album: "Album" }),
          errorFile(R("Album/broken.flac")),
        ],
      } as never,
      { scanRoot: ROOT },
    );
    expect(result.errors.length).toStrictEqual(1);
    expect(result.errors[0].path).toStrictEqual(R("Album/broken.flac"));
    expect(result.errors[0].error.message).toStrictEqual("boom");
    expect(albumByTitle(result, "Album").items.length).toStrictEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 10. Integration: scanForAlbums over a real fixture tree
// ---------------------------------------------------------------------------

describe("scanForAlbums integration", () => {
  it("scans a disc-folder tree into one album with two discs", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "taglib-"));
    try {
      // Pass the URL, not .pathname: on Windows the URL pathname is
      // "/D:/a/..." — a root-relative path that readFile cannot resolve
      // (os error 3). Node's fs APIs accept file:// URL objects on all platforms.
      const mp3Data = new Uint8Array(
        await readFile(
          new URL("test-files/mp3/kiss-snippet.mp3", import.meta.url),
        ),
      );
      const mk = async (rel: string) => {
        const full = `${tempDir}/${rel}`;
        await mkdir(`${tempDir}/${rel.slice(0, rel.lastIndexOf("/"))}`, {
          recursive: true,
        });
        await writeFile(full, mp3Data);
        return full;
      };
      const disc1 = await mk("Artist/Album/Disc 1/01 - A.mp3");
      const disc2 = await mk("Artist/Album/Disc 2/02 - B.mp3");
      const loose = await mk("Artist/Album/03 - C.mp3");

      const result = await scanForAlbums(tempDir, { recursive: true });

      expect(result.errors.length, JSON.stringify(result.errors)).toStrictEqual(
        0,
      );
      expect(result.albums.length).toStrictEqual(1);
      const album = result.albums[0];
      // The fixture's tag is "Parade - ..." — tags are authority, so all
      // three copies group under it despite the folder name.
      expect(album.items.length).toStrictEqual(3);
      expect(album.discs.length).toStrictEqual(2);
      const disc1Files = album.discs.find((d) => d.discNumber === 1)!.items;
      const disc2Files = album.discs.find((d) => d.discNumber === 2)!.items;
      expect(disc1Files.length).toStrictEqual(2); // disc 1 file + loose file joins lowest
      expect(disc2Files.length).toStrictEqual(1);
      expect(disc1Files.find((i) => i.path === disc1)?.albumDir).toStrictEqual(
        `${tempDir}/Artist/Album`,
      );
      expect(disc2Files[0].albumDir).toStrictEqual(`${tempDir}/Artist/Album`);
      expect(disc1Files.find((i) => i.path === loose)?.albumDir).toStrictEqual(
        `${tempDir}/Artist/Album`,
      );
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});

describe("singles", () => {
  it("a 1-file tag-keyed group is a single, not an album", () => {
    const result = group([[R("Solo/track1.flac"), { album: "Solo" }]]);
    expect(result.albums.length).toStrictEqual(0);
    expect(result.singles.length).toStrictEqual(1);
  });

  it("a 2-file group never splits into singles", () => {
    const result = group([
      [R("Album/track1.flac"), { album: "Album" }],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    expect(result.albums.length).toStrictEqual(1);
    expect(result.singles.length).toStrictEqual(0);
  });

  it("untagged single-file directory is a single", () => {
    const result = group([[R("Solo/track1.flac")]]);
    expect(result.albums.length).toStrictEqual(0);
    expect(result.singles.length).toStrictEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 12. Compilation
// ---------------------------------------------------------------------------

describe("compilation flag", () => {
  it("all-set -> true; all-unset -> false; mixed -> undefined", () => {
    const yes = group([
      [R("Album/track1.flac"), { album: "Album", compilation: true }],
      [R("Album/track2.flac"), { album: "Album", compilation: true }],
    ]);
    expect(albumByTitle(yes, "Album").compilation).toStrictEqual(true);

    const no = group([
      [R("Album/track1.flac"), { album: "Album", compilation: false }],
      [R("Album/track2.flac"), { album: "Album", compilation: false }],
    ]);
    expect(albumByTitle(no, "Album").compilation).toStrictEqual(false);

    const mixed = group([
      [R("Album/track1.flac"), { album: "Album", compilation: true }],
      [R("Album/track2.flac"), { album: "Album", compilation: false }],
    ]);
    expect(albumByTitle(mixed, "Album").compilation).toStrictEqual(undefined);

    const absent = group([
      [R("Album/track1.flac"), { album: "Album" }],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    expect(albumByTitle(absent, "Album").compilation).toStrictEqual(undefined);
  });
});
