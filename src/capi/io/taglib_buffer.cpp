// Buffer management utilities for TagLib-Wasm
#include "../core/taglib_core.h"
#include <cstring>
#include <algorithm>
#include <vector>

// Buffer pool for reusing allocations
struct BufferPool {
    struct Buffer {
        uint8_t* data;
        size_t capacity;
        bool in_use;
    };
    
    std::vector<Buffer> buffers;
    size_t total_allocated;
    size_t max_buffers;
};

static BufferPool g_buffer_pool = {
    .buffers = {},
    .total_allocated = 0,
    .max_buffers = 16
};

// Acquire a buffer from the pool
uint8_t* tl_buffer_acquire(size_t size) {
    // Try to find an existing buffer of sufficient size
    for (auto& buf : g_buffer_pool.buffers) {
        if (!buf.in_use && buf.capacity >= size) {
            buf.in_use = true;
            return buf.data;
        }
    }
    
    // No suitable buffer found, allocate a new one
    if (g_buffer_pool.buffers.size() < g_buffer_pool.max_buffers) {
        // Round up to next power of 2 for better reuse
        size_t capacity = 1;
        while (capacity < size) capacity *= 2;
        
        uint8_t* data = static_cast<uint8_t*>(tl_malloc(capacity));
        if (data) {
            g_buffer_pool.buffers.push_back({
                .data = data,
                .capacity = capacity,
                .in_use = true
            });
            g_buffer_pool.total_allocated += capacity;
            return data;
        }
    }
    
    // Pool is full or allocation failed, just allocate directly
    return static_cast<uint8_t*>(tl_malloc(size));
}

// Release a buffer back to the pool
void tl_buffer_release(uint8_t* buffer) {
    if (!buffer) return;
    
    // Check if this buffer is from our pool
    for (auto& buf : g_buffer_pool.buffers) {
        if (buf.data == buffer) {
            buf.in_use = false;
            return;
        }
    }
    
    // Not from pool, free directly
    tl_free(buffer);
}

// Resize a buffer (may relocate)
uint8_t* tl_buffer_resize(uint8_t* buffer, size_t old_size, size_t new_size) {
    if (new_size == 0) {
        tl_buffer_release(buffer);
        return nullptr;
    }
    
    // Check if buffer is from pool and has enough capacity
    for (auto& buf : g_buffer_pool.buffers) {
        if (buf.data == buffer) {
            if (buf.capacity >= new_size) {
                // Buffer is large enough, no need to reallocate
                return buffer;
            }
            break;
        }
    }
    
    // Need to allocate a new buffer
    uint8_t* new_buffer = tl_buffer_acquire(new_size);
    if (new_buffer && buffer) {
        // Copy old data
        size_t copy_size = std::min(old_size, new_size);
        memcpy(new_buffer, buffer, copy_size);
        tl_buffer_release(buffer);
    }
    
    return new_buffer;
}

// Clear the buffer pool (free all unused buffers)
void tl_buffer_pool_clear() {
    auto it = g_buffer_pool.buffers.begin();
    while (it != g_buffer_pool.buffers.end()) {
        if (!it->in_use) {
            tl_free(it->data);
            g_buffer_pool.total_allocated -= it->capacity;
            it = g_buffer_pool.buffers.erase(it);
        } else {
            ++it;
        }
    }
}

// Get pool statistics
void tl_buffer_pool_stats(size_t* total_buffers, size_t* buffers_in_use, size_t* total_memory) {
    if (total_buffers) {
        *total_buffers = g_buffer_pool.buffers.size();
    }
    
    if (buffers_in_use) {
        size_t in_use = 0;
        for (const auto& buf : g_buffer_pool.buffers) {
            if (buf.in_use) in_use++;
        }
        *buffers_in_use = in_use;
    }
    
    if (total_memory) {
        *total_memory = g_buffer_pool.total_allocated;
    }
}