/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno global for TypeScript when not in Deno environment
declare global {
  // @ts-expect-error: Suppress redeclaration error in Deno environment
  // deno-lint-ignore no-explicit-any
  namespace Deno {
    // These must be `any` (not `unknown`) because wasi-fs-deno.ts and
    // platform-io.ts call methods on these types. In Deno, real types
    // override these stubs; in Node.js tsc, `unknown` would break the build.
    // deno-lint-ignore no-explicit-any
    type FsFile = any;
    // deno-lint-ignore no-explicit-any
    type SeekMode = any;
    // deno-lint-ignore no-explicit-any
    type OpenOptions = any;
    // deno-lint-ignore no-explicit-any
    type ChildProcess = any;
    // deno-lint-ignore no-explicit-any
    type CommandStatus = any;
  }

  // @ts-expect-error: Suppress duplicate identifier error in Deno
  // deno-lint-ignore no-explicit-any
  const Deno: any;
}

export {};
