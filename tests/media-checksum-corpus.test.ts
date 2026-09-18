/**
 * @fileoverview The differential corpus for `readMediaChecksum`: does the
 * payload-digest promise hold on files this repo did not write?
 *
 * Every case is relational. Nothing here hard-codes a digest, a size or a byte
 * offset a tool version could change: a case compares digests against each
 * other, against a `sha256` the test computes from the file's own bytes (the
 * fallback's contract, and the payload's identity), or against the payload the
 * walk derives from those same bytes. A tool-driven "tag edit" is *not* assumed
 * to be tag-only — ffmpeg's first re-tag of a lame MP3 rewrites the Xing/Info
 * header frame, which is inside the payload, so the digest legitimately moves
 * (measured: a CBR payload differs at byte 3, a VBR payload grows 209 bytes, and
 * a second pass is stable). So the tool cases assert the property instead: the
 * digest follows the payload bytes, in both directions.
 *
 * Two classes:
 *
 * 1. Always runs — pure byte construction, no tool and no `--allow-run`. Tag
 *    systems this repo's writers never produce (hand-written ID3v2.4 and 2.3,
 *    the extended header, the unsynchronisation flag, Lyrics3v2 + ID3v1, APEv2
 *    appended and prepended), an MP4 `free` atom spliced before the first
 *    `mdat`, a byte flipped inside a WAV's non-`data` chunk, and the whole-file
 *    fallback's honesty.
 * 2. Tool-guarded — files written by one tool and re-tagged by another, which is
 *    where a producer's own invariants stop holding. Tools: `lame`, `ffmpeg`,
 *    `flac`, `metaflac`. CI's ubuntu-latest ships ffmpeg; the others are
 *    optional, so each case skips when its tool is absent, and the skip reason
 *    is folded into the test's name. They also need `--allow-run`, which
 *    `deno task test` does not grant: under the standard gate the tool class
 *    skips, and the on-demand invocation is
 *    `deno test --allow-read --allow-write --allow-env --allow-run tests/media-checksum-corpus.test.ts`.
 *
 * Every generated artifact lives in a `Deno.makeTempDir()` directory removed in
 * a `finally`; nothing is written into the repo.
 */

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { resolve } from "@std/path";
import type { MediaChecksum } from "../src/taglib/audio-file-checksum.ts";
import { mediaRanges } from "../src/taglib/media-ranges.ts";
import { readMediaChecksum } from "../src/simple/index.ts";

const MP3 = "tests/test-files/mp3/kiss-snippet.mp3";
const M4A = "tests/test-files/mp4/kiss-snippet.m4a";
const WAV = "tests/test-files/wav/kiss-snippet.wav";
const OGG = "tests/test-files/ogg/kiss-snippet.ogg";
const BEXT_WAV = "tests/test-files/wav/bext-ixml.wav";

/** Hex SHA-256 of some bytes: what `source: "file"` promises, and what a payload
 * digest must equal when the payload is one this test derived itself. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** ID3v2's syncsafe integer: 28 bits, seven per byte. A non-obvious formula,
 * named once so the tag builders below cannot disagree about it. */
const syncsafe = (value: number): number[] => [
  (value >> 21) & 0x7f,
  (value >> 14) & 0x7f,
  (value >> 7) & 0x7f,
  value & 0x7f,
];

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** An ID3v2 tag blob: `version`, header `flags`, and `body` bytes of frames. */
function id3v2Tag(
  version: number,
  flags: number,
  body: Uint8Array,
): Uint8Array {
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, version, 0x00, flags], 0);
  header.set(syncsafe(body.length), 6);
  return concat(header, body);
}

/** A TIT2 (title) text frame — the one frame every tag system below carries. */
function tit2Frame(title: string): Uint8Array {
  const text = new TextEncoder().encode(title);
  const body = concat(new Uint8Array([3]), text); // encoding 3 = UTF-8
  const frame = new Uint8Array(10 + body.length);
  frame.set([0x54, 0x49, 0x54, 0x32], 0);
  frame.set(syncsafe(body.length), 4);
  frame.set(body, 10);
  return frame;
}

