/**
 * Pure disc-folder grammar and album grouping — no Wasm, no runtime deps.
 *
 * @module disc-folder
 *
 * Import from this subpath when all you need is `discFolderInfo` (or the pure
 * `groupAlbums` core): unlike the main entry or `./folder`, this module's
 * graph contains no Wasm loader, so it works in browsers and UI contexts
 * without ever loading TagLib. CI guards the property (taglib-cd7b) — if a
 * future change pulls a non-pure import into this graph, the build fails.
 *
 * ```typescript
 * import { discFolderInfo } from "taglib-wasm/disc-folder";
 * discFolderInfo("CD1"); // { kind: "exact", number: 1, ... }
 * ```
 */
// taglib-ys7m: the grouping surface now spans four modules; export the public
// names explicitly so internal helpers (DiscParse, OkItem, ...) stay private.
export { discFolderInfo } from "./src/folder-api/folder-disc.ts";
export { groupAlbums } from "./src/folder-api/album-grouping.ts";
export type {
  AlbumDisc,
  AlbumGroup,
  AlbumGroupingResult,
  AlbumGroupItem,
  AlbumGroupKey,
  DiscConfidence,
  DiscFolderInfo,
  GroupAlbumsOptions,
} from "./src/folder-api/album-types.ts";
export type { FolderScanResult } from "./src/folder-api/types.ts";
