# Wasm exception tag definition for LLVM 22+
#
# LLVM 22 (PR #159143) moved __cpp_exception from a weak definition in every
# object file to an external symbol provided by compiler-rt. However, the
# pre-built compiler-rt in WASI SDK 31 doesn't actually include the tag
# (the assembler needs -mexception-handling to emit .tagtype directives).
#
# This file provides the tag definition directly.

	.globl __cpp_exception
	.tagtype __cpp_exception i32
__cpp_exception:
