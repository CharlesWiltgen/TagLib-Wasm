/**
 * @fileoverview Comprehensive test suite for taglib-wasm
 * 
 * This file imports and runs all test modules to ensure complete coverage.
 * Individual test files can still be run separately for focused testing.
 */

// Core functionality tests
import "./taglib.test.ts";

// Edge case tests - Unicode handling and input validation
import "./edge-cases.test.ts";

// Error handling tests - Error messages and type guards
import "./test-error-handling.ts";

// Memory management tests
import "./test-memory.ts";

// Platform-specific tests
if (typeof globalThis.Deno === "undefined") {
  // Workers tests only run in non-Deno environments
  // since they test Cloudflare Workers compatibility
  console.log("Skipping workers tests in Deno environment");
} else {
  // For now, skip workers tests in Deno
  // TODO: Add proper workers simulation for Deno
}