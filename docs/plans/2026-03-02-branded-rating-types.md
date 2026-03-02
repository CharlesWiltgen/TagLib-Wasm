# Branded Rating Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `NormalizedRating` and `PopmRating` branded types to the `RatingUtils` conversion pipeline to prevent scale-confusion bugs at compile time.

**Architecture:** Two branded number types colocated in `src/utils/rating.ts`. Zero-cost constructor functions (`normalized()`, `popm()`) create branded values. Conversion functions accept/return branded types. Public `AudioFile` API stays unbranded — plain `number`.

**Tech Stack:** TypeScript branded types (no runtime dependencies)

**Design doc:** `docs/plans/2026-03-02-branded-rating-types-design.md`

---

### Task 1: Add Brand type and branded rating types

**Files:**

- Modify: `src/utils/rating.ts:1-32`

**Step 1: Add types at top of file**

Add after the module docstring (before the first `export function`), keeping the existing docstring intact:

```typescript
type Brand<T, K extends string> = T & { readonly __brand: K };

/** Normalized rating value (0.0-1.0 scale). */
export type NormalizedRating = Brand<number, "NormalizedRating">;

/** POPM rating value (0-255 scale, as used in ID3v2 Popularimeter frames). */
export type PopmRating = Brand<number, "PopmRating">;
```

**Step 2: Add constructor functions**

Add right after the type definitions:

```typescript
/** Create a NormalizedRating from a plain number. */
export function normalized(value: number): NormalizedRating {
  return value as NormalizedRating;
}

/** Create a PopmRating from a plain number. */
export function popm(value: number): PopmRating {
  return value as PopmRating;
}
```

**Step 3: Run typecheck**

Run: `deno task check` or `deno check src/utils/rating.ts`
Expected: PASS (new types/functions added, nothing broken yet)

**Step 4: Commit**

```bash
git add src/utils/rating.ts
git commit -m "feat: add NormalizedRating and PopmRating branded types"
```

---

### Task 2: Update conversion function signatures

**Files:**

- Modify: `src/utils/rating.ts`

**Step 1: Update all conversion function signatures**

Change each function signature (implementation bodies stay identical — branded types are zero-cost casts):

| Function         | Old signature                             | New signature                                  |
| ---------------- | ----------------------------------------- | ---------------------------------------------- |
| `toNormalized`   | `(popm: number): number`                  | `(value: PopmRating): NormalizedRating`        |
| `fromNormalized` | `(normalized: number): number`            | `(value: NormalizedRating): PopmRating`        |
| `toStars`        | `(normalized: number, maxStars?): number` | `(value: NormalizedRating, maxStars?): number` |
| `fromStars`      | `(stars: number, maxStars?): number`      | `(stars: number, maxStars?): NormalizedRating` |
| `toPopm`         | `(normalized: number): number`            | `(value: NormalizedRating): PopmRating`        |
| `fromPopm`       | `(popm: number): number`                  | `(value: PopmRating): NormalizedRating`        |
| `toPercent`      | `(normalized: number): number`            | `(value: NormalizedRating): number`            |
| `fromPercent`    | `(percent: number): number`               | `(percent: number): NormalizedRating`          |
| `clamp`          | `(rating: number): number`                | `(rating: number): NormalizedRating`           |
| `isValid`        | `(rating: number): boolean`               | `(rating: number): rating is NormalizedRating` |

For `toNormalized` and `fromNormalized`, also rename the parameter from `popm`/`normalized` to `value` to avoid shadowing the constructor functions.

Implementation bodies remain unchanged — return types are structurally compatible.

**Step 2: Update RatingUtils namespace**

Add the new constructors to the `RatingUtils` const:

```typescript
export const RatingUtils = {
  normalized,
  popm,
  toNormalized,
  fromNormalized,
  toStars,
  fromStars,
  toPopm,
  fromPopm,
  toPercent,
  fromPercent,
  clamp,
  isValid,
  POPM_STAR_VALUES,
} as const;
```

**Step 3: Run typecheck**

Run: `deno check src/utils/rating.ts`
Expected: PASS (branded types are structurally compatible with number)

**Step 4: Commit**

```bash
git add src/utils/rating.ts
git commit -m "feat: brand RatingUtils conversion pipeline with NormalizedRating/PopmRating"
```

---

### Task 3: Update existing tests for branded types

**Files:**

- Modify: `tests/complex-properties.test.ts`

The existing tests pass plain `number` literals to conversion functions. These now require branded types. Update all call sites to use the `normalized()` and `popm()` constructors.

**Step 1: Add imports**

Add `normalized` and `popm` to the import from `../src/utils/rating.ts`:

```typescript
import {
  clamp,
  fromNormalized,
  fromPercent,
  fromPopm,
  fromStars,
  isValid,
  normalized,
  popm,
  RatingUtils,
  toNormalized,
  toPercent,
  toPopm,
  toStars,
} from "../src/utils/rating.ts";
```

**Step 2: Update "Rating Utility Functions" tests**

