# Working with Track Ratings

TagLib-Wasm provides a unified API for reading and writing track ratings that works consistently across all audio formats.

## Quick Start

```typescript
import { RatingUtils, TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
using file = await taglib.open("song.mp3");

// Read rating (normalized 0.0-1.0)
const rating = file.getRating();
if (rating !== undefined) {
  console.log(`Rating: ${RatingUtils.toStars(rating)} stars`);
}

// Set rating (4 out of 5 stars)
file.setRating(0.8);
file.save();
```

## Understanding Ratings

### Normalized Scale (0.0-1.0)

All ratings in TagLib-Wasm use a **normalized 0.0-1.0 scale**:

| Value | Meaning            |
| ----- | ------------------ |
| `0.0` | Unrated or 0 stars |
| `0.2` | 1 star             |
| `0.4` | 2 stars            |
| `0.6` | 3 stars            |
| `0.8` | 4 stars            |
| `1.0` | 5 stars            |

This normalized representation allows consistent handling across formats that use different native scales.

### Format Storage

| Format            | Storage Location | Native Scale |
| ----------------- | ---------------- | ------------ |
| MP3 (ID3v2)       | POPM frame       | 0-255 (POPM) |
| FLAC/OGG (Vorbis) | RATING comment   | 0.0-1.0      |
| MP4/M4A           | Custom atom      | Varies       |

TagLib-Wasm automatically converts between these formats.

## Rating Interface

```typescript
interface Rating {
  /** Normalized rating value (0.0-1.0) */
  rating: number;
  /** Optional rater identifier (email address) */
  email?: string;
  /** Optional play counter */
  counter?: number;
}
```

## AudioFile Methods

### Reading Ratings

```typescript
// Get the primary rating (undefined if no rating set)
const rating = file.getRating();

// Get all ratings (supports multiple raters)
const ratings = file.getRatings();
// Returns: Rating[]
```

### Writing Ratings

```typescript
// Set a single rating
file.setRating(0.8);

// Set rating with rater identifier
file.setRating(0.8, "user@example.com");

// Set multiple ratings
file.setRatings([
  { rating: 0.8, email: "user1@example.com" },
  { rating: 0.6, email: "user2@example.com" },
]);
```

## RatingUtils API Reference

Import the utilities:

```typescript
import { RatingUtils } from "taglib-wasm";
```

### POPM Conversion (ID3v2)

The POPM (Popularimeter) frame is used by ID3v2 tags in MP3 files. It uses a 0-255 scale with specific values for star ratings.

```typescript
// Normalized to POPM
RatingUtils.toPopm(0.8); // 196

// POPM to normalized
RatingUtils.fromPopm(196); // 0.8
```

**Standard POPM values** (Windows Media Player convention):

| Stars       | POPM Value | Normalized |
| ----------- | ---------- | ---------- |
| 0 (unrated) | 0          | 0.0        |
| 1           | 1          | 0.2        |
| 2           | 64         | 0.4        |
| 3           | 128        | 0.6        |
| 4           | 196        | 0.8        |
| 5           | 255        | 1.0        |

Access the mapping directly:

```typescript
RatingUtils.POPM_STAR_VALUES; // [0, 1, 64, 128, 196, 255]
```

### Star Rating Conversion

```typescript
// Normalized to stars (default 5-star scale)
RatingUtils.toStars(0.8); // 4
RatingUtils.toStars(0.8, 10); // 8 (10-star scale)

// Stars to normalized
RatingUtils.fromStars(4); // 0.8
RatingUtils.fromStars(8, 10); // 0.8
```

### Percentage Conversion

```typescript
// Normalized to percentage
RatingUtils.toPercent(0.8); // 80

// Percentage to normalized
RatingUtils.fromPercent(80); // 0.8
```

### Linear Conversion

For direct linear conversion without star-level quantization:

```typescript
// Normalized to raw 0-255 (linear)
RatingUtils.fromNormalized(0.8); // 204 (Math.round(0.8 * 255))

// Raw 0-255 to normalized (linear)
RatingUtils.toNormalized(204); // 0.8
```

### Validation

```typescript
// Check if rating is valid (0.0-1.0 range)
RatingUtils.isValid(0.8); // true
RatingUtils.isValid(1.5); // false
RatingUtils.isValid(NaN); // false

// Clamp to valid range
RatingUtils.clamp(1.5); // 1.0
RatingUtils.clamp(-0.5); // 0.0
```

## Examples

### Display Ratings in Different Formats

```typescript
const rating = file.getRating() ?? 0;

console.log(`Stars: ${RatingUtils.toStars(rating)}/5`);
console.log(`Percent: ${RatingUtils.toPercent(rating)}%`);
console.log(`POPM: ${RatingUtils.toPopm(rating)}`);
```

### Import Ratings from Another System

```typescript
// From a 10-star system
const tenStarRating = 7;
const normalized = RatingUtils.fromStars(tenStarRating, 10);
file.setRating(normalized);

// From percentage
const percentRating = 75;
file.setRating(RatingUtils.fromPercent(percentRating));
```

### Batch Update Ratings

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();

const files = ["track1.mp3", "track2.mp3", "track3.mp3"];
const ratings = [0.8, 0.6, 1.0]; // 4, 3, 5 stars

for (let i = 0; i < files.length; i++) {
  using file = await taglib.open(files[i]);
  file.setRating(ratings[i]);
  file.save();
}
```

## Format-Specific Notes

### MP3 (ID3v2 POPM)

- Supports multiple ratings via different email identifiers
- Play counter is stored alongside rating
- Uses non-linear POPM scale (WMP convention)

### FLAC/OGG (Vorbis Comments)

- Rating stored in `RATING` comment field
- Uses native 0.0-1.0 scale (no conversion needed)

### MP4/M4A

- Rating support varies by player/tagger
- Some use custom atoms, others use iTunes-style metadata
