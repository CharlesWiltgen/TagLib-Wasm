// C++ Unit Tests for TagLib-Wasm C API Memory Pool
// Tests the core memory pool functionality for thread safety, RAII, and bounds checking

#include "../src/capi/core/taglib_core.h"
#include <cassert>
#include <iostream>
#include <vector>
#include <thread>
#include <chrono>
#include <string>
#include <atomic>
#include <memory>

// Test framework macros
#define TEST_ASSERT(condition) \
    do { \
        if (!(condition)) { \
            std::cerr << "FAILED: " << #condition << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
            return false; \
        } \
    } while(0)

#define TEST_ASSERT_EQ(expected, actual) \
    do { \
        if ((expected) != (actual)) { \
            std::cerr << "FAILED: Expected " << (expected) << ", got " << (actual) \
                      << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
            return false; \
        } \
    } while(0)

#define RUN_TEST(test_func) \
    do { \
        std::cout << "Running " << #test_func << "... "; \
        if (test_func()) { \
            std::cout << "PASSED" << std::endl; \
            tests_passed++; \
        } else { \
            std::cout << "FAILED" << std::endl; \
            tests_failed++; \
        } \
        tests_total++; \
    } while(0)

// Global test counters
static int tests_total = 0;
static int tests_passed = 0;
static int tests_failed = 0;

// Test: Basic memory pool creation and destruction
bool test_memory_pool_create_destroy() {
    tl_pool_t pool = tl_pool_create(1024 * 1024); // 1MB
    TEST_ASSERT(pool != nullptr);
    
    tl_pool_destroy(pool);
    return true;
}

// Test: Basic allocation functionality
bool test_memory_pool_basic_allocation() {
    tl_pool_t pool = tl_pool_create(1024 * 1024); // 1MB
    TEST_ASSERT(pool != nullptr);
    
    // Test small allocation
    void* ptr1 = tl_pool_alloc(pool, 64);
    TEST_ASSERT(ptr1 != nullptr);
    
    // Test another small allocation
    void* ptr2 = tl_pool_alloc(pool, 128);
    TEST_ASSERT(ptr2 != nullptr);
    TEST_ASSERT(ptr1 != ptr2);
    
    // Test large allocation (> LARGE_ALLOCATION_THRESHOLD)
    void* ptr3 = tl_pool_alloc(pool, 2 * 1024 * 1024); // 2MB
    TEST_ASSERT(ptr3 != nullptr);
    TEST_ASSERT(ptr3 != ptr1);
    TEST_ASSERT(ptr3 != ptr2);
    
    tl_pool_destroy(pool);
    return true;
}

// Test: Pool reset functionality
bool test_memory_pool_reset() {
    tl_pool_t pool = tl_pool_create(1024 * 1024); // 1MB
    TEST_ASSERT(pool != nullptr);
    
    // Allocate some memory
    void* ptr1 = tl_pool_alloc(pool, 1024);
    void* ptr2 = tl_pool_alloc(pool, 2048);
    TEST_ASSERT(ptr1 != nullptr);
    TEST_ASSERT(ptr2 != nullptr);
    
    // Reset pool
    tl_pool_reset(pool);
    
    // Allocate again - should get same or similar addresses
    void* ptr3 = tl_pool_alloc(pool, 1024);
    TEST_ASSERT(ptr3 != nullptr);
    // After reset, we should be able to reuse the space
    
    tl_pool_destroy(pool);
    return true;
}

// Test: Safe memory operations
bool test_safe_memory_operations() {
    // Test safe memcpy
    char src[] = "Hello World";
    char dest[32];
    
    void* result = tl_safe_memcpy(dest, src, strlen(src) + 1);
    TEST_ASSERT(result == dest);
    TEST_ASSERT(strcmp(dest, "Hello World") == 0);
    
    // Test safe memset
    char buffer[16];
    result = tl_safe_memset(buffer, 'A', 15);
    buffer[15] = '\0';
    TEST_ASSERT(result == buffer);
    TEST_ASSERT(strcmp(buffer, "AAAAAAAAAAAAAAA") == 0);
    
    // Test null pointer safety
    result = tl_safe_memcpy(nullptr, src, 10);
    TEST_ASSERT(result == nullptr);
    
    result = tl_safe_memset(nullptr, 'A', 10);
    TEST_ASSERT(result == nullptr);
    
    return true;
}

// Test: Global memory functions with bounds checking
bool test_global_memory_bounds_checking() {
    // Test normal allocation
    void* ptr = tl_malloc(1024);
    TEST_ASSERT(ptr != nullptr);
    tl_free(ptr);
    
    // Test zero allocation
    ptr = tl_malloc(0);
    TEST_ASSERT(ptr == nullptr);
    
    // Test excessive allocation (should fail)
    ptr = tl_malloc(2ULL * 1024 * 1024 * 1024); // 2GB
    TEST_ASSERT(ptr == nullptr);
    
    // Test safe free of null
    tl_free(nullptr); // Should not crash
    
    return true;
}

