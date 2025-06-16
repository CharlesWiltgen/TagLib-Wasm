/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno global for TypeScript when not in Deno environment
declare global {
  const Deno: any;
}

export {};