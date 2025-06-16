/**
 * @fileoverview Memory management tests for taglib-wasm
 */

import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod";
import { TagLib } from "../index";
import { TEST_FILES } from "./test-utils";

const TEST_FILE = TEST_FILES.mp3;

Deno.test("dispose() prevents memory accumulation", async () => {
  const taglib = await TagLib.initialize();
  
  // Get initial heap size if available
  const getHeapSize = () => {
    if ((taglib as any).module && (taglib as any).module.HEAP8) {
      return (taglib as any).module.HEAP8.byteLength;
    }
    return 0;
  };
  
  const initialHeap = getHeapSize();
  
  // Open and dispose multiple times
  for (let i = 0; i < 10; i++) {
    const audioFile = await taglib.open(TEST_FILE);
    const tag = audioFile.tag();
    
    // Do some operations - just access the properties
    const _ = tag.title;
    const __ = tag.artist;
    const ___ = tag.album;
    
    // Dispose should free memory
    audioFile.dispose();
  }
  
  const finalHeap = getHeapSize();
  
  // Heap shouldn't grow significantly (allow some variance for other allocations)
  if (initialHeap > 0 && finalHeap > 0) {
    const growth = finalHeap - initialHeap;
    const growthMB = growth / 1024 / 1024;
    console.log(`Heap growth after 10 open/dispose cycles: ${growthMB.toFixed(2)}MB`);
    
    // Should be less than 1MB growth for 10 iterations of a small file
    assertEquals(growthMB < 1, true, `Excessive heap growth: ${growthMB.toFixed(2)}MB`);
  }
});

Deno.test("dispose() can be called multiple times safely", async () => {
  const taglib = await TagLib.initialize();
  const audioFile = await taglib.open(TEST_FILE);
  
  // First dispose
  audioFile.dispose();
  
  // Second dispose should not throw
  audioFile.dispose();
  
  // Third dispose should also be safe
  audioFile.dispose();
  
  // Attempting to use after dispose should not crash
  try {
    audioFile.tag();
  } catch (e) {
    // Expected to fail, but shouldn't crash the process
    console.log("Expected error after dispose:", e.message);
  }
});

Deno.test("memory usage scales with file size", async () => {
  const taglib = await TagLib.initialize();
  
  const files = [
    TEST_FILES.wav,  // Larger
    TEST_FILES.mp3,  // Smaller
  ];
  
  const getHeapSize = () => {
    if ((taglib as any).module && (taglib as any).module.HEAP8) {
      return (taglib as any).module.HEAP8.byteLength;
    }
    return 0;
  };
  
  for (const file of files) {
    const beforeOpen = getHeapSize();
    
    const audioFile = await taglib.open(file);
    const afterOpen = getHeapSize();
    
    const fileInfo = await Deno.stat(file);
    const fileSizeMB = fileInfo.size / 1024 / 1024;
    
    audioFile.dispose();
    const afterDispose = getHeapSize();
    
    if (beforeOpen > 0) {
      const loadIncrease = (afterOpen - beforeOpen) / 1024 / 1024;
      const disposeDecrease = (afterOpen - afterDispose) / 1024 / 1024;
      
      console.log(`File: ${file} (${fileSizeMB.toFixed(2)}MB)`);
      console.log(`  Load increase: ${loadIncrease.toFixed(2)}MB`);
      console.log(`  Dispose freed: ${disposeDecrease.toFixed(2)}MB`);
    }
  }
});