/** `bytes` with any leading ID3v2 tag removed: the frames, untouched. */
function stripId3v2(bytes: Uint8Array): Uint8Array {
  if (!(bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
    return bytes;
  }
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  return bytes.subarray(10 + size + ((bytes[5] & 0x10) ? 10 : 0));
}

/** `bytes` with a fresh ID3v2.4 title tag in place of whatever tag led it, the
 * frames copied verbatim. This is the corpus's strongest "tag-only" writer: not
 * TagLib, and provably unable to touch the audio. */
function replaceId3v2(bytes: Uint8Array, title: string): Uint8Array {
  const tag = id3v2Tag(4, 0, tit2Frame(title));
  return concat(tag, stripId3v2(bytes));
}

/** An APEv2 blob whose declared size covers `itemBytes` plus its footer, and
 * whose header-present flag is set — the layout `trailingTagStart` reads, used
 * here *in front* of the audio, where no rule expects it. */
function apev2Blob(itemBytes: number): Uint8Array {
  const item = concat(
    new TextEncoder().encode("Title"),
    new Uint8Array(itemBytes),
    new Uint8Array([0]),
  );
  const header = new Uint8Array(32);
  header.set(new TextEncoder().encode("APETAGEX"), 0);
  const view = new DataView(header.buffer);
  view.setUint32(12, item.length + 32, true); // size: items + footer
  view.setUint32(20, 0x80000000, true); // header present
  return concat(header, item, header);
}

/** The bytes the digest claims to cover: the walk's ranges, concatenated. A
 * fallback here is a mis-built case, not a valid answer. */
function payloadBytes(format: string, bytes: Uint8Array): Uint8Array {
  const walk = mediaRanges(format, bytes);
  assert(
    walk.kind === "ranges",
    `${format}: no payload ranges (${walk.detail})`,
  );
  const out = new Uint8Array(walk.ranges.reduce((n, r) => n + r.length, 0));
  let at = 0;
  for (const range of walk.ranges) {
    out.set(bytes.subarray(range.offset, range.offset + range.length), at);
    at += range.length;
  }
  return out;
}

/** `bytes` with one bit flipped in the middle of the walk's first payload
 * range: an edit only a payload writer can make. */
function flipPayloadBit(bytes: Uint8Array, format: string): Uint8Array {
  const walk = mediaRanges(format, bytes);
  assert(walk.kind === "ranges", `${format}: no payload ranges to mutate`);
  const range = walk.ranges[0];
  assert(range.length > 0, `${format}: empty payload range`);
  const out = bytes.slice();
  out[range.offset + Math.floor(range.length / 2)] ^= 0xff;
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The identity behind every payload digest: the reported hex is the SHA-256 of
 * the payload the walk derives from the *same* file, and `bytesHashed` counts
 * exactly those bytes. Both sides are derived in-test, so the assertion holds
 * whatever a tool version produced. */
async function assertPayloadIdentity(
  label: string,
  format: string,
  bytes: Uint8Array,
  digest: MediaChecksum,
): Promise<void> {
  const payload = payloadBytes(format, bytes);
  assertEquals(digest.bytesHashed, payload.length, `${label}: bytesHashed`);
  assertEquals(digest.hex, await sha256Hex(payload), `${label}: hex`);
}

/** The input-form contract, asserted on a file large enough to partial-load: a
 * path, the same bytes, and a File must describe one file — the `File` form must
 * not become the handle's window image. */
async function assertInputFormsAgree(
  path: string,
  format: string,
  label: string,
): Promise<void> {
  const bytes = await Deno.readFile(path);
  const byPath = await readMediaChecksum(path);
  assertEquals(byPath.source, "audio-payload", `${label}: source`);
  await assertPayloadIdentity(label, format, bytes, byPath);
  const byBuffer = await readMediaChecksum(bytes);
  const byFile = await readMediaChecksum(new File([bytes], label));
  assertEquals(byBuffer.hex, byPath.hex, `${label}: buffer vs path`);
  assertEquals(byFile.hex, byPath.hex, `${label}: File vs path`);
  assertEquals(byFile.bytesHashed, byPath.bytesHashed, `${label}: bytesHashed`);
}

/** The fallback contract: the whole file, and honest about it. */
async function assertWholeFileFallback(
  path: string,
  label: string,
): Promise<void> {
  const bytes = await Deno.readFile(path);
  const digest = await readMediaChecksum(path);
  assertEquals(digest.source, "file", `${label}: source`);
  assertEquals(digest.algorithm, "sha256", `${label}: algorithm`);
  assertEquals(digest.hex, await sha256Hex(bytes), `${label}: hex`);
  assertEquals(
    digest.bytesHashed,
    bytes.length,
    `${label}: bytesHashed must be the file size`,
  );
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "taglib-corpus-" });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}

/** Writes `bytes` to `<dir>/<name>` and answers the path. */
async function writeTemp(
  dir: string,
  name: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = resolve(dir, name);
  await Deno.writeFile(path, bytes);
  return path;
}

