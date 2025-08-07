# CMakeLists.txt for TagLib-Wasm C API
cmake_minimum_required(VERSION 3.12)
project(taglib-wasm-capi)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Fetch MessagePack
include(FetchContent)
FetchContent_Declare(
  msgpack
  GIT_REPOSITORY https://github.com/msgpack/msgpack-c.git
  GIT_TAG cpp-6.1.0
)
FetchContent_MakeAvailable(msgpack)

# Source files
set(CAPI_SOURCES
  taglib_api.cpp
  core/taglib_memory.cpp
  core/taglib_error.cpp
  io/taglib_stream.cpp
  io/taglib_buffer.cpp
  formats/taglib_mp3.cpp
  formats/taglib_flac.cpp
  formats/taglib_m4a.cpp
)

# Create library
add_library(taglib_wasm_capi STATIC ${CAPI_SOURCES})

# Include directories
target_include_directories(taglib_wasm_capi PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${CMAKE_CURRENT_SOURCE_DIR}/core
)

# Link dependencies
target_link_libraries(taglib_wasm_capi
  taglib
  msgpackc-cxx
)

# Compiler flags
target_compile_options(taglib_wasm_capi PRIVATE
  -fno-exceptions
  -fno-rtti
  -O3
)