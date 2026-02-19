/**
 * @fileoverview Detect if running inside a Deno compiled binary
 *
 * Shared by module-loader.ts and deno-compile.ts to avoid duplication.
 * Intentionally zero-dependency to prevent circular imports.
 */

export function isDenoCompiled(): boolean {
  return typeof Deno !== "undefined" &&
    typeof Deno.mainModule === "string" &&
    Deno.mainModule.includes("deno-compile://");
}
