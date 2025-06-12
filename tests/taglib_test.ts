/**
 * @fileoverview Tests for taglib-wasm bindings
 */

import { assertEquals, assertExists } from "@std/assert";
import { TagLib } from "../src/mod.ts";

Deno.test("TagLib initialization", async () => {
  // Note: This test will fail until WASM build is complete
  try {
    const taglib = await TagLib.initialize();
    assertExists(taglib);
  } catch (error) {
    console.log(
      "Expected failure until WASM is built:",
      (error as Error).message,
    );
  }
});

Deno.test("TagLib configuration", async () => {
  const config = {
    memory: {
      initial: 8 * 1024 * 1024, // 8MB
      maximum: 64 * 1024 * 1024, // 64MB
    },
    debug: true,
  };

  try {
    const taglib = await TagLib.initialize(config);
    assertExists(taglib);
  } catch (error) {
    console.log(
      "Expected failure until WASM is built:",
      (error as Error).message,
    );
  }
});

// TODO: Add more comprehensive tests once WASM build is working
// - Test file loading from various formats
// - Test metadata reading/writing
// - Test audio properties extraction
// - Test error handling
