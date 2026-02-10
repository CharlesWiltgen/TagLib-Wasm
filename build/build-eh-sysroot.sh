#!/bin/bash
# Build an EH-enabled WASI sysroot from wasi-sdk source
#
# Downloads WASI SDK 30 binary (for the Clang/LLVM toolchain), then builds
# only the sysroot from source with C++ exception handling enabled via PR #590.
# This avoids a 30+ minute full LLVM build — sysroot-only takes ~5-10 minutes.
#
# Prerequisites: cmake, ninja, git, python3

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WASI_SDK_DIR="$PROJECT_ROOT/build/wasi-sdk"

# Source wasi-env.sh to get WASI_SDK_PATH (set by setup-wasi-sdk.sh)
source "$SCRIPT_DIR/wasi-env.sh" 2>/dev/null || true

if [ -z "$WASI_SDK_PATH" ] || [ ! -f "$WASI_SDK_PATH/bin/clang++" ]; then
    echo -e "${RED}WASI SDK not found. Run setup-wasi-sdk.sh first.${NC}"
    exit 1
fi

echo "Building EH-enabled WASI sysroot"
echo "Using toolchain from: $WASI_SDK_PATH"

# Check prerequisites
for cmd in cmake ninja git python3; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}Required command not found: $cmd${NC}"
        exit 1
    fi
done

WASI_SDK_SRC="$SCRIPT_DIR/wasi-sdk-src"
SYSROOT_BUILD="$SCRIPT_DIR/sysroot-build"

# Step 1: Clone wasi-sdk source at the wasi-sdk-30 tag
echo ""
echo -e "${BLUE}Step 1: Cloning wasi-sdk source${NC}"

if [ -d "$WASI_SDK_SRC" ] && [ -f "$WASI_SDK_SRC/CMakeLists.txt" ]; then
    echo -e "${GREEN}wasi-sdk source already cloned${NC}"
else
    rm -rf "$WASI_SDK_SRC"
    git clone --depth 1 --branch wasi-sdk-30 \
        https://github.com/WebAssembly/wasi-sdk.git "$WASI_SDK_SRC"
fi

cd "$WASI_SDK_SRC"

# Step 2: Apply PR #590 changes for exception handling support
echo ""
echo -e "${BLUE}Step 2: Applying EH support changes${NC}"

# Create the LLVM patch file (from PR #590)
mkdir -p src
cat > src/llvm-pr-168449.patch << 'PATCHEOF'
diff --git a/libunwind/src/assembly.h b/libunwind/src/assembly.h
index f8e83e138eff..c5097d25b0c6 100644
--- a/libunwind/src/assembly.h
+++ b/libunwind/src/assembly.h
@@ -249,6 +249,9 @@
 #define WEAK_ALIAS(name, aliasname)
 #define NO_EXEC_STACK_DIRECTIVE

+#elif defined(__wasm__)
+#define NO_EXEC_STACK_DIRECTIVE
+
 // clang-format on
 #else

diff --git a/libunwind/src/config.h b/libunwind/src/config.h
index deb5a4d4d73d..23c9f012cbcf 100644
--- a/libunwind/src/config.h
+++ b/libunwind/src/config.h
@@ -66,7 +66,8 @@
   #define _LIBUNWIND_EXPORT
   #define _LIBUNWIND_HIDDEN
 #else
-  #if !defined(__ELF__) && !defined(__MACH__) && !defined(_AIX)
+  #if !defined(__ELF__) && !defined(__MACH__) && !defined(_AIX) &&             \
+      !defined(__wasm__)
     #define _LIBUNWIND_EXPORT __declspec(dllexport)
     #define _LIBUNWIND_HIDDEN
   #else
PATCHEOF

# Apply the cmake changes from PR #590 to wasi-sdk-sysroot.cmake
# Check if already applied by looking for WASI_SDK_EXCEPTIONS option
if grep -q "WASI_SDK_EXCEPTIONS" cmake/wasi-sdk-sysroot.cmake; then
    echo -e "${GREEN}EH changes already present in cmake config${NC}"
else
    echo "Patching cmake/wasi-sdk-sysroot.cmake for EH support..."

    # Apply PR #590's cmake diff using git apply
    cat > /tmp/wasi-sdk-eh-cmake.patch << 'CMAKEPATCH'
