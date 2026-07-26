import { assert, assertEquals } from "@std/assert";
import { EXTRA_FIELDS } from "./extra-state-registry.ts";
import { PASSTHROUGH_KEYS } from "../msgpack/encoder.ts";

// Control/meta keys in PASSTHROUGH_KEYS that are NOT standalone editable
// metadata: save directives (_stripId3, _mp4ItemNames), a chapter-save hint
// carried with chapters (_mp4ChapterStyle), and read-only info (id3Tags).
// Everything else is reconstructable state the registry must carry.
const CONTROL_KEYS = new Set([
  "_mp4ChapterStyle",
  "id3Tags",
  "_stripId3",
  // Exact MP4 atom names: a write-time directive recomputed at each write site
  // from the PROPERTIES table, not state carried on the handle — so it needs no
  // EXTRA_FIELDS entry. The reconstruct in save-reconstruct.ts recomputes it,
  // which is what stops saveToFile() silently reverting atom casing.
  "_mp4ItemNames",
]);

Deno.test("extra-state registry covers every passthrough data field", () => {
  const registered = new Set(EXTRA_FIELDS.map((f) => f.name));
  const dataKeys = [...PASSTHROUGH_KEYS].filter((k) => !CONTROL_KEYS.has(k));

  for (const key of dataKeys) {
    assert(
      registered.has(key),
      `extra-state registry is missing "${key}". A new passthrough metadata ` +
        `field must get an EXTRA_FIELDS entry, or it is silently dropped on ` +
        `partial-load / save-as reconstruct (the taglib-upg bug class).`,
    );
  }

  // No stray registry entries either — keeps the two in lock-step.
  assertEquals(
    [...registered].sort(),
    dataKeys.sort(),
    "EXTRA_FIELDS and PASSTHROUGH_KEYS (minus control keys) have diverged",
  );
});
