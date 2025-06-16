/**
 * @fileoverview Comprehensive test suite for taglib-wasm
 *
 * This file imports and runs all test modules to ensure complete coverage.
 * Individual test files can still be run separately for focused testing.
 */

// Core functionality tests
import "./taglib.test.ts";

// Picture/cover art functionality tests
import "./picture-api.test.ts";

// Edge case tests - Unicode handling and input validation
import "./edge-cases.test.ts";

// Error handling tests - Error messages and type guards
import "./error-handling.test.ts";

// Memory management tests
import "./memory.test.ts";

// Extended metadata tests - MusicBrainz, ReplayGain, AcoustID, Apple Sound Check
import "./extended-metadata.test.ts";

// Note: Workers tests (test-workers.ts) are manual utilities
// Run manually with: deno run --allow-read tools/test-workers.ts
