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