/** A synchronous PATH walk — `Deno.Command` would need the very permission this
 * check exists to avoid asking for. */
function onPath(tool: string): boolean {
  const names = Deno.build.os === "windows"
    ? [`${tool}.exe`, `${tool}.cmd`]
    : [tool];
  const dirs = (Deno.env.get("PATH") ?? "").split(
    Deno.build.os === "windows" ? ";" : ":",
  );
  for (const dir of dirs) {
    if (dir.length === 0) continue;
    for (const name of names) {
      try {
        if (Deno.statSync(resolve(dir, name)).isFile) return true;
      } catch {
        // Not in this directory; continuing the walk is the point.
      }
    }
  }
  return false;
}

/** Why this case cannot run here, or `undefined` when it can. Two gates: every
 * tool must be on PATH, and this invocation must hold `--allow-run` for it —
 * `deno task test` grants read/write/env only, so a case that spawned a tool
 * there would fail on permission instead of skipping. */
function toolSkipReason(tools: string[]): string | undefined {
  const missing = tools.filter((tool) => !onPath(tool));
  if (missing.length > 0) return `not on PATH: ${missing.join(", ")}`;
  const ungranted = tools.filter((tool) =>
    Deno.permissions.querySync({ name: "run", command: tool }).state !==
      "granted"
  );
  if (ungranted.length > 0) {
    return `--allow-run not granted for: ${ungranted.join(", ")}`;
  }
  return undefined;
}

/**
 * A tool-driven case. It runs when every named tool is on PATH and this
 * invocation granted `--allow-run` for it, and otherwise skips — with the reason
 * folded into the test's name, since `Deno.TestDefinition.ignore` takes a
 * boolean and a bare "ignored" says nothing about why.
 */
function toolTest(
  name: string,
  tools: string[],
  fn: () => Promise<void>,
): void {
  const reason = toolSkipReason(tools);
  Deno.test({
    name: reason === undefined ? name : `${name} [skipped: ${reason}]`,
    ignore: reason !== undefined,
    fn,
  });
}

/** Runs a tool to completion; a non-zero exit fails the case, with the tool's
 * own stderr as the message. */
async function run(tool: string, args: string[]): Promise<void> {
  const out = await new Deno.Command(tool, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!out.success) {
    throw new Error(
      `${tool} ${args.join(" ")} exited ${out.code}: ${
        new TextDecoder().decode(out.stderr).trim().slice(0, 300)
      }`,
    );
  }
}

/** The corpus's core tool assertion: the edit must move the digest if and only
 * if it moved the derived payload bytes, and the digest must be that payload's
 * SHA-256 either way. Both branches are correct answers — a tag-only edit keeps
 * the payload, an ffmpeg re-tag of a lame MP3 may not — so the case asserts the
 * relationship rather than a direction. */
async function assertDigestFollowsPayload(
  dir: string,
  label: string,
  format: string,
  path: string,
  edit: () => Promise<void>,
): Promise<void> {
  const before = await Deno.readFile(path);
  const digestBefore = await readMediaChecksum(path);
  await assertPayloadIdentity(`${label}: before`, format, before, digestBefore);
  await edit();
  const after = await Deno.readFile(path);
  const digestAfter = await readMediaChecksum(path);
  await assertPayloadIdentity(`${label}: after`, format, after, digestAfter);
  const payloadSame = bytesEqual(
    payloadBytes(format, before),
    payloadBytes(format, after),
  );
  assertEquals(
    digestAfter.hex === digestBefore.hex,
    payloadSame,
    `${label}: payload ${
      payloadSame ? "unchanged" : "changed"
    } but the digest ${
      digestAfter.hex === digestBefore.hex ? "did not move" : "moved"
    }`,
  );
  assertEquals(digestAfter.source, digestBefore.source, `${label}: source`);
  // The other direction, on a copy: a payload edit must move the digest.
  const mutatedPath = await Deno.makeTempFile({ dir, prefix: "mutation-" });
  await Deno.writeFile(mutatedPath, flipPayloadBit(after, format));
  assertNotEquals(
    (await readMediaChecksum(mutatedPath)).hex,
    digestAfter.hex,
    `${label}: a payload edit must move the digest`,
  );
}

/** A hand-written (non-TagLib) tag replacement: the frames are copied verbatim,
 * so the payload bytes are identical and the digest MUST be unchanged — the
 * stronger statement `assertDigestFollowsPayload` cannot make, since it allows a
 * tool's edit to move the payload. */