diff --git a/cmake/wasi-sdk-sysroot.cmake b/cmake/wasi-sdk-sysroot.cmake
index 72088d979..7be2a18ec 100644
--- a/cmake/wasi-sdk-sysroot.cmake
+++ b/cmake/wasi-sdk-sysroot.cmake
@@ -24,6 +24,7 @@ option(WASI_SDK_DEBUG_PREFIX_MAP "Pass `-fdebug-prefix-map` for built artifacts"
 option(WASI_SDK_INCLUDE_TESTS "Whether or not to build tests by default" OFF)
 option(WASI_SDK_INSTALL_TO_CLANG_RESOURCE_DIR "Whether or not to modify the compiler's resource directory" OFF)
 option(WASI_SDK_LTO "Whether or not to build LTO assets" ON)
+option(WASI_SDK_EXCEPTIONS "Whether or not C++ exceptions are enabled" OFF)
 set(WASI_SDK_CPU_CFLAGS "-mcpu=lime1" CACHE STRING "CFLAGS to specify wasm features to enable")

 set(wasi_tmp_install ${CMAKE_CURRENT_BINARY_DIR}/install)
@@ -89,6 +90,8 @@ function(define_compiler_rt target)
         -DCOMPILER_RT_BUILD_GWP_ASAN=OFF
         -DCMAKE_C_COMPILER_TARGET=${target}
         -DCMAKE_C_FLAGS=${WASI_SDK_CPU_CFLAGS}
+        -DCMAKE_CXX_FLAGS=${WASI_SDK_CPU_CFLAGS}
+        -DCMAKE_ASM_FLAGS=${WASI_SDK_CPU_CFLAGS}
         -DCMAKE_INSTALL_PREFIX=${wasi_resource_dir}
     EXCLUDE_FROM_ALL ON
     USES_TERMINAL_CONFIGURE ON
@@ -231,6 +234,17 @@ function(define_libcxx_sub target target_suffix extra_target_flags extra_libdir_
     --sysroot ${wasi_sysroot}
     -resource-dir ${wasi_resource_dir})

+  if (WASI_SDK_EXCEPTIONS)
+    # TODO: lots of builds fail with shared libraries and `-fPIC`. Looks like
+    # things are maybe changing in llvm/llvm-project#159143 but otherwise I'm at
+    # least not really sure what the state of shared libraries and exceptions
+    # are. For now shared libraries are disabled and supporting them is left for
+    # a future endeavor.
+    set(pic OFF)
+    set(runtimes "libunwind;${runtimes}")
+    list(APPEND extra_flags -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false)
+  endif()
+
   set(extra_cflags_list ${CMAKE_C_FLAGS} ${extra_flags})
   list(JOIN extra_cflags_list " " extra_cflags)
   set(extra_cxxflags_list ${CMAKE_CXX_FLAGS} ${extra_flags})
@@ -254,14 +268,14 @@ function(define_libcxx_sub target target_suffix extra_target_flags extra_libdir_
       -DLLVM_COMPILER_CHECKED=ON
       -DLIBCXX_ENABLE_SHARED:BOOL=${pic}
       -DLIBCXX_ENABLE_EXPERIMENTAL_LIBRARY:BOOL=OFF
-      -DLIBCXX_ENABLE_EXCEPTIONS:BOOL=OFF
+      -DLIBCXX_ENABLE_EXCEPTIONS:BOOL=${WASI_SDK_EXCEPTIONS}
       -DLIBCXX_ENABLE_FILESYSTEM:BOOL=ON
       -DLIBCXX_ENABLE_ABI_LINKER_SCRIPT:BOOL=OFF
       -DLIBCXX_CXX_ABI=libcxxabi
       -DLIBCXX_CXX_ABI_INCLUDE_PATHS=${llvm_proj_dir}/libcxxabi/include
       -DLIBCXX_HAS_MUSL_LIBC:BOOL=ON
       -DLIBCXX_ABI_VERSION=2
-      -DLIBCXXABI_ENABLE_EXCEPTIONS:BOOL=OFF
+      -DLIBCXXABI_ENABLE_EXCEPTIONS:BOOL=${WASI_SDK_EXCEPTIONS}
       -DLIBCXXABI_ENABLE_SHARED:BOOL=${pic}
       -DLIBCXXABI_SILENT_TERMINATE:BOOL=ON
       -DLIBCXXABI_ENABLE_THREADS:BOOL=ON
@@ -270,12 +284,18 @@ function(define_libcxx_sub target target_suffix extra_target_flags extra_libdir_
       -DLIBCXXABI_BUILD_EXTERNAL_THREAD_LIBRARY:BOOL=OFF
       -DLIBCXXABI_HAS_WIN32_THREAD_API:BOOL=OFF
       -DLIBCXXABI_ENABLE_PIC:BOOL=${pic}
-      -DLIBCXXABI_USE_LLVM_UNWINDER:BOOL=OFF
+      -DLIBCXXABI_USE_LLVM_UNWINDER:BOOL=${WASI_SDK_EXCEPTIONS}
+      -DLIBUNWIND_ENABLE_SHARED:BOOL=${pic}
+      -DLIBUNWIND_ENABLE_THREADS:BOOL=ON
+      -DLIBUNWIND_USE_COMPILER_RT:BOOL=ON
+      -DLIBUNWIND_INCLUDE_TESTS:BOOL=OFF
       -DUNIX:BOOL=ON
       -DCMAKE_C_FLAGS=${extra_cflags}
+      -DCMAKE_ASM_FLAGS=${extra_cflags}
       -DCMAKE_CXX_FLAGS=${extra_cxxflags}
       -DLIBCXX_LIBDIR_SUFFIX=/${target}${extra_libdir_suffix}
       -DLIBCXXABI_LIBDIR_SUFFIX=/${target}${extra_libdir_suffix}
+      -DLIBUNWIND_LIBDIR_SUFFIX=/${target}${extra_libdir_suffix}
       -DLIBCXX_INCLUDE_TESTS=OFF
       -DLIBCXX_INCLUDE_BENCHMARKS=OFF

@@ -290,6 +310,9 @@ function(define_libcxx_sub target target_suffix extra_target_flags extra_libdir_
     USES_TERMINAL_CONFIGURE ON
     USES_TERMINAL_BUILD ON
     USES_TERMINAL_INSTALL ON
+    PATCH_COMMAND
+      ${CMAKE_COMMAND} -E chdir .. bash -c
+        "git apply ${CMAKE_SOURCE_DIR}/src/llvm-pr-168449.patch || git apply ${CMAKE_SOURCE_DIR}/src/llvm-pr-168449.patch -R --check"
   )
 endfunction()
CMAKEPATCH

    git apply /tmp/wasi-sdk-eh-cmake.patch || {
        echo -e "${RED}Failed to apply cmake patch. The wasi-sdk-30 source may already include these changes or have diverged.${NC}"
        echo "Trying manual patching..."

        # If git apply fails, the SDK 30 source may have a different baseline.
        # In that case, just check if the key features are present.
        if ! grep -q "WASI_SDK_EXCEPTIONS" cmake/wasi-sdk-sysroot.cmake; then
            echo -e "${RED}Cannot apply EH changes. Manual intervention required.${NC}"
            exit 1
        fi
    }
    rm -f /tmp/wasi-sdk-eh-cmake.patch
fi

# Step 3: Initialize required submodules (llvm-project for libc++/libc++abi/libunwind, wasi-libc)
echo ""
echo -e "${BLUE}Step 3: Initializing submodules${NC}"

git submodule update --init --depth 1 src/llvm-project src/wasi-libc

echo -e "${GREEN}Submodules initialized${NC}"

# Step 4: Build the EH-enabled sysroot
echo ""
echo -e "${BLUE}Step 4: Building EH-enabled sysroot${NC}"
echo "This will take ~5-10 minutes..."

rm -rf "$SYSROOT_BUILD"

cmake -G Ninja -B "$SYSROOT_BUILD" -S . \
    -DCMAKE_TOOLCHAIN_FILE="$WASI_SDK_PATH/share/cmake/wasi-sdk.cmake" \
    -DWASI_SDK_EXCEPTIONS=ON \
    -DWASI_SDK_INCLUDE_TESTS=OFF \
    -DWASI_SDK_LTO=OFF

cmake --build "$SYSROOT_BUILD"

# Step 5: Install the EH sysroot into the SDK
echo ""
echo -e "${BLUE}Step 5: Installing EH sysroot into SDK${NC}"

cmake --install "$SYSROOT_BUILD" --prefix "$WASI_SDK_PATH"

# Step 6: Verify
echo ""
echo -e "${BLUE}Step 6: Verifying EH support${NC}"

# Check that libunwind was built
LIBUNWIND="$WASI_SDK_PATH/share/wasi-sysroot/lib/wasm32-wasi/libunwind.a"
if [ -f "$LIBUNWIND" ]; then
    echo -e "${GREEN}libunwind.a found${NC}"
    ls -lh "$LIBUNWIND"
else
    # Try alternate location
    LIBUNWIND=$(find "$WASI_SDK_PATH" -name "libunwind.a" 2>/dev/null | head -1)
    if [ -n "$LIBUNWIND" ]; then
        echo -e "${GREEN}libunwind.a found at: $LIBUNWIND${NC}"
    else
        echo -e "${RED}libunwind.a not found — EH sysroot may not have built correctly${NC}"
        exit 1
    fi
fi

# Check that libc++abi was rebuilt with EH
LIBCXXABI="$WASI_SDK_PATH/share/wasi-sysroot/lib/wasm32-wasi/libc++abi.a"
if [ -f "$LIBCXXABI" ]; then
    # Verify EH features in the rebuilt library
    if "$WASI_SDK_PATH/bin/llvm-objdump" --section=target_features "$LIBCXXABI" 2>/dev/null | grep -q "exception-handling"; then
        echo -e "${GREEN}libc++abi.a has exception-handling feature${NC}"
    else
        echo -e "${YELLOW}Could not verify exception-handling feature in libc++abi.a (may still work)${NC}"
    fi
else
    echo -e "${YELLOW}libc++abi.a not found at expected location${NC}"
fi

echo ""
echo -e "${GREEN}EH-enabled sysroot build complete${NC}"
echo "The sysroot has been installed into: $WASI_SDK_PATH"
echo ""
echo "Next: rebuild TagLib with 'bash build/build-wasi.sh'"