Wrap plain number arguments with the appropriate constructor:

- `toNormalized(0)` → `toNormalized(popm(0))`
- `toNormalized(128)` → `toNormalized(popm(128))`
- `toNormalized(255)` → `toNormalized(popm(255))`
- `fromNormalized(0)` → `fromNormalized(normalized(0))`
- `fromNormalized(0.5)` → `fromNormalized(normalized(0.5))`
- `fromNormalized(1)` → `fromNormalized(normalized(1))`
- `toStars(0)` → `toStars(normalized(0))`
- `toStars(0.5)` → `toStars(normalized(0.5))`
- `toStars(0.8)` → `toStars(normalized(0.8))`
- `toStars(1.0)` → `toStars(normalized(1.0))`
- `toStars(0.5, 10)` → `toStars(normalized(0.5), 10)`
- `toPopm(0)` → `toPopm(normalized(0))`
- `toPopm(0.2)` → `toPopm(normalized(0.2))` (etc. for all `toPopm` calls)
- `fromPopm(0)` → `fromPopm(popm(0))` (etc. for all `fromPopm` calls)
- `toPercent(0)` → `toPercent(normalized(0))` (etc. for all `toPercent` calls)

**Step 3: Update "Roundtrip Tests"**

- Normalized roundtrip: `toNormalized(i)` → `toNormalized(popm(i))`, `fromNormalized(normalized)` → `fromNormalized(normalizedVal)` (rename to avoid shadowing constructor)
- Stars roundtrip: `toStars(normalized)` → `toStars(normalizedVal)` (the `fromStars` return is already `NormalizedRating`)
- POPM roundtrip: `fromPopm(popm)` → `fromPopm(popm(p))` (rename loop var to avoid shadowing constructor, e.g. `for (const p of popmValues)`)

**Step 4: Add RatingUtils namespace test for new constructors**

Add to the existing `RatingUtils namespace - exports all utilities` test:

```typescript
assertExists(RatingUtils.normalized);
assertExists(RatingUtils.popm);
```

**Step 5: Run all tests**

Run: `deno test tests/complex-properties.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add tests/complex-properties.test.ts
git commit -m "test: update rating tests for branded type constructors"
```

---

### Task 4: Add type-safety compile tests

**Files:**

- Modify: `tests/complex-properties.test.ts`

Add a new describe block that verifies branded types prevent misuse at compile time. These tests use `@ts-expect-error` — they pass if the code underneath is a type error.

**Step 1: Add compile-time safety tests**

```typescript
describe("Branded Type Safety", () => {
  it("prevents passing PopmRating where NormalizedRating expected", () => {
    const p = popm(196);
    // @ts-expect-error PopmRating not assignable to NormalizedRating
    fromNormalized(p);
  });

  it("prevents passing NormalizedRating where PopmRating expected", () => {
    const n = normalized(0.8);
    // @ts-expect-error NormalizedRating not assignable to PopmRating
    toNormalized(n);
  });

  it("prevents passing plain number where branded type expected", () => {
    const plain = 0.8;
    // @ts-expect-error number not assignable to NormalizedRating
    fromNormalized(plain);
    // @ts-expect-error number not assignable to PopmRating
    toNormalized(plain);
  });

  it("allows branded values to be used as numbers", () => {
    const n = normalized(0.8);
    const p = popm(196);
    // Branded types extend number, so arithmetic works
    assertEquals(n + 0.1 > 0, true);
    assertEquals(p - 1 >= 0, true);
  });
});
```

**Step 2: Run tests**

Run: `deno test tests/complex-properties.test.ts`
Expected: All tests PASS (the `@ts-expect-error` lines suppress the expected type errors; the arithmetic test confirms branded values work as numbers)

**Step 3: Commit**

```bash
git add tests/complex-properties.test.ts
git commit -m "test: add compile-time branded type safety tests"
```

---

### Task 5: Export types from index.ts

**Files:**

- Modify: `index.ts:203-204`

**Step 1: Add type exports**

Update the rating exports section:

```typescript
// Rating conversion utilities (individual functions available via taglib-wasm/rating)
export { RatingUtils } from "./src/utils/rating.ts";
export type { NormalizedRating, PopmRating } from "./src/utils/rating.ts";
```

**Step 2: Run typecheck**

Run: `deno check index.ts`
Expected: PASS

**Step 3: Run full test suite**

Run: `deno task test`
Expected: All tests PASS (format, lint, typecheck, tests)

**Step 4: Commit**

```bash
git add index.ts
git commit -m "feat: export NormalizedRating and PopmRating branded types"
```

---

### Task 6: Format, lint, final verification

**Step 1: Format**

Run: `deno task fmt`

**Step 2: Lint**

Run: `deno task lint`

**Step 3: Full test suite**

Run: `deno task test`
Expected: All checks pass

**Step 4: Commit any formatting changes, push**

```bash
git add -A
git commit -m "chore: format branded rating types"
git push
```
