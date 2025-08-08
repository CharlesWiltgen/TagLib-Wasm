/**
 * Memory safety tests for Arena allocator
 * Verifies correct allocation, growth, reset, and cleanup behavior
 */

import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertNotEquals } from "@std/assert";

// Mock arena implementation for testing the interface
// In actual tests, this would call into the WASI module
interface MockArena {
  ptr: Uint8Array;
  size: number;
  used: number;
}

class ArenaTestHelper {
  private arenas: Map<number, MockArena> = new Map();
  private nextId = 1;

  create(initialSize: number): number {
    const arena: MockArena = {
      ptr: new Uint8Array(initialSize),
      size: initialSize,
      used: 0,
    };

    const id = this.nextId++;
    this.arenas.set(id, arena);
    return id;
  }

  alloc(arenaId: number, size: number): number | null {
    const arena = this.arenas.get(arenaId);
    if (!arena) return null;

    // Align to 8-byte boundaries
    const alignedSize = (size + 7) & ~7;

    if (arena.used + alignedSize > arena.size) {
      // Grow arena (double size)
      let newSize = arena.size * 2;
      while (newSize < arena.used + alignedSize) {
        newSize *= 2;
      }

      const newPtr = new Uint8Array(newSize);
      newPtr.set(arena.ptr);
      arena.ptr = newPtr;
      arena.size = newSize;
    }

    const offset = arena.used;
    arena.used += alignedSize;
    return offset;
  }

  reset(arenaId: number): boolean {
    const arena = this.arenas.get(arenaId);
    if (!arena) return false;

    arena.used = 0;
    return true;
  }

  destroy(arenaId: number): boolean {
    return this.arenas.delete(arenaId);
  }

  getStats(arenaId: number) {
    const arena = this.arenas.get(arenaId);
    if (!arena) return null;

    return {
      size: arena.size,
      used: arena.used,
      available: arena.size - arena.used,
      utilization: arena.used / arena.size,
    };
  }
}