async function assertHandWrittenRetagIsInvisible(
  dir: string,
  label: string,
  sourcePath: string,
): Promise<void> {
  const original = await Deno.readFile(sourcePath);
  const before = await readMediaChecksum(sourcePath);
  assertEquals(before.source, "audio-payload", `${label}: source`);
  const retagged = replaceId3v2(original, `Hand-written tag for ${label}`);
  const path = await writeTemp(dir, `${label}-retagged.mp3`, retagged);
  const after = await readMediaChecksum(path);
  assert(
    bytesEqual(payloadBytes("MP3", original), payloadBytes("MP3", retagged)),
    `${label}: a tag-only writer must not touch the frames`,
  );
  assertEquals(
    after.hex,
    before.hex,
    `${label}: tag-only edit moved the digest`,
  );
  assertEquals(after.bytesHashed, before.bytesHashed, `${label}: bytesHashed`);
  assertNotEquals(
    await sha256Hex(retagged),
    before.hex,
    `${label}: the digest must not be the whole-file hash`,
  );
}

// ---------------------------------------------------------------- always runs

/** The corpus's base: the repo fixture with its tag stripped. A tag is not
 * audio, so the digest must not move — the fixture's frames are what every tag
 * system below is attached to. */
Deno.test("stripping the fixture's ID3v2 tag does not move its digest", async () => {
  await withTempDir(async (dir) => {
    const fixture = Deno.readFileSync(MP3);
    const bare = stripId3v2(fixture);
    assert(bare.length < fixture.length, "fixture must carry an ID3v2 tag");
    const digest = await readMediaChecksum(
      await writeTemp(dir, "bare.mp3", bare),
    );
    await assertPayloadIdentity("bare", "MP3", bare, digest);
    assertEquals(
      digest.hex,
      (await readMediaChecksum(MP3)).hex,
      "the tag is not payload",
    );
  });
});

// Shape guarded: tag systems no writer in this repo produces, all of them
// tag-only, none of them TagLib's — the classic MP3 front layouts.
Deno.test("foreign ID3v2 variants ahead of the frames leave the MP3 digest alone", async () => {
  await withTempDir(async (dir) => {
    const bare = stripId3v2(Deno.readFileSync(MP3));
    const base = await readMediaChecksum(
      await writeTemp(dir, "bare.mp3", bare),
    );
    const shapes: Array<{ name: string; label: string; bytes: Uint8Array }> = [
      {
        name: "id3v24-plain",
        label: "ID3v2.4 plain prefix",
        bytes: concat(id3v2Tag(4, 0, tit2Frame("Plain v2.4")), bare),
      },
      {
        name: "id3v23-extended",
        label: "ID3v2.3 with an extended header (flag 0x40)",
        bytes: concat(
          id3v2Tag(3, 0x40, concat(new Uint8Array(6), tit2Frame("v2.3 ext"))),
          bare,
        ),
      },
      {
        name: "id3v24-unsync",
        label: "ID3v2.4 with the unsynchronisation flag (0x80)",
        bytes: concat(id3v2Tag(4, 0x80, tit2Frame("Unsync")), bare),
      },
    ];
    for (const { name, label, bytes } of shapes) {
      const digest = await readMediaChecksum(
        await writeTemp(dir, `${name}.mp3`, bytes),
      );
      await assertPayloadIdentity(label, "MP3", bytes, digest);
      assertEquals(digest.hex, base.hex, `${label}: the tag is not payload`);
      assertEquals(digest.bytesHashed, bare.length, `${label}: bytesHashed`);
      assertNotEquals(
        await sha256Hex(bytes),
        digest.hex,
        `${label}: the digest must not be the whole-file hash`,
      );
    }
    // The half that keeps the invariance from being vacuous: the same shape with
    // one payload byte flipped must move.
    const tagged = concat(id3v2Tag(4, 0, tit2Frame("Sensitivity")), bare);
    const mutated = await readMediaChecksum(
      await writeTemp(dir, "mutated.mp3", flipPayloadBit(tagged, "MP3")),
    );
    assertNotEquals(
      mutated.hex,
      base.hex,
      "a payload edit must move the digest",
    );
  });
});

