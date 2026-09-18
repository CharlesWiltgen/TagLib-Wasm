/**
 * Cross-platform path utilities that work in Deno, Node, Bun, and browsers
 * without depending on @std/path or node:path.
 */

/**
 * Convert a file:// URL to an OS filesystem path.
 * On Windows, url.pathname returns "/C:/path" — this strips the leading slash.
 */
export function fileUrlToPath(url: URL): string {
  const p = decodeURIComponent(url.pathname);
  // Windows: pathname starts with /C: or /c: — strip the leading /
  if (/^\/[A-Za-z]:/.test(p)) return p.slice(1);
  return p;
}

/** Extract the filename from a path (handles both / and \ separators). */
export function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i === -1 ? path : path.slice(i + 1);
}

/** Join path segments with the OS-appropriate separator. */
export function joinPath(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .join("/")
    .replaceAll(/\/+/g, "/");
}

/**
 * The host path behind a WASI path, given the preopen map the guest was started
 * with (`WasiHostLoaderConfig.preopens`): the inverse of the virtual-path
 * mapping the host resolves `path_open` through, and the only way host-side code
 * can read the same file the guest reads. On Windows the map is the drive list
 * (`{"/C": "C:\\"}`), so `/C/music/a.mp3` is `C:\music\a.mp3`; on POSIX it is
 * the identity (`{"/": "/"}`).
 *
 * Returns undefined for a path no preopen covers — the guest cannot open that
 * path either, so there is nothing on the host side to read.
 */
export function hostPathForPreopens(
  wasiPath: string,
  preopens: Record<string, string>,
): string | undefined {
  let best:
    | { realPath: string; rest: string; prefixLength: number }
    | undefined;
  for (const [virtualPath, realPath] of Object.entries(preopens)) {
    const prefix = virtualPath.replace(/\/+$/, "");
    if (wasiPath === prefix) {
      return realPath;
    }
    if (!wasiPath.startsWith(`${prefix}/`)) continue;
    // The longest virtual prefix wins, so a preopen nested inside another (a
    // root plus one directory) cannot be shadowed by the shorter of the two.
    if (best && prefix.length <= best.prefixLength) continue;
    best = {
      realPath,
      rest: wasiPath.slice(prefix.length + 1),
      prefixLength: prefix.length,
    };
  }
  if (!best) return undefined;
  return joinPath(best.realPath, best.rest);
}
