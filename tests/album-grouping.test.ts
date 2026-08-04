/**
 * @fileoverview Album grouping tests (2026-08-03 spec, testing section).
 *
 * groupAlbums is pure TypeScript — no wasm, no disk I/O. Each test defends a
 * contract from the spec: recognizer grammar, corroboration, fallback walk,
 * flat prefixes, disc assembly, mixed albums, invariants, singles,
 * compilation, error paths.
 */

import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type AlbumDisc,
  type AlbumGroup,
  type AlbumGroupingResult,
  groupAlbums,
  type GroupAlbumsOptions,
} from "../src/folder-api/group-albums.ts";
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

function albumByTitle(
  result: AlbumGroupingResult,
  title: string,
): AlbumGroup {
  const found = result.albums.find((a) => a.album === title);
  assert(
    found,
    `no album "${title}" in ${
      JSON.stringify(result.albums.map((a) => a.album))
    }`,
  );
  return found;
}

function discOf(album: AlbumGroup, n: number | undefined): AlbumDisc {
  const found = album.discs.find((d) => d.discNumber === n);
  assert(
    found,
    `no disc ${n} in ${JSON.stringify(album.discs.map((d) => d.discNumber))}`,
  );
  return found;
}

const R = (dir: string) => `${ROOT}/${dir}`;