// Shape guarded: the MP3 tail — Lyrics3v2 in front of ID3v1, and a footer-only
// APEv2 in front of ID3v1. Both are appended, so the payload ends before them.
Deno.test("appended tag systems (Lyrics3v2, APEv2, ID3v1) leave the digest alone", async () => {
  await withTempDir(async (dir) => {
    const bare = stripId3v2(Deno.readFileSync(MP3));
    const base = await readMediaChecksum(
      await writeTemp(dir, "bare.mp3", bare),
    );
    const id3v1 = new Uint8Array(128);
    id3v1.fill(0x20);
    id3v1.set([0x54, 0x41, 0x47], 0); // "TAG"
    const lyrics3 = new TextEncoder().encode(
      "LYRICSBEGINLYR0005helloLYRICS200000019",
    );
    const ape = new Uint8Array(32);
    ape.set(new TextEncoder().encode("APETAGEX"), 0);
    const apeView = new DataView(ape.buffer);
    apeView.setUint32(12, 32, true); // size: the footer itself
    apeView.setUint32(20, 0, true); // header-present flag clear
    const shapes: Array<{ name: string; label: string; bytes: Uint8Array }> = [
      {
        name: "lyrics3",
        label: "Lyrics3v2 + ID3v1",
        bytes: concat(bare, lyrics3, id3v1),
      },
      {
        name: "apev2-appended",
        label: "footer-only APEv2 + ID3v1",
        bytes: concat(bare, ape, id3v1),
      },
    ];
    for (const { name, label, bytes } of shapes) {
      const digest = await readMediaChecksum(
        await writeTemp(dir, `${name}.mp3`, bytes),
      );
      await assertPayloadIdentity(label, "MP3", bytes, digest);
      assertEquals(digest.hex, base.hex, `${label}: the tail is not payload`);
      assertEquals(digest.bytesHashed, bare.length, `${label}: bytesHashed`);
    }
  });
});

// Shape guarded: an APEv2 tag 4 KiB *ahead* of the frames. ID3v2 is the only
// thing the walk skips by name, so the first frame is found by the bounded scan
// — which is what makes this one reachable, and the 70 KiB sibling below not.
Deno.test("a 4 KiB APEv2 tag in front of the frames is crossed by the scan", async () => {
  await withTempDir(async (dir) => {
    const bare = stripId3v2(Deno.readFileSync(MP3));
    const base = await readMediaChecksum(
      await writeTemp(dir, "bare.mp3", bare),
    );
    const bytes = concat(apev2Blob(4096), bare);
    const digest = await readMediaChecksum(
      await writeTemp(dir, "front-4k.mp3", bytes),
    );
    await assertPayloadIdentity("4 KiB front tag", "MP3", bytes, digest);
    assertEquals(digest.source, "audio-payload", "4 KiB front tag: source");
    assertEquals(
      digest.hex,
      base.hex,
      "4 KiB front tag: the tag is not payload",
    );
    assertEquals(
      digest.bytesHashed,
      bare.length,
      "4 KiB front tag: bytesHashed",
    );
  });
});

// Shape guarded: the scan's 64 KiB bound (MPEG_SCAN_LIMIT). A 70 KiB APEv2 tag
// in front puts the first frame past it, so the walk gives up and the answer is
// the whole file — the honest, weaker guarantee, still reported as such. Pinned
// here because the bound is a deliberate choice, not an accident.
Deno.test("a 70 KiB APEv2 tag in front falls back to the whole file", async () => {
  await withTempDir(async (dir) => {
    const bare = stripId3v2(Deno.readFileSync(MP3));
    const base = await readMediaChecksum(
      await writeTemp(dir, "bare.mp3", bare),
    );
    const bytes = concat(apev2Blob(70_000), bare);
    const path = await writeTemp(dir, "front-70k.mp3", bytes);
    await assertWholeFileFallback(path, "70 KiB front tag");
    assertNotEquals(
      (await readMediaChecksum(path)).hex,
      base.hex,
      "70 KiB front tag: the fallback is weaker, and the test must show it",
    );
  });
});

// Shape guarded: a filler atom no TagLib writer emits, spliced before the first
// `mdat` — ffmpeg's own +faststart output carries one, so this is a real shape,
// and the mdat *contents* are untouched: same payload, same digest.
Deno.test("an MP4 `free` atom before the first mdat leaves the digest alone", async () => {
  await withTempDir(async (dir) => {
    const bytes = Deno.readFileSync(M4A);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 0;
    let mdatAt = -1;
    while (at + 8 <= bytes.length) {
      const size = view.getUint32(at, false);
      const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
      if (type === "mdat") {
        mdatAt = at;
        break;
      }
      if (size < 8) break;
      at += size;
    }
    assert(mdatAt > 0, "fixture has no top-level mdat");
    const free = new Uint8Array(16);
    new DataView(free.buffer).setUint32(0, 16, false);
    free.set(new TextEncoder().encode("free"), 4);
    const spliced = concat(
      bytes.subarray(0, mdatAt),
      free,
      bytes.subarray(mdatAt),
    );
    const path = await writeTemp(dir, "free.m4a", spliced);
    const before = await readMediaChecksum(M4A);
    const after = await readMediaChecksum(path);
    await assertPayloadIdentity("free atom", "MP4", spliced, after);
    assert(
      bytesEqual(payloadBytes("MP4", bytes), payloadBytes("MP4", spliced)),
      "free atom: the mdat contents must be untouched",
    );
    assertEquals(after.hex, before.hex, "free atom: digest");
    assertEquals(
      after.bytesHashed,
      before.bytesHashed,
      "free atom: bytesHashed",
    );
    assertNotEquals(
      await sha256Hex(spliced),
      before.hex,
      "free atom: the file really changed, so this is not a no-op case",
    );
  });
});

