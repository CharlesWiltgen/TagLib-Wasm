// Memory management with pooling for TagLib-Wasm
#include "taglib_core.h"
#include <cstdlib>
#include <cstring>
#include <vector>
#include <algorithm>
#include <mutex>
#include <memory>
#include <atomic>

struct MemoryBlock {
    std::unique_ptr<uint8_t, decltype(&std::free)> data;
    size_t size;
    size_t used;
    std::unique_ptr<MemoryBlock> next;
    
    // Constructor to initialize the custom deleter
    MemoryBlock() : data(nullptr, &std::free), size(0), used(0), next(nullptr) {}
    
    // Destructor is automatically handled by unique_ptr
    ~MemoryBlock() = default;
    
    // Move-only semantics (no copying memory blocks)
    MemoryBlock(const MemoryBlock&) = delete;
    MemoryBlock& operator=(const MemoryBlock&) = delete;
    MemoryBlock(MemoryBlock&&) = default;
    MemoryBlock& operator=(MemoryBlock&&) = default;
};

struct tl_pool {
    // Thread safety
    mutable std::mutex pool_mutex;
    
    // Memory blocks (RAII managed)
    std::unique_ptr<MemoryBlock> first_block;
    MemoryBlock* current_block;  // Non-owning pointer to current block
    size_t default_block_size;
    
    // Statistics (atomic for lock-free reads)
    std::atomic<size_t> total_allocated{0};
    std::atomic<size_t> total_used{0};
    
    // Large allocations (protected by mutex)
    std::vector<std::unique_ptr<uint8_t[]>> large_allocations;
    
    // Pool configuration
    size_t max_blocks;
    static constexpr size_t DEFAULT_MAX_BLOCKS = 64;
    static constexpr size_t LARGE_ALLOCATION_THRESHOLD = 1024 * 1024; // 1MB
    
    tl_pool() : first_block(nullptr), current_block(nullptr), 
                default_block_size(0), max_blocks(DEFAULT_MAX_BLOCKS) {}
};

// Create a new memory pool
tl_pool_t tl_pool_create(size_t initial_size) {
    if (initial_size == 0) {
        initial_size = 16 * 1024 * 1024; // 16MB default
    }
    
    // Use make_unique for RAII
    auto pool = std::make_unique<tl_pool>();
    pool->default_block_size = initial_size;
    
    // Allocate first block with RAII
    auto block = std::make_unique<MemoryBlock>();
    
    // Use the custom deleter for aligned memory
    uint8_t* aligned_ptr = static_cast<uint8_t*>(std::aligned_alloc(64, initial_size));
    if (!aligned_ptr) {
        return nullptr;
    }
    
    block->data.reset(aligned_ptr);  // Transfer ownership to unique_ptr with custom deleter
    block->size = initial_size;
    block->used = 0;
    // block->next is already nullptr from constructor
    
    // Set current block to point to the managed block
    pool->current_block = block.get();
    pool->first_block = std::move(block);  // Transfer ownership to pool
    pool->total_allocated.store(initial_size);
    
    return pool.release(); // Transfer ownership to caller
}

