/**
 * @fileoverview Stub implementations for C++ exception functions
 *
 * These stubs allow linking when full C++ exception support is not available.
 * If an exception is thrown, the program will abort.
 * This is acceptable for WASI where exceptions indicate fatal errors.
 */

#include <stdlib.h>
#include <stdio.h>

// Exception type info pointer (opaque)
typedef void* __cxa_exception;

// Allocate space for an exception object
void* __cxa_allocate_exception(unsigned long size) {
    // In a real implementation, this would allocate from exception heap
    // For WASI, we just return NULL and let throw abort
    (void)size;
    return NULL;
}

// Free an exception object
void __cxa_free_exception(void* exception) {
    (void)exception;
}

// Throw an exception (will abort)
void __cxa_throw(void* exception, void* type_info, void (*destructor)(void*)) {
    (void)exception;
    (void)type_info;
    (void)destructor;
    fprintf(stderr, "FATAL: C++ exception thrown in WASI module\n");
    abort();
}

// Rethrow the current exception
void __cxa_rethrow(void) {
    fprintf(stderr, "FATAL: C++ exception rethrown in WASI module\n");
    abort();
}

// Begin catching an exception
void* __cxa_begin_catch(void* exception) {
    // This shouldn't be called if throw aborts
    (void)exception;
    return NULL;
}

// End catching an exception
void __cxa_end_catch(void) {
    // This shouldn't be called if throw aborts
}

// Get exception type info
void* __cxa_current_exception_type(void) {
    return NULL;
}

// Pure virtual function handler
void __cxa_pure_virtual(void) {
    fprintf(stderr, "FATAL: Pure virtual function called\n");
    abort();
}

// Deleted virtual function handler
void __cxa_deleted_virtual(void) {
    fprintf(stderr, "FATAL: Deleted virtual function called\n");
    abort();
}

// WASI-specific unwinding stubs
// These are required when mixing Wasm EH and Itanium EH models

// Wasm landing pad context - used by SJLJ-style exception handling
int __wasm_lpad_context = 0;

// Call personality function during unwinding
int _Unwind_CallPersonality(void* exception) {
    (void)exception;
    return 0;  // _URC_CONTINUE_UNWIND
}

// Get exception class from exception object
unsigned long long _Unwind_GetExceptionClass(void* exception) {
    (void)exception;
    return 0;
}

// Resume unwinding after catch block
void _Unwind_Resume(void* exception) {
    (void)exception;
    fprintf(stderr, "FATAL: _Unwind_Resume called in WASI module\n");
    abort();
}