// Shape guarded: a byte flipped inside a non-`data` chunk (bext/iXML) of a real
// BWF fixture — the chunk list, not a name list, is what keeps it out of the
// payload.
Deno.test("a byte flipped inside a WAV's bext/iXML chunk leaves the digest alone", async () => {
  await withTempDir(async (dir) => {
    const bytes = Deno.readFileSync(BEXT_WAV);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 12;
    let chunkAt = -1;
    while (at + 8 <= bytes.length) {
      const id = new TextDecoder().decode(bytes.subarray(at, at + 4));
      const size = view.getUint32(at + 4, true);
      if (id === "bext" || id === "iXML") {
        chunkAt = at + 8;
        break;
      }
      at += 8 + size + (size % 2);
    }
    assert(chunkAt > 0, "fixture carries no bext/iXML chunk");
    const mutated = bytes.slice();
    mutated[chunkAt + 4] ^= 0xff;
    assert(mutated[chunkAt + 4] !== bytes[chunkAt + 4], "mutation must land");
    const before = await readMediaChecksum(BEXT_WAV);
    const after = await readMediaChecksum(
      await writeTemp(dir, "bext-mutated.wav", mutated),
    );
    await assertPayloadIdentity("bext flip", "WAV", mutated, after);
    assertEquals(after.source, "audio-payload", "bext flip: source");
    assertEquals(after.hex, before.hex, "bext flip: digest");
    assertNotEquals(
      await sha256Hex(mutated),
      before.hex,
      "bext flip: the file really changed, so this is not a no-op case",
    );
  });
});

// Shape guarded: a format with no payload rule. The promise is the weaker one,
// stated rather than implied: the whole file, and `hex` equals `sha256(file)`.
Deno.test("an Ogg file answers the whole file and says so", async () => {
  await assertWholeFileFallback(OGG, "ogg");
});

// Shape guarded: the input form must not change the answer — the digest belongs
// to the file, not to how it was handed over.
Deno.test("path, buffer and File describe the same file", async () => {
  await withTempDir(async (dir) => {
    const bytes = Deno.readFileSync(MP3);
    const path = await writeTemp(dir, "forms.mp3", bytes);
    const byPath = await readMediaChecksum(path);
    const byBuffer = await readMediaChecksum(bytes);
    const byFile = await readMediaChecksum(new File([bytes], "forms.mp3"));
    assertEquals(byBuffer.hex, byPath.hex, "buffer vs path");
    assertEquals(byFile.hex, byPath.hex, "File vs path");
    assertEquals(
      byFile.bytesHashed,
      byPath.bytesHashed,
      "File vs path: bytesHashed",
    );
    assertEquals(byBuffer.source, byPath.source, "buffer vs path: source");
  });
});

// -------------------------------------------------------------- tool-guarded

// Shape guarded: a lame-written MP3 re-tagged by two different writers. The
// hand-written tag is provably tag-only (frames copied verbatim), so the digest
// must not move; ffmpeg's re-tag is *not* tag-only — it rewrites the Xing/Info
// header frame inside the payload — so the differential assertion is the only
// honest one there, and it holds in both directions.
toolTest(
  "lame CBR: a hand-written tag-only edit is stable, ffmpeg's re-tag follows the payload",
  ["lame", "ffmpeg"],
  async () => {
    await withTempDir(async (dir) => {
      const path = resolve(dir, "cbr.mp3");
      await run("lame", [
        "--quiet",
        "--cbr",
        "-b",
        "128",
        "--tt",
        "Original",
        WAV,
        path,
      ]);
      await assertHandWrittenRetagIsInvisible(dir, "lame-cbr", path);
      await assertDigestFollowsPayload(
        dir,
        "lame CBR ffmpeg re-tag",
        "MP3",
        path,
        async () => {
          const out = `${path}.out.mp3`;
          await run("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            path,
            "-c",
            "copy",
            "-metadata",
            "album=Retag",
            out,
          ]);
          await Deno.rename(out, path);
        },
      );
    });
  },
);