describe("Arena Memory Management", () => {
  let helper: ArenaTestHelper;

  beforeEach(() => {
    helper = new ArenaTestHelper();
  });

  describe("Arena creation", () => {
    it("should create arena with specified initial size", () => {
      const arenaId = helper.create(1024);
      assert(arenaId > 0);

      const stats = helper.getStats(arenaId);
      assertEquals(stats?.size, 1024);
      assertEquals(stats?.used, 0);
      assertEquals(stats?.available, 1024);
    });

    it("should handle multiple arena creation", () => {
      const arena1 = helper.create(1024);
      const arena2 = helper.create(2048);
      const arena3 = helper.create(512);

      assertNotEquals(arena1, arena2);
      assertNotEquals(arena2, arena3);
      assertNotEquals(arena1, arena3);

      assertEquals(helper.getStats(arena1)?.size, 1024);
      assertEquals(helper.getStats(arena2)?.size, 2048);
      assertEquals(helper.getStats(arena3)?.size, 512);
    });
  });

  describe("Memory allocation", () => {
    it("should allocate memory within arena", () => {
      const arenaId = helper.create(1024);

      const ptr1 = helper.alloc(arenaId, 100);
      assertEquals(ptr1, 0); // First allocation at offset 0

      const ptr2 = helper.alloc(arenaId, 200);
      assertEquals(ptr2, 104); // Second allocation (aligned to 8 bytes: 100 + 4 padding)

      const stats = helper.getStats(arenaId);
      assertEquals(stats?.used, 312); // 104 + 208 (200 + 8 padding)
    });

    it("should align allocations to 8-byte boundaries", () => {
      const arenaId = helper.create(1024);

      const ptr1 = helper.alloc(arenaId, 1); // Will be aligned to 8
      const ptr2 = helper.alloc(arenaId, 1); // Will be aligned to 8

      expect(ptr2).toBe(8); // 8-byte aligned

      const ptr3 = helper.alloc(arenaId, 15); // Will be aligned to 16
      const ptr4 = helper.alloc(arenaId, 1); // Next 8-byte boundary

      expect(ptr4).toBe(32); // 16 + 16 (15 aligned to 16)
    });

    it("should grow arena when needed", () => {
      const arenaId = helper.create(100); // Small arena

      // Allocate more than initial size
      const ptr1 = helper.alloc(arenaId, 50);
      const ptr2 = helper.alloc(arenaId, 60); // This should trigger growth

      expect(ptr1).toBe(0);
      expect(ptr2).not.toBeNull();

      const stats = helper.getStats(arenaId);
      expect(stats?.size).toBeGreaterThan(100); // Arena should have grown
    });

    it("should handle large allocations", () => {
      const arenaId = helper.create(1024);

      const ptr = helper.alloc(arenaId, 10000); // Larger than arena
      expect(ptr).not.toBeNull();

      const stats = helper.getStats(arenaId);
      expect(stats?.size).toBeGreaterThanOrEqual(10008); // At least the allocation size
    });

    it("should handle zero-size allocations", () => {
      const arenaId = helper.create(1024);

      const ptr = helper.alloc(arenaId, 0);
      expect(ptr).toBe(0); // Valid allocation, just returns current position

      const stats = helper.getStats(arenaId);
      expect(stats?.used).toBe(0); // No space consumed
    });
  });

  describe("Arena reset", () => {
    it("should reset arena usage to zero", () => {
      const arenaId = helper.create(1024);

      helper.alloc(arenaId, 500);
      let stats = helper.getStats(arenaId);
      expect(stats?.used).toBeGreaterThan(0);

      const success = helper.reset(arenaId);
      expect(success).toBe(true);

      stats = helper.getStats(arenaId);
      expect(stats?.used).toBe(0);
      expect(stats?.available).toBe(stats?.size);
    });

    it("should preserve arena size after reset", () => {
      const arenaId = helper.create(1024);

      helper.alloc(arenaId, 2000); // Force growth
      const sizeAfterGrowth = helper.getStats(arenaId)?.size;

      helper.reset(arenaId);
      const sizeAfterReset = helper.getStats(arenaId)?.size;

      expect(sizeAfterReset).toBe(sizeAfterGrowth); // Size preserved
    });

    it("should allow new allocations after reset", () => {
      const arenaId = helper.create(1024);

      helper.alloc(arenaId, 500);
      helper.reset(arenaId);

      const ptr = helper.alloc(arenaId, 100);
      expect(ptr).toBe(0); // Allocation starts from beginning again
    });
  });

  describe("Arena destruction", () => {
    it("should destroy arena and free resources", () => {
      const arenaId = helper.create(1024);

      helper.alloc(arenaId, 500);
      const success = helper.destroy(arenaId);
      expect(success).toBe(true);

      // Arena should no longer exist
      const stats = helper.getStats(arenaId);
      expect(stats).toBeNull();
    });

    it("should handle destruction of non-existent arena", () => {
      const success = helper.destroy(999); // Non-existent ID
      expect(success).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should handle operations on non-existent arena", () => {
      const ptr = helper.alloc(999, 100); // Non-existent arena
      expect(ptr).toBeNull();

      const success = helper.reset(999);
      expect(success).toBe(false);
    });

    it("should handle edge case sizes", () => {
      const arenaId = helper.create(1);
      expect(arenaId).toBeGreaterThan(0);

      const ptr = helper.alloc(arenaId, 1000);
      expect(ptr).not.toBeNull(); // Should work even with tiny initial size
    });
  });

  describe("Memory usage patterns", () => {
    it("should handle typical MessagePack decoding pattern", () => {
      const arenaId = helper.create(4096); // 4KB typical size

      // Simulate decoding tag data
      const tagDataPtr = helper.alloc(arenaId, 64); // TagData struct
      const titlePtr = helper.alloc(arenaId, 50); // Title string
      const artistPtr = helper.alloc(arenaId, 30); // Artist string
      const albumPtr = helper.alloc(arenaId, 40); // Album string

      expect(tagDataPtr).not.toBeNull();
      expect(titlePtr).not.toBeNull();
      expect(artistPtr).not.toBeNull();
      expect(albumPtr).not.toBeNull();

      const stats = helper.getStats(arenaId);
      expect(stats?.utilization).toBeLessThan(0.1); // Should use < 10% of arena
    });

    it("should handle high-frequency allocation/reset pattern", () => {
      const arenaId = helper.create(1024);

      // Simulate processing many files
      for (let i = 0; i < 100; i++) {
        helper.alloc(arenaId, 100);
        helper.alloc(arenaId, 50);
        helper.alloc(arenaId, 75);

        if (i % 10 === 9) {
          helper.reset(arenaId); // Reset every 10 iterations
        }
      }

      const stats = helper.getStats(arenaId);
      expect(stats?.size).toBeGreaterThanOrEqual(1024); // Arena should still be functional
    });
  });

  // Note: WASI integration tests will be added once WASM module is built
});

export { ArenaTestHelper };
