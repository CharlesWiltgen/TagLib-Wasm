// Entry contract for the Wasm-free disc-folder subpath (taglib-cd7b): the
// root disc-folder.ts entry must export the pure grammar. The Wasm-free
// property itself is enforced by the CI metafile guard in the bundle job —
// this test defends the export surface.
import { assertEquals } from "@std/assert";
import { discFolderInfo, groupAlbums } from "../disc-folder.ts";

Deno.test("disc-folder subpath exports the pure grammar", () => {
  assertEquals(typeof discFolderInfo, "function");
  assertEquals(typeof groupAlbums, "function");
  assertEquals(discFolderInfo("CD1")?.number, 1);
  assertEquals(discFolderInfo("Greatest Hits"), undefined);
});