// Test: Memory alignment
bool test_memory_alignment() {
    tl_pool_t pool = tl_pool_create(1024 * 1024); // 1MB
    TEST_ASSERT(pool != nullptr);
    
    // Test that allocations are properly aligned (64-byte alignment)
    for (int i = 0; i < 10; i++) {
        void* ptr = tl_pool_alloc(pool, 1 + i); // Various small sizes
        TEST_ASSERT(ptr != nullptr);
        
        // Check 64-byte alignment
        uintptr_t addr = reinterpret_cast<uintptr_t>(ptr);
        TEST_ASSERT((addr & 63) == 0); // Should be 64-byte aligned
    }
    
    tl_pool_destroy(pool);
    return true;
}

// Test: Thread safety of memory pool operations
bool test_memory_pool_thread_safety() {
    tl_pool_t pool = tl_pool_create(16 * 1024 * 1024); // 16MB
    TEST_ASSERT(pool != nullptr);
    
    const int num_threads = 4;
    const int allocations_per_thread = 100;
    std::atomic<int> successful_allocations{0};
    std::atomic<int> failed_allocations{0};
    
    std::vector<std::thread> threads;
    
    // Launch threads that perform concurrent allocations
    for (int t = 0; t < num_threads; t++) {
        threads.emplace_back([&, t]() {
            for (int i = 0; i < allocations_per_thread; i++) {
                size_t size = 64 + (i % 1000); // Vary allocation sizes
                void* ptr = tl_pool_alloc(pool, size);
                if (ptr) {
                    successful_allocations.fetch_add(1);
                    
                    // Write some data to test memory validity
                    memset(ptr, t + i, std::min(size, size_t(64)));
                } else {
                    failed_allocations.fetch_add(1);
                }
                
                // Small delay to increase chance of race conditions
                std::this_thread::sleep_for(std::chrono::microseconds(1));
            }
        });
    }
    
    // Wait for all threads to complete
    for (auto& thread : threads) {
        thread.join();
    }
    
    // Verify that most allocations succeeded
    int total_expected = num_threads * allocations_per_thread;
    int actual_total = successful_allocations.load() + failed_allocations.load();
    TEST_ASSERT_EQ(total_expected, actual_total);
    
    // At least 90% should succeed (allowing for some memory exhaustion)
    TEST_ASSERT(successful_allocations.load() >= total_expected * 0.9);
    
    std::cout << "(Allocations: " << successful_allocations.load() 
              << " successful, " << failed_allocations.load() << " failed) ";
    
    tl_pool_destroy(pool);
    return true;
}

// Test: Memory leak detection by checking pool state
bool test_memory_leak_detection() {
    // This is a basic test - in a real implementation we'd use valgrind or similar
    tl_pool_t pool = tl_pool_create(1024 * 1024); // 1MB
    TEST_ASSERT(pool != nullptr);
    
    // Perform many allocations and resets
    for (int round = 0; round < 100; round++) {
        for (int i = 0; i < 100; i++) {
            void* ptr = tl_pool_alloc(pool, 64 + (i % 100));
            TEST_ASSERT(ptr != nullptr);
        }
        
        // Reset should not leak memory
        tl_pool_reset(pool);
    }
    
    tl_pool_destroy(pool);
    return true;
}

// Test: Large allocation handling
bool test_large_allocations() {
    tl_pool_t pool = tl_pool_create(1024 * 1024); // 1MB
    TEST_ASSERT(pool != nullptr);
    
    // Test multiple large allocations
    const size_t large_size = 2 * 1024 * 1024; // 2MB each
    std::vector<void*> large_ptrs;
    
    for (int i = 0; i < 5; i++) {
        void* ptr = tl_pool_alloc(pool, large_size);
        TEST_ASSERT(ptr != nullptr);
        large_ptrs.push_back(ptr);
        
        // Write pattern to verify memory is working
        memset(ptr, 0xAA + i, 1024); // Just first 1KB
    }
    
    // Verify all pointers are different
    for (size_t i = 0; i < large_ptrs.size(); i++) {
        for (size_t j = i + 1; j < large_ptrs.size(); j++) {
            TEST_ASSERT(large_ptrs[i] != large_ptrs[j]);
        }
    }
    
    tl_pool_destroy(pool);
    return true;
}

// Main test runner
int main() {
    std::cout << "=== TagLib-Wasm C API Memory Pool Unit Tests ===" << std::endl;
    std::cout << std::endl;
    
    // Basic functionality tests
    RUN_TEST(test_memory_pool_create_destroy);
    RUN_TEST(test_memory_pool_basic_allocation);
    RUN_TEST(test_memory_pool_reset);
    RUN_TEST(test_safe_memory_operations);
    RUN_TEST(test_global_memory_bounds_checking);
    
    // Advanced functionality tests
    RUN_TEST(test_memory_alignment);
    RUN_TEST(test_large_allocations);
    
    // Safety and reliability tests
    RUN_TEST(test_memory_pool_thread_safety);
    RUN_TEST(test_memory_leak_detection);
    
    std::cout << std::endl;
    std::cout << "=== Test Results ===" << std::endl;
    std::cout << "Total tests: " << tests_total << std::endl;
    std::cout << "Passed: " << tests_passed << std::endl;
    std::cout << "Failed: " << tests_failed << std::endl;
    
    if (tests_failed == 0) {
        std::cout << "🎉 All tests passed!" << std::endl;
        return 0;
    } else {
        std::cout << "❌ " << tests_failed << " test(s) failed!" << std::endl;
        return 1;
    }
}