// ---------------------------------------------------------------------------
// 1. Recognizer table
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
      assertEquals(discOf(album, discNumber).items.length, 2);
    });
  }

  it("Disc 2 [Remastered] carries the bracketed suffix as folderDiscTitle", () => {
    const result = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 2 [Remastered]/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    const disc2 = discOf(album, 2);
    assertEquals(disc2.folderDiscTitle, "Remastered");
  });

  it("negatives are not disc folders: Greatest Hits, 2001 A Space Odyssey, CD, Help 1, Abcd1, Scalp 1, Extras, Bonus", () => {
    for (
      const dir of [
        "Greatest Hits",
        "2001 A Space Odyssey",
        "CD",
        "Help 1",
        "Abcd1",
        "Scalp 1",
        "Extras",
        "Bonus",
      ]
    ) {
      const result = group([
        [R(`${dir}/track1.flac`), { album: "X" }],
        [R(`${dir}/track2.flac`), { album: "X" }],
      ]);
      const album = albumByTitle(result, "X");
      // No disc evidence: the files sit in one undefined-number disc.
      assertEquals(
        album.discs.length,
        1,
        `${dir} must not create disc evidence`,
      );
      assertEquals(album.discs[0].discNumber, undefined);
      assertEquals(album.discs[0].folderDiscNumber, undefined);
    }
  });

  it("CD 1 of 2 parses the of-N total", () => {
    const result = group([
      [R("Album/CD 1 of 2/track1.flac")],
      [R("Album/CD 2 of 2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(discOf(album, 1).totalDiscs, 2);
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
    assertEquals(discOf(album, 1).confidence, "medium");
  });

  it("embedded pair with a common prefix corroborates to high", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac")],
      [R("Album (Disc 2)/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(discOf(album, 1).confidence, "high");
    assertEquals(discOf(album, 2).confidence, "high");
  });

  it("embedded folders with divergent prefixes do not collapse", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac")],
      [R("Album (Disc 1)/track2.flac")],
      [R("Other (Disc 2)/track1.flac")],
      [R("Other (Disc 2)/track2.flac")],
    ]);
    assertEquals(result.albums.length, 2);
  });

  it("a lone bare number is not a disc folder (cannot confirm itself)", () => {
    const result = group([
      [R("Album/1/track1.flac"), { album: "X" }],
      [R("Album/1/track2.flac"), { album: "X" }],
    ]);
    // "1" at medium-less confidence is not confirmed: files stay in one disc.
    const album = albumByTitle(result, "X");
    assertEquals(album.discs.length, 1);
    assertEquals(album.discs[0].folderDiscNumber, undefined);
  });

  it("bare numbers 1 and 2 as a set confirm each other", () => {
    const result = group([
      [R("Album/1/track1.flac")],
      [R("Album/2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.discs.length, 2);
    assertEquals(album.discs.map((d) => d.discNumber), [1, 2]);
  });

  it("Bonus Disc alone is not a disc; with numbered siblings it is", () => {
    const alone = group([
      [R("Album/Bonus Disc/track1.flac"), { album: "X" }],
      [R("Album/Bonus Disc/track2.flac"), { album: "X" }],
    ]);
    assertEquals(albumByTitle(alone, "X").discs.length, 1);

    const withSiblings = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 2/track1.flac")],
      [R("Album/Bonus Disc/track1.flac")],
    ]);
    const album = albumByTitle(withSiblings, "Album");
    assertEquals(album.discs.length, 3);
    assertEquals(discOf(album, 1).items.length, 1);
  });

  it("Volume 1 + Volume 2 confirm each other by sibling numbering", () => {
    const result = group([
      [R("Album/Volume 1/track1.flac")],
      [R("Album/Volume 2/track1.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.discs.map((d) => d.discNumber), [1, 2]);
  });
});

// ---------------------------------------------------------------------------
// 3. Fallback walk
// ---------------------------------------------------------------------------

describe("folder fallback walk (untagged)", () => {
  it("CD1/ at the scan root, untagged, is unmatched", () => {
    const result = group(
      [[R("CD1/track1.flac")]],
      { scanRoot: ROOT },
    );
    assertEquals(result.albums.length, 0);
    assertEquals(result.unmatched.length, 1);
    assertEquals(result.unmatched[0].path, R("CD1/track1.flac"));
  });

  it("Artist/Album/CD1/ resolves to album Artist's 'Album', disc 1", () => {
    const result = group([
      [R("Artist/Album/CD1/track1.flac")],
      [R("Artist/Album/CD1/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.source, "folder");
    assertEquals(album.directory, R("Artist/Album"));
    assertEquals(discOf(album, 1).items.length, 2);
    assertEquals(discOf(album, 1).items[0].albumDir, R("Artist/Album"));
  });

  it("Album (Disc 1)/ yields album 'Album'", () => {
    const result = group([
      [R("Artist/Album (Disc 1)/track1.flac")],
      [R("Artist/Album (Disc 1)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.directory, R("Artist"));
  });

  it("sibling embedded folders under one parent collapse into one album", () => {
    const result = group([
      [R("Artist/Album (Disc 1)/track1.flac")],
      [R("Artist/Album (Disc 2)/track1.flac")],
    ]);
    assertEquals(result.albums.length, 1);
    assertEquals(albumByTitle(result, "Album").discs.length, 2);
  });

  it("embedded folders under different parents stay separate", () => {
    const result = group([
      [R("Artist A/Album (Disc 1)/track1.flac")],
      [R("Artist A/Album (Disc 1)/track2.flac")],
      [R("Artist B/Album (Disc 1)/track1.flac")],
      [R("Artist B/Album (Disc 1)/track2.flac")],
    ]);
    assertEquals(result.albums.length, 2);
  });

  it("single album folder names the group after the root folder (beets)", () => {
    const result = group([
      [R("Greatest Hits/track1.flac")],
      [R("Greatest Hits/track2.flac")],
    ]);
    const album = albumByTitle(result, "Greatest Hits");
    assertEquals(album.source, "folder");
  });

  it("folderFallback: false leaves untagged files unmatched", () => {
    const result = group([[R("Album/track1.flac")]], { folderFallback: false });
    assertEquals(result.albums.length, 0);
    assertEquals(result.unmatched.length, 1);
  });

  it("mixed tagged/untagged Album (Disc 1)/ merges into the tag-keyed group", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac"), { album: "Album", albumArtist: "VA" }],
      [R("Album (Disc 1)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.source, "tags");
    assertEquals(album.items.length, 2);
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
    assertEquals(album.discs.map((d) => d.discNumber), [1, 2]);
  });

  it("101 / 201 split; 101 + 102 stay one disc", () => {
    const split = group([
      [R("Album/101 A.flac"), { album: "Album" }],
      [R("Album/201 B.flac"), { album: "Album" }],
    ]);
    assertEquals(albumByTitle(split, "Album").discs.length, 2);

    const one = group([
      [R("Album/101 A.flac"), { album: "Album" }],
      [R("Album/102 B.flac"), { album: "Album" }],
    ]);
    assertEquals(albumByTitle(one, "Album").discs.length, 1);
  });

  it("10-01 / 11-01 split (separated forms are explicit)", () => {
    const result = group([
      [R("Album/10-01 A.flac"), { album: "Album" }],
      [R("Album/11-01 B.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.discs.map((d) => d.discNumber), [10, 11]);
  });

  it("01-01 and 1-01 are the same disc", () => {
    const result = group([
      [R("Album/01-01 A.flac"), { album: "Album" }],
      [R("Album/1-02 B.flac"), { album: "Album" }],
    ]);
    assertEquals(albumByTitle(result, "Album").discs.length, 1);
  });

  it("a prefix-less file in a subdivided folder joins the lowest disc", () => {
    const result = group([
      [R("Album/1-01 A.flac"), { album: "Album" }],
      [R("Album/2-01 B.flac"), { album: "Album" }],
      [R("Album/00 - Intro.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(discOf(album, 1).items.length, 2);
    assertEquals(discOf(album, 2).items.length, 1);
  });

  it("a single-prefix folder stays one disc", () => {
    const result = group([
      [R("Album/1-01 A.flac"), { album: "Album" }],
      [R("Album/1-02 B.flac"), { album: "Album" }],
    ]);
    assertEquals(albumByTitle(result, "Album").discs.length, 1);
  });

  it("flatDiscPrefixes: false disables subdivision", () => {
    const result = group(
      [
        [R("Album/1-01 A.flac"), { album: "Album" }],
        [R("Album/2-01 B.flac"), { album: "Album" }],
      ],
      { flatDiscPrefixes: false },
    );
    assertEquals(albumByTitle(result, "Album").discs.length, 1);
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
    assertEquals(disc.tagDiscNumber, 3);
    assertEquals(disc.folderDiscNumber, 2);
    assertEquals(disc.items[0].discNumber, 3);
    assertEquals(disc.items[0].albumDir, R("Album"));
  });

  it("folder number is the fallback when tags are absent", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac")],
      [R("Album/Disc 2/track2.flac")],
    ]);
    const disc = discOf(albumByTitle(result, "Album"), 2);
    assertEquals(disc.tagDiscNumber, undefined);
    assertEquals(disc.folderDiscNumber, 2);
  });

  it("conflicting tag disc numbers fall back to the folder", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac"), { album: "Album", discNumber: 1 }],
      [R("Album/Disc 2/track2.flac"), { album: "Album", discNumber: 3 }],
    ]);
    const disc = discOf(albumByTitle(result, "Album"), 2);
    assertEquals(disc.tagDiscNumber, undefined);
  });

  it("folders with matching tag disc numbers merge even when folder numbers differ", () => {
    const result = group([
      [R("Box/Disc 1/track1.flac"), { album: "X", discNumber: 1 }],
      [R("Box/Disc 3/track1.flac"), { album: "X", discNumber: 1 }],
    ]);
    const album = albumByTitle(result, "X");
    assertEquals(album.discs.length, 1);
    assertEquals(discOf(album, 1).items.length, 2);
  });

  it("Disc 1 and Disc 1 (Bonus) merge into one disc", () => {
    const result = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 1 (Bonus)/track2.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(album.discs.length, 1);
    assertEquals(discOf(album, 1).items.length, 2);
  });

  it("minFolderConfidence: high drops a lone embedded disc folder", () => {
    const result = group([
      [R("Album (Disc 1)/track1.flac")],
      [R("Album (Disc 1)/track2.flac")],
    ], {
      minFolderConfidence: "high",
    });
    // The folder is no longer a disc: it becomes a plain folder album.
    const album = albumByTitle(result, "Album (Disc 1)");
    assertEquals(album.discs[0].discNumber, undefined);
  });

  it("totalDiscs chain: tag total wins, then of-N, then max sibling", () => {
    const tagged = group([
      [R("Album/Disc 1/track1.flac"), { album: "Album", totalDiscs: 2 }],
      [R("Album/Disc 2/track1.flac"), { album: "Album", totalDiscs: 2 }],
    ]);
    assertEquals(discOf(albumByTitle(tagged, "Album"), 1).totalDiscs, 2);

    const ofN = group([
      [R("Album/CD 1 of 3/track1.flac")],
      [R("Album/CD 2 of 3/track1.flac")],
    ]);
    assertEquals(discOf(albumByTitle(ofN, "Album"), 1).totalDiscs, 3);

    const maxSibling = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/Disc 3/track1.flac")],
    ]);
    assertEquals(discOf(albumByTitle(maxSibling, "Album"), 1).totalDiscs, 3);
  });

  it("files without disc evidence join the lowest-numbered disc", () => {
    const result = group([
      [R("Album/Disc 2/track1.flac")],
      [R("Album/Disc 3/track1.flac")],
      [R("Album/loose.flac")],
    ]);
    const album = albumByTitle(result, "Album");
    assertEquals(discOf(album, 2).items.length, 2);
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
    assertEquals(album.discs.length, 2);
    assertEquals(album.directory, R("Artist/Album"));
  });

  it("a directory whose own name parses as a disc folder carries evidence into its parent context", () => {
    const result = group([
      [R("Album/Disc 1/track1.flac")],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    const album = albumByTitle(result, "Album");
    // track1 disc 1; track2 has no evidence -> joins disc 1.
    assertEquals(discOf(album, 1).items.length, 2);
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
    assertEquals(result.albums.length, 2);
    const a = albumByTitle(result, "Album A");
    const b = albumByTitle(result, "Album B");
    assertEquals(discOf(a, 1).items.length, 2);
    assertEquals(discOf(b, 1).items.length, 2);
    assertEquals(a.items[0].albumDir, R("Box"));
    assertEquals(b.items[0].albumDir, R("Box"));
  });

  it("generic album artist folds into an album-only key", () => {
    const result = group([
      [R("Comp/1-01.flac"), { album: "Hits", albumArtist: "Various Artists" }],
      [R("Comp/1-02.flac"), { album: "hits", albumArtist: "VA" }],
    ]);
    assertEquals(result.albums.length, 1);
    const album = albumByTitle(result, "Hits");
    assertEquals(album.albumArtist, undefined);
    assertEquals(album.items.length, 2);
  });

  it("tagged and untagged files across sibling disc folders collapse into one album", () => {
    const result = group([
      [R("Psychocandy/CD1/01 - A.flac")],
      [R("Psychocandy/CD1/02 - B.flac")],
      [R("Psychocandy/CD2/06 - C.flac"), { album: "Psychocandy" }],
      [R("Psychocandy/CD2/07 - D.flac"), { album: "Psychocandy" }],
    ]);
    assertEquals(result.albums.length, 1);
    const album = albumByTitle(result, "Psychocandy");
    assertEquals(album.source, "tags");
    assertEquals(album.items.length, 4);
    assertEquals(album.discs.length, 2);
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
        [R("Artist/Album/Disc 1/track1.flac"), {
          album: "Album",
          discNumber: 1,
        }],
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
          assert(
            okPaths.has(item.path),
            `album item ${item.path} not in input`,
          );
          assert(!seen.has(item.path), `duplicate ${item.path} in albums`);
          seen.add(item.path);
        }
        assert(album.discs.length >= 1, `${name}: discs >= 1`);
        for (const disc of album.discs) {
          assert(disc.items.length >= 1, `${name}: items >= 1`);
          for (const item of disc.items) {
            assertEquals(
              item.discNumber,
              disc.discNumber,
              `${name}: item.discNumber must match its disc`,
            );
            assertEquals(
              item.albumDir,
              disc.items[0].albumDir,
              `${name}: item.albumDir must be consistent within a disc`,
            );
          }
        }
      }
      for (const item of result.singles) {
        assert(!seen.has(item.path), `duplicate ${item.path} in singles`);
        seen.add(item.path);
      }
      for (const item of result.unmatched) {
        assert(!seen.has(item.path), `duplicate ${item.path} in unmatched`);
        seen.add(item.path);
      }
      assertEquals(
        seen.size,
        okPaths.size,
        `${name}: partition covers all ok items`,
      );
      for (const err of result.errors) {
        assertEquals(err.path, "/music/broken.flac");
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
    assertEquals(
      a.albums.map((x) => x.key),
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
      assert(album.items.length >= 2);
    }
    assertEquals(result.singles.length, 1);
    assertEquals(result.singles[0].path, R("Single/track1.flac"));
  });

  it("empty input returns empty collections", () => {
    const result = group([]);
    assertEquals(result.albums.length, 0);
    assertEquals(result.singles.length, 0);
    assertEquals(result.unmatched.length, 0);
    assertEquals(result.errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 9. Error paths
// ---------------------------------------------------------------------------

describe("error paths", () => {
  it("input error items map to errors and never enter groups", () => {
    const result = groupAlbums({
      items: [
        okFile(R("Album/track1.flac"), { album: "Album" }),
        okFile(R("Album/track2.flac"), { album: "Album" }),
        errorFile(R("Album/broken.flac")),
      ],
    } as never, { scanRoot: ROOT });
    assertEquals(result.errors.length, 1);
    assertEquals(result.errors[0].path, R("Album/broken.flac"));
    assertEquals(result.errors[0].error.message, "boom");
    assertEquals(albumByTitle(result, "Album").items.length, 2);
  });
});

// ---------------------------------------------------------------------------
// 10. Integration: scanForAlbums over a real fixture tree
// ---------------------------------------------------------------------------

describe("scanForAlbums integration", () => {
  it("scans a disc-folder tree into one album with two discs", async () => {
    const tempDir = await Deno.makeTempDir();
    try {
      const mp3Data = await Deno.readFile(
        `${
          new URL(".", import.meta.url).pathname
        }test-files/mp3/kiss-snippet.mp3`,
      );
      const mk = async (rel: string) => {
        const full = `${tempDir}/${rel}`;
        await Deno.mkdir(`${tempDir}/${rel.slice(0, rel.lastIndexOf("/"))}`, {
          recursive: true,
        });
        await Deno.writeFile(full, mp3Data);
        return full;
      };
      const disc1 = await mk("Artist/Album/Disc 1/01 - A.mp3");
      const disc2 = await mk("Artist/Album/Disc 2/02 - B.mp3");
      const loose = await mk("Artist/Album/03 - C.mp3");

      const result = await scanForAlbums(tempDir, { recursive: true });

      assertEquals(result.errors.length, 0, JSON.stringify(result.errors));
      assertEquals(result.albums.length, 1);
      const album = result.albums[0];
      // The fixture's tag is "Parade - ..." — tags are authority, so all
      // three copies group under it despite the folder name.
      assertEquals(album.items.length, 3);
      assertEquals(album.discs.length, 2);
      const disc1Files = album.discs.find((d) => d.discNumber === 1)!.items;
      const disc2Files = album.discs.find((d) => d.discNumber === 2)!.items;
      assertEquals(disc1Files.length, 2); // disc 1 file + loose file joins lowest
      assertEquals(disc2Files.length, 1);
      assertEquals(
        disc1Files.find((i) => i.path === disc1)?.albumDir,
        `${tempDir}/Artist/Album`,
      );
      assertEquals(
        disc2Files[0].albumDir,
        `${tempDir}/Artist/Album`,
      );
      assertEquals(
        disc1Files.find((i) => i.path === loose)?.albumDir,
        `${tempDir}/Artist/Album`,
      );
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });
});

describe("singles", () => {
  it("a 1-file tag-keyed group is a single, not an album", () => {
    const result = group([[R("Solo/track1.flac"), { album: "Solo" }]]);
    assertEquals(result.albums.length, 0);
    assertEquals(result.singles.length, 1);
  });

  it("a 2-file group never splits into singles", () => {
    const result = group([
      [R("Album/track1.flac"), { album: "Album" }],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    assertEquals(result.albums.length, 1);
    assertEquals(result.singles.length, 0);
  });

  it("untagged single-file directory is a single", () => {
    const result = group([[R("Solo/track1.flac")]]);
    assertEquals(result.albums.length, 0);
    assertEquals(result.singles.length, 1);
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
    assertEquals(albumByTitle(yes, "Album").compilation, true);

    const no = group([
      [R("Album/track1.flac"), { album: "Album", compilation: false }],
      [R("Album/track2.flac"), { album: "Album", compilation: false }],
    ]);
    assertEquals(albumByTitle(no, "Album").compilation, false);

    const mixed = group([
      [R("Album/track1.flac"), { album: "Album", compilation: true }],
      [R("Album/track2.flac"), { album: "Album", compilation: false }],
    ]);
    assertEquals(albumByTitle(mixed, "Album").compilation, undefined);

    const absent = group([
      [R("Album/track1.flac"), { album: "Album" }],
      [R("Album/track2.flac"), { album: "Album" }],
    ]);
    assertEquals(albumByTitle(absent, "Album").compilation, undefined);
  });
});
