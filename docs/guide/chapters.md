# Working with Chapters

TagLib-Wasm reads and writes chapter markers — the named, timestamped sections
used by audiobooks, podcasts, and long-form recordings — through the Full API's
`AudioFile.getChapters()` and `AudioFile.setChapters()`.

## Quick Start

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("audiobook.m4b");

// Read chapters (always ordered by start time)
for (const ch of file.getChapters()) {
  console.log(
    `${ch.startTimeMs}–${ch.endTimeMs ?? "?"} ${ch.title} (${ch.source})`,
  );
}

// Replace all chapters
file.setChapters([
  { startTimeMs: 0, title: "Intro" },
  { startTimeMs: 95_000, title: "Chapter 1" },
  { startTimeMs: 612_000, title: "Chapter 2" },
]);
file.save();
```

## The Chapter Type

```typescript
interface Chapter {
  /** Chapter start, milliseconds from the start of the file. */
  startTimeMs: number;
  /**
   * Chapter end, milliseconds. Explicit for ID3v2 CHAP frames; inferred for
   * MP4 chapters (the next chapter's start, or the track duration for the
   * last one). `undefined` only when the duration can't be determined.
   */
  endTimeMs?: number;
  /** Chapter title. */
  title?: string;
  /** ID3v2 CHAP element ID. `undefined` for MP4 chapters. */
  id?: string;
  /** Which container structure this chapter was read from. */
  source?: "id3" | "nero" | "quicktime";
}
```

## How chapters are stored

| Format               | Read from                                               | Written by `setChapters()`                      |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| MP3                  | ID3v2 `CHAP` frames                                     | ID3v2 `CHAP` frames                             |
| MP4 (.m4a/.m4b/.mp4) | QuickTime chapter track (preferred) or Nero `chpl` atom | QuickTime track, Nero atom, or both — see below |
| Other                | —                                                       | throws `UnsupportedFormatError`                 |

When an MP4 file has both a QuickTime chapter track and a Nero `chpl` atom,
`getChapters()` returns the QuickTime chapters (they have no length limit and
are what Apple devices read). Each returned chapter reports which structure it
came from via `source`.

## Choosing an MP4 chapter style

For MP4 files, `setChapters()` accepts a `SetChaptersOptions` with
`mp4ChapterStyle`:

```typescript
file.setChapters(chapters, { mp4ChapterStyle: "both" });
```

| Value                   | Writes                    | Read by                                       | Notes                                                                             |
| ----------------------- | ------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `"quicktime"` (default) | a QuickTime chapter track | Apple Books / Podcasts / iOS and most players | no chapter-count limit                                                            |
| `"nero"`                | a Nero `chpl` atom        | ffmpeg, foobar2000, MP4Box                    | ignored by Apple devices; **max 255 chapters**                                    |
| `"both"`                | both of the above         | everything                                    | with >255 chapters the QuickTime track gets all, the Nero atom gets the first 255 |

The structure(s) you don't select are removed, so the file ends up with exactly
what you asked for. `mp4ChapterStyle` is ignored for MP3 (which always writes
ID3v2 `CHAP` frames).

## Chapter end times

- **MP3**: `endTimeMs` is part of the `CHAP` frame. If you omit it when writing,
  it's filled from the next chapter's start time — and from the track duration
  for the last chapter.
- **MP4**: chapters are start-time-only on disk, so `endTimeMs` is always
  _inferred_ on read (the next chapter's start, or `audioProperties().durationMs`
  for the last one) and ignored on write.

## Clearing chapters

```typescript
file.setChapters([]); // removes all chapter structures
file.save();
```

## Examples

### List chapters as a table of contents

```typescript
const fmt = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

for (const ch of file.getChapters()) {
  console.log(`${fmt(ch.startTimeMs)}  ${ch.title ?? "(untitled)"}`);
}
```

### Build chapters from a cue list

```typescript
const cues = [
  { at: 0, name: "Opening" },
  { at: 132_500, name: "Topic 1" },
  { at: 945_000, name: "Topic 2" },
];

file.setChapters(cues.map((c) => ({ startTimeMs: c.at, title: c.name })));
file.save();
```

### Maximum compatibility for a podcast MP4

```typescript
using file = await taglib.open("episode.m4a");
file.setChapters(chapters, { mp4ChapterStyle: "both" });
file.save();
```

## See also

- [API Reference — Chapter Methods](https://charleswiltgen.github.io/TagLib-Wasm/api/#chapter-methods)
- [Broadcast Metadata (BWF bext / iXML)](./broadcast-metadata.md)