// Thread-safe allocate memory from pool
void* tl_pool_alloc(tl_pool_t pool, size_t size) {
    if (!pool || size == 0) {
        return nullptr;
    }
    
    // Align to 64 bytes for SIMD and cache line optimization
    size = (size + 63) & ~63;
    
    // Handle large allocations separately with RAII
    if (size > tl_pool::LARGE_ALLOCATION_THRESHOLD) {
        std::lock_guard<std::mutex> lock(pool->pool_mutex);
        
        auto large_alloc = std::make_unique<uint8_t[]>(size);
        uint8_t* ptr = large_alloc.get();
        
        pool->large_allocations.push_back(std::move(large_alloc));
        pool->total_allocated.fetch_add(size);
        pool->total_used.fetch_add(size);
        
        return ptr;
    }
    
    // Thread-safe block allocation
    std::lock_guard<std::mutex> lock(pool->pool_mutex);
    
    // Check if current block has enough space
    MemoryBlock* block = pool->current_block;
    if (!block || block->used + size > block->size) {
        // Need a new block - use RAII for safety
        size_t block_size = std::max(pool->default_block_size, size * 2);
        
        auto new_block = std::make_unique<MemoryBlock>();
        
        // Allocate aligned memory with RAII
        uint8_t* aligned_ptr = static_cast<uint8_t*>(std::aligned_alloc(64, block_size));
        if (!aligned_ptr) {
            return nullptr;
        }
        
        new_block->data.reset(aligned_ptr);
        new_block->size = block_size;
        new_block->used = 0;
        // new_block->next is already nullptr from constructor
        
        // Link to chain (find the end of the chain)
        if (block) {
            // Find the last block in the chain to append
            MemoryBlock* current = pool->first_block.get();
            while (current->next) {
                current = current->next.get();
            }
            current->next = std::move(new_block);
            pool->current_block = current->next.get();
        } else {
            // First block case
            pool->current_block = new_block.get();
            pool->first_block = std::move(new_block);
        }
        
        pool->total_allocated.fetch_add(block_size);
        block = pool->current_block;
    }
    
    // Allocate from current block
    void* ptr = block->data.get() + block->used;
    block->used += size;
    pool->total_used.fetch_add(size);
    
    return ptr;
}

// Thread-safe reset pool (keeps memory allocated but marks it as unused)
void tl_pool_reset(tl_pool_t pool) {
    if (!pool) return;
    
    std::lock_guard<std::mutex> lock(pool->pool_mutex);
    
    // Reset all blocks
    MemoryBlock* block = pool->first_block.get();
    while (block) {
        block->used = 0;
        block = block->next.get();
    }
    
    // Free large allocations (RAII handles cleanup automatically)
    pool->large_allocations.clear();
    
    // Reset to first block
    pool->current_block = pool->first_block.get();
    pool->total_used.store(0);
}

// Destroy pool and free all memory (RAII + thread-safe)
void tl_pool_destroy(tl_pool_t pool) {
    if (!pool) return;
    
    // Thread-safe cleanup - acquire lock to prevent concurrent access
    std::lock_guard<std::mutex> lock(pool->pool_mutex);
    
    // RAII cleanup - unique_ptr chain automatically handles memory deallocation
    // The custom deleter in MemoryBlock::data ensures proper std::free() calls
    // The unique_ptr chain in MemoryBlock::next handles recursive cleanup
    pool->first_block.reset();  // Triggers cascading cleanup of entire chain
    pool->current_block = nullptr;  // Clear non-owning pointer
    
    // Large allocations use RAII - vector destructor handles cleanup automatically
    pool->large_allocations.clear();
    
    // Note: pool destructor will automatically destroy mutex and atomics
    delete pool;
}

// Global memory functions with safety checks
void* tl_malloc(size_t size) {
    if (size == 0) {
        return nullptr;  // Consistent null return for zero size
    }
    
    // Prevent excessive allocations (1GB limit)
    if (size > 1024 * 1024 * 1024) {
        return nullptr;
    }
    
    return std::malloc(size);
}

void tl_free(void* ptr) {
    // Safe to call free(nullptr) per C++ standard
    std::free(ptr);
}

// Bounds-checked memory operations
void* tl_safe_memcpy(void* dest, const void* src, size_t n) {
    if (!dest || !src || n == 0) {
        return dest;
    }
    
    // Basic overlapping check (simple heuristic)
    const uint8_t* src_bytes = static_cast<const uint8_t*>(src);
    uint8_t* dest_bytes = static_cast<uint8_t*>(dest);
    
    if ((src_bytes < dest_bytes && src_bytes + n > dest_bytes) ||
        (dest_bytes < src_bytes && dest_bytes + n > src_bytes)) {
        // Potential overlap detected - use memmove instead
        return std::memmove(dest, src, n);
    }
    
    return std::memcpy(dest, src, n);
}

void* tl_safe_memset(void* s, int c, size_t n) {
    if (!s || n == 0) {
        return s;
    }
    
    return std::memset(s, c, n);
}