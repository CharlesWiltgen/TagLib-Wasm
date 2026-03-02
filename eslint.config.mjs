import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    // Multi-runtime boundary code that necessarily uses `any` for
    // globalThis.Deno / .Bun / .process runtime detection.
    // Remove files from this list as they gain proper type narrowing.
    files: [
      "src/constants/utilities.ts",
      "src/deno-compile.ts",
      "src/folder-api/directory-walker.ts",
      "src/folder-api/file-processors.ts",
      "src/msgpack/decoder.ts",
      "src/msgpack/utils.ts",
      "src/runtime/deno-detect.ts",
      "src/runtime/detector.ts",
      "src/runtime/module-loader.ts",
      "src/runtime/wasi-fs-deno.ts",
      "src/simple/batch-operations.ts",
      "src/utils/file.ts",
      "src/utils/write.ts",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "lib/",
      "tests/",
      "scripts/",
      "examples/",
      "tools/",
      "docs/",
      "**/*.test.ts",
      "eslint.config.mjs",
      "mod.ts",
    ],
  },
);
