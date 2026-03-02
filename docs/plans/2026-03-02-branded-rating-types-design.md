# Branded Rating Types

**Issue**: taglib-wasm-aw9
**Date**: 2026-03-02
**Status**: Approved

## Problem

`RatingUtils` converts between three numeric scales (normalized 0.0-1.0, POPM 0-255, stars 0-N), all typed as plain `number`. Nothing prevents passing a POPM value to `fromNormalized()` or double-converting a value that's already normalized.

## Decision

Brand the `RatingUtils` conversion pipeline. Leave the public `AudioFile` API unbranded.

### Why pipeline-only

Branded public APIs are a hallmark of type-system-focused libraries (Effect-TS, Prisma), not domain libraries. Audio metadata libraries should accept plain numbers in their public API to match ecosystem conventions and keep DX clean.

The real confusion risk is inside conversion pipelines — calling `fromNormalized` vs `toNormalized` and losing track of which scale a variable is in. This rarely happens when calling `setRating(0.8)` because you're thinking about the rating, not the encoding.

### Scoped out

- **StarRating brand**: Stars are a display concern, not stored or transmitted. Nobody mistakes `4` for a normalized rating.
- **Property key branding**: `PropertyKey` is already a typed union. Wire keys are only used in ~3 internal files.
- **File handle branding**: File handles are objects, not primitives. Branding doesn't apply.

## Design

### Types (in `src/utils/rating.ts`)

```typescript
type Brand<T, K extends string> = T & { readonly __brand: K };

export type NormalizedRating = Brand<number, "NormalizedRating">; // 0.0-1.0
export type PopmRating = Brand<number, "PopmRating">; // 0-255
```

### Constructors (zero-cost casts)

```typescript
export function normalized(value: number): NormalizedRating;
export function popm(value: number): PopmRating;
```

No runtime validation — branding is a compile-time concern. Runtime validation remains the job of `isValid()` and `clamp()`.

### Conversion functions (updated signatures)

```typescript
export function toNormalized(popm: PopmRating): NormalizedRating;
export function fromNormalized(normalized: NormalizedRating): PopmRating;
export function toPopm(normalized: NormalizedRating): PopmRating;
export function fromPopm(popm: PopmRating): NormalizedRating;
export function toStars(
  normalized: NormalizedRating,
  maxStars?: number,
): number;
export function fromStars(stars: number, maxStars?: number): NormalizedRating;
export function toPercent(normalized: NormalizedRating): number;
export function fromPercent(percent: number): NormalizedRating;
export function clamp(rating: number): NormalizedRating;
export function isValid(rating: number): rating is NormalizedRating;
```

### Public API (unchanged)

```typescript
getRating(): number | undefined;
setRating(rating: number, email?: string): void;
interface Rating { rating: number; email?: string; counter?: number; }
```

## What this catches

```typescript
// Mistake: passing POPM value where NormalizedRating expected
fromNormalized(popm(196)); // Compile error

// Mistake: double-converting
toNormalized(toNormalized(popm(196))); // Compile error
```

## Files touched

- `src/utils/rating.ts` — add types, constructors, update signatures
- `src/utils/rating.test.ts` — update tests for branded types
