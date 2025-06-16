/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno global for TypeScript when not in Deno environment
declare global {
  // Only declare if not already defined by Deno runtime
  // @ts-ignore: Suppress duplicate identifier error in Deno
  const Deno: any;
}

export {};
