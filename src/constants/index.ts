/**
 * @fileoverview Main export barrel for constants module
 * Maintains backward compatibility by re-exporting all constants and utilities
 */

// Re-export all property definitions and types
export * from "./properties.ts";

// Re-export tag constants
export * from "./tags.ts";

// Re-export format mappings
export * from "./format-mappings.ts";

// Re-export all utility functions
export * from "./utilities.ts";

// Re-export complex property types and constants
export * from "./complex-properties.ts";