// Shape guarded: the VBR sibling, where the Xing/LAME header sits in the first
// frame and ffmpeg's re-tag *grows* the payload (measured: +209 bytes) — the
// clearest case that invariance is a property of the payload, not of the tag.
toolTest(
  "lame VBR -V2: the Xing header ffmpeg rewrites is payload, and the digest follows it",
  ["lame", "ffmpeg"],
  async () => {
    await withTempDir(async (dir) => {
      const path = resolve(dir, "vbr.mp3");
      await run("lame", [
        "--quiet",
        "-V",
        "2",
        "--tt",
        "Original",
        WAV,
        path,
      ]);
      await assertHandWrittenRetagIsInvisible(dir, "lame-vbr", path);
      await assertDigestFollowsPayload(
        dir,
        "lame VBR ffmpeg re-tag",
        "MP3",
        path,
        async () => {
          const out = `${path}.out.mp3`;
          await run("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            path,
            "-c",
            "copy",
            "-metadata",
            "album=Retag",
            out,
          ]);
          await Deno.rename(out, path);
        },
      );
    });
  },
);

// Shape guarded: the flac CLI's own container decisions (seektable, 8 KiB
// padding) around a metaflac tag edit — the block chain moves, the frames do
// not, so the digest must not either.
toolTest(
  "flac CLI with a seektable and padding: metaflac tag edits don't move the digest",
  ["flac", "metaflac"],
  async () => {
    await withTempDir(async (dir) => {
      const path = resolve(dir, "seek.flac");
      await run("flac", [
        "--silent",
        "--force",
        "--best",
        "--seekpoint=1000x",
        "--padding=8192",
        "-o",
        path,
        WAV,
      ]);
      await run("metaflac", ["--set-tag=ALBUM=Seek", path]);
      await assertDigestFollowsPayload(
        dir,
        "flac metaflac re-tag",
        "FLAC",
        path,
        async () => {
          await run("metaflac", ["--set-tag=TITLE=Retag", path]);
        },
      );
    });
  },
);

// Shape guarded: an m4a remuxed with `-c copy` — ffmpeg's own moov/udta layout,
// re-tagged by ffmpeg. The payload is every non-empty mdat.
toolTest("ffmpeg m4a remux (-c copy)", ["ffmpeg"], async () => {
  await withTempDir(async (dir) => {
    const path = resolve(dir, "remux.m4a");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      M4A,
      "-c",
      "copy",
      "-metadata",
      "title=Remux",
      path,
    ]);
    await assertDigestFollowsPayload(
      dir,
      "m4a remux",
      "MP4",
      path,
      async () => {
        const out = `${path}.out.m4a`;
        await run("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          path,
          "-c",
          "copy",
          "-metadata",
          "album=Retag",
          out,
        ]);
        await Deno.rename(out, path);
      },
    );
  });
});

// Shape guarded: `+faststart` moves moov in front of mdat and leaves a `free`
// atom behind it — the atom the always-runs case splices by hand.
toolTest("ffmpeg m4a +faststart (moov before mdat)", ["ffmpeg"], async () => {
  await withTempDir(async (dir) => {
    const path = resolve(dir, "faststart.m4a");
    const movflags = ["-movflags", "+faststart"];
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      M4A,
      "-c",
      "copy",
      ...movflags,
      path,
    ]);
    await assertDigestFollowsPayload(
      dir,
      "m4a faststart",
      "MP4",
      path,
      async () => {
        const out = `${path}.out.m4a`;
        await run("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          path,
          "-c",
          "copy",
          ...movflags,
          "-metadata",
          "title=Retag",
          out,
        ]);
        await Deno.rename(out, path);
      },
    );
  });
});

// Shape guarded: a fragmented file — `empty_moov` plus one `moof`/`mdat` pair per
// fragment, so the walk has several mdats to collect in file order.
toolTest(
  "ffmpeg m4a fragmented (empty_moov + moof/mdat)",
  ["ffmpeg"],
  async () => {
    await withTempDir(async (dir) => {
      const path = resolve(dir, "fragmented.m4a");
      const movflags = ["-movflags", "frag_keyframe+empty_moov"];
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        M4A,
        "-c",
        "copy",
        ...movflags,
        path,
      ]);
      await assertDigestFollowsPayload(
        dir,
        "m4a fragmented",
        "MP4",
        path,
        async () => {
          const out = `${path}.out.m4a`;
          await run("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            path,
            "-c",
            "copy",
            ...movflags,
            "-metadata",
            "title=Retag",
            out,
          ]);
          await Deno.rename(out, path);
        },
      );
    });
  },
);

