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
