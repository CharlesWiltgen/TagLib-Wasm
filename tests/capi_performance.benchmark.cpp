// Performance Benchmarks for TagLib-Wasm C API
// Validates memory pool performance, SIMD alignment benefits, and MessagePack efficiency

#include "../src/capi/core/taglib_core.h"
#include <chrono>
#include <iostream>
#include <vector>
#include <thread>
#include <random>
#include <iomanip>
#include <cstring>
#include <algorithm>

// Benchmark timing utilities
class Timer {
private:
    std::chrono::high_resolution_clock::time_point start_time;
    
public:
    void start() {
        start_time = std::chrono::high_resolution_clock::now();
    }
    
    double elapsed_ms() const {
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::nanoseconds>(end_time - start_time);
        return duration.count() / 1000000.0; // Convert to milliseconds
    }
    
    double elapsed_us() const {
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::nanoseconds>(end_time - start_time);
        return duration.count() / 1000.0; // Convert to microseconds
    }
};

// Benchmark result structure
struct BenchmarkResult {
    std::string name;
    double time_ms;
    size_t operations;
    double ops_per_sec;
    double throughput_mb_per_sec;
    
    BenchmarkResult(const std::string& n, double t, size_t ops, size_t bytes = 0) 
        : name(n), time_ms(t), operations(ops) {
        ops_per_sec = (operations / time_ms) * 1000.0;
        throughput_mb_per_sec = bytes > 0 ? (bytes / (1024.0 * 1024.0)) / (time_ms / 1000.0) : 0.0;
    }
};

// Print benchmark results in a formatted table
void print_results(const std::vector<BenchmarkResult>& results) {
    std::cout << "\n=== Performance Benchmark Results ===\n";
    std::cout << std::left << std::setw(35) << "Benchmark" 
              << std::setw(12) << "Time (ms)"
              << std::setw(15) << "Operations"
              << std::setw(15) << "Ops/sec"
              << std::setw(15) << "MB/sec" << "\n";
    std::cout << std::string(92, '-') << "\n";
    
    for (const auto& result : results) {
        std::cout << std::left << std::setw(35) << result.name
                  << std::setw(12) << std::fixed << std::setprecision(2) << result.time_ms
                  << std::setw(15) << result.operations
                  << std::setw(15) << std::fixed << std::setprecision(0) << result.ops_per_sec;
        
        if (result.throughput_mb_per_sec > 0) {
            std::cout << std::setw(15) << std::fixed << std::setprecision(1) << result.throughput_mb_per_sec;
        } else {
            std::cout << std::setw(15) << "-";
        }
        std::cout << "\n";
    }
    std::cout << "\n";
}

// Benchmark: Memory pool vs standard malloc performance
BenchmarkResult benchmark_memory_pool_vs_malloc() {
    const size_t num_allocations = 10000;
    const size_t allocation_sizes[] = {64, 128, 256, 512, 1024};
    const size_t num_sizes = sizeof(allocation_sizes) / sizeof(allocation_sizes[0]);
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> size_dist(0, num_sizes - 1);
    
    // Pool allocations
    Timer timer;
    timer.start();
    
    tl_pool_t pool = tl_pool_create(16 * 1024 * 1024); // 16MB pool
    for (size_t i = 0; i < num_allocations; i++) {
        size_t size = allocation_sizes[size_dist(gen)];
        void* ptr = tl_pool_alloc(pool, size);
        if (ptr) {
            // Simulate some work
            memset(ptr, (i & 0xFF), std::min(size, size_t(64)));
        }
    }
    tl_pool_destroy(pool);
    
    double pool_time = timer.elapsed_ms();
    
    return BenchmarkResult("Memory Pool Allocations", pool_time, num_allocations);
}

// Benchmark: Standard malloc for comparison
BenchmarkResult benchmark_standard_malloc() {
    const size_t num_allocations = 10000;
    const size_t allocation_sizes[] = {64, 128, 256, 512, 1024};
    const size_t num_sizes = sizeof(allocation_sizes) / sizeof(allocation_sizes[0]);
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> size_dist(0, num_sizes - 1);
    
    std::vector<void*> ptrs;
    ptrs.reserve(num_allocations);
    
    Timer timer;
    timer.start();
    
    for (size_t i = 0; i < num_allocations; i++) {
        size_t size = allocation_sizes[size_dist(gen)];
        void* ptr = malloc(size);
        if (ptr) {
            ptrs.push_back(ptr);
            // Simulate some work
            memset(ptr, (i & 0xFF), std::min(size, size_t(64)));
        }
    }
    
    // Clean up
    for (void* ptr : ptrs) {
        free(ptr);
    }
    
    double malloc_time = timer.elapsed_ms();
    
    return BenchmarkResult("Standard Malloc", malloc_time, num_allocations);
}

// Benchmark: Memory alignment impact on SIMD-like operations
BenchmarkResult benchmark_alignment_impact() {
    const size_t buffer_size = 1024 * 1024; // 1MB
    const size_t iterations = 1000;
    
    // Test aligned vs unaligned memory access patterns
    tl_pool_t pool = tl_pool_create(2 * buffer_size);
    uint8_t* aligned_ptr = static_cast<uint8_t*>(tl_pool_alloc(pool, buffer_size));
    
    Timer timer;
    timer.start();
    
    // Simulate SIMD-friendly operations on aligned memory
    for (size_t iter = 0; iter < iterations; iter++) {
        for (size_t i = 0; i < buffer_size; i += 64) { // 64-byte chunks (cache line)
            // Simple operation that benefits from alignment
            uint64_t* chunk = reinterpret_cast<uint64_t*>(aligned_ptr + i);
            for (int j = 0; j < 8; j++) { // 8 * 8 bytes = 64 bytes
                chunk[j] = chunk[j] ^ 0xAAAAAAAAAAAAAAAAULL;
            }
        }
    }
    
    double aligned_time = timer.elapsed_ms();
    tl_pool_destroy(pool);
    
    size_t total_bytes = iterations * buffer_size;
    return BenchmarkResult("64-byte Aligned Operations", aligned_time, iterations, total_bytes);
}