// Shape guarded: ffmpeg's LIST/INFO chunk in front of the `data` chunk — the
// other tag shape a WAV carries, beside the bext/iXML case above.
toolTest("ffmpeg WAV LIST/INFO tags", ["ffmpeg"], async () => {
  await withTempDir(async (dir) => {
    const path = resolve(dir, "list.wav");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      WAV,
      "-c",
      "copy",
      "-metadata",
      "title=FF",
      path,
    ]);
    await assertDigestFollowsPayload(
      dir,
      "wav LIST/INFO",
      "WAV",
      path,
      async () => {
        const out = `${path}.out.wav`;
        await run("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          path,
          "-c",
          "copy",
          "-metadata",
          "album=Retag",
          out,
        ]);
        await Deno.rename(out, path);
      },
    );
  });
});

// Shape guarded: formats with no payload rule, written by a real encoder. If one
// of these ever gains a walk, this case is what tells you to assert the walk.
toolTest(
  "formats with no payload rule answer the whole file (AIFF, Matroska, WavPack, Opus)",
  ["ffmpeg"],
  async () => {
    await withTempDir(async (dir) => {
      const encoders: Array<{ name: string; label: string; flags: string[] }> =
        [
          { name: "fb.aiff", label: "aiff", flags: ["-f", "aiff"] },
          { name: "fb.mka", label: "matroska", flags: ["-f", "matroska"] },
          { name: "fb.wv", label: "wavpack", flags: ["-c:a", "wavpack"] },
          { name: "fb.opus", label: "opus", flags: ["-c:a", "libopus"] },
        ];
      for (const { name, label, flags } of encoders) {
        const path = resolve(dir, name);
        await run("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          WAV,
          ...flags,
          path,
        ]);
        await assertWholeFileFallback(path, label);
      }
    });
  },
);

// Shape guarded: ffmpeg's mp2 output carries no tag — its first bytes are the
// MPEG sync — so the whole file is one payload range and the digest coincides
// with `sha256(file)`. That is the audio-payload path, *not* the fallback: the
// "uncovered format" expectation would be wrong here, and a tag in front of the
// frames would move the range.
toolTest("ffmpeg's mp2 output has no tag, so the whole file is payload", [
  "ffmpeg",
], async () => {
  await withTempDir(async (dir) => {
    const path = resolve(dir, "fb.mp2");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      WAV,
      "-c:a",
      "mp2",
      path,
    ]);
    const bytes = await Deno.readFile(path);
    const digest = await readMediaChecksum(path);
    assertEquals(digest.source, "audio-payload", "mp2: source");
    await assertPayloadIdentity("mp2", "MP3", bytes, digest);
    const mutated = await writeTemp(
      dir,
      "fb-mutated.mp2",
      flipPayloadBit(bytes, "MP3"),
    );
    assertNotEquals(
      (await readMediaChecksum(mutated)).hex,
      digest.hex,
      "mp2: a payload edit must move the digest",
    );
  });
});

// Shape guarded: a real multi-minute encode, where the `File` input is large
// enough to partial-load — the window image must not become the thing hashed.
toolTest("a real 3-minute lame MP3: path == buffer == File", [
  "lame",
  "ffmpeg",
], async () => {
  await withTempDir(async (dir) => {
    const wav = resolve(dir, "long.wav");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=180",
      wav,
    ]);
    const path = resolve(dir, "long.mp3");
    await run("lame", ["--quiet", "-V", "4", "--tt", "Long", wav, path]);
    await assertInputFormsAgree(path, "MP3", "long mp3");
  });
});

toolTest("a real 3-minute flac: path == buffer == File", [
  "flac",
  "ffmpeg",
], async () => {
  await withTempDir(async (dir) => {
    const wav = resolve(dir, "long.wav");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=180",
      wav,
    ]);
    const path = resolve(dir, "long.flac");
    await run("flac", ["--silent", "--force", "--best", "-o", path, wav]);
    await assertInputFormsAgree(path, "FLAC", "long flac");
  });
});

toolTest(
  "a real 3-minute m4a: path == buffer == File",
  ["ffmpeg"],
  async () => {
    await withTempDir(async (dir) => {
      const path = resolve(dir, "long.m4a");
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=180",
        "-c:a",
        "aac",
        path,
      ]);
      await assertInputFormsAgree(path, "MP4", "long m4a");
    });
  },
);
