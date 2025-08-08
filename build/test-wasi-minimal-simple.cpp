/**
 * Ultra-minimal WASI test binary
 */

extern "C" {

const char* tl_version() {
    return "3.0.0-wasi-test";
}

int tl_get_last_error() {
    return 0;
}

} // extern "C"