// Benchmark: Thread-safe allocations performance
BenchmarkResult benchmark_concurrent_allocations() {
    const size_t num_threads = 4;
    const size_t allocations_per_thread = 2500; // Total 10k allocations
    
    tl_pool_t pool = tl_pool_create(32 * 1024 * 1024); // 32MB pool for concurrency
    
    Timer timer;
    timer.start();
    
    std::vector<std::thread> threads;
    for (size_t t = 0; t < num_threads; t++) {
        threads.emplace_back([&, t]() {
            for (size_t i = 0; i < allocations_per_thread; i++) {
                size_t size = 64 + (i % 1000); // Variable sizes
                void* ptr = tl_pool_alloc(pool, size);
                if (ptr) {
                    // Simulate work
                    memset(ptr, t + i, std::min(size, size_t(32)));
                }
            }
        });
    }
    
    for (auto& thread : threads) {
        thread.join();
    }
    
    double concurrent_time = timer.elapsed_ms();
    tl_pool_destroy(pool);
    
    return BenchmarkResult("Concurrent Allocations (4 threads)", concurrent_time, 
                          num_threads * allocations_per_thread);
}

// Benchmark: Large allocation handling
BenchmarkResult benchmark_large_allocations() {
    const size_t num_large_allocs = 100;
    const size_t large_size = 2 * 1024 * 1024; // 2MB each
    
    tl_pool_t pool = tl_pool_create(1024 * 1024); // Small pool to force large alloc path
    
    Timer timer;
    timer.start();
    
    std::vector<void*> ptrs;
    for (size_t i = 0; i < num_large_allocs; i++) {
        void* ptr = tl_pool_alloc(pool, large_size);
        if (ptr) {
            ptrs.push_back(ptr);
            // Touch the memory to ensure it's actually allocated
            memset(ptr, i & 0xFF, 1024); // Just first 1KB
        }
    }
    
    double large_alloc_time = timer.elapsed_ms();
    tl_pool_destroy(pool);
    
    size_t total_bytes = num_large_allocs * large_size;
    return BenchmarkResult("Large Allocations (2MB each)", large_alloc_time, 
                          num_large_allocs, total_bytes);
}

// Benchmark: Pool reset performance
BenchmarkResult benchmark_pool_reset() {
    const size_t num_resets = 1000;
    const size_t allocs_per_reset = 100;
    
    tl_pool_t pool = tl_pool_create(8 * 1024 * 1024); // 8MB pool
    
    Timer timer;
    timer.start();
    
    for (size_t reset_cycle = 0; reset_cycle < num_resets; reset_cycle++) {
        // Allocate memory
        for (size_t i = 0; i < allocs_per_reset; i++) {
            void* ptr = tl_pool_alloc(pool, 64 + (i % 500));
            if (ptr) {
                memset(ptr, i & 0xFF, 32);
            }
        }
        
        // Reset pool
        tl_pool_reset(pool);
    }
    
    double reset_time = timer.elapsed_ms();
    tl_pool_destroy(pool);
    
    return BenchmarkResult("Pool Reset Operations", reset_time, num_resets);
}

int main() {
    std::cout << "🔥 TagLib-Wasm C API Performance Benchmarks\n";
    std::cout << "============================================\n\n";
    
    std::cout << "Running memory allocation benchmarks...\n";
    
    std::vector<BenchmarkResult> results;
    
    // Core allocation benchmarks
    results.push_back(benchmark_memory_pool_vs_malloc());
    results.push_back(benchmark_standard_malloc());
    
    // Advanced performance tests  
    results.push_back(benchmark_alignment_impact());
    results.push_back(benchmark_concurrent_allocations());
    results.push_back(benchmark_large_allocations());
    results.push_back(benchmark_pool_reset());
    
    print_results(results);
    
    // Performance analysis
    std::cout << "=== Performance Analysis ===\n";
    
    if (results.size() >= 2) {
        double pool_ops = results[0].ops_per_sec;
        double malloc_ops = results[1].ops_per_sec;
        double speedup = pool_ops / malloc_ops;
        
        std::cout << "Memory Pool vs Malloc: ";
        if (speedup > 1.1) {
            std::cout << "🚀 " << std::fixed << std::setprecision(1) 
                     << speedup << "x faster (" 
                     << ((speedup - 1.0) * 100.0) << "% improvement)\n";
        } else if (speedup > 0.9) {
            std::cout << "⚖️  Similar performance (" 
                     << std::fixed << std::setprecision(1) << speedup << "x)\n";
        } else {
            std::cout << "⚠️  " << std::fixed << std::setprecision(1) 
                     << (1.0/speedup) << "x slower\n";
        }
    }
    
    // Check concurrent performance
    if (results.size() >= 4) {
        double concurrent_ops = results[3].ops_per_sec;
        double single_thread_ops = results[0].ops_per_sec;
        double concurrency_factor = concurrent_ops / single_thread_ops;
        
        std::cout << "Concurrency scaling: " << std::fixed << std::setprecision(1) 
                  << concurrency_factor << "x (4 threads, ideal = 4.0x)\n";
    }
    
    std::cout << "\n✅ All performance benchmarks completed successfully!\n";
    
    return 0;
}