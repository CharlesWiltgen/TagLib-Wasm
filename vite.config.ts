import { dirname, join } from "node:path";
import { defineConfig } from "vite-plus";
import type { TsdownPlugin } from "vite-plus/pack";

// Copied from the retired esbuild browser build's redirect plugin — the stub
// bodies (and their error text) must stay identical.
const PLATFORM_IO_BROWSER_STUB = `
  export function getPlatformIO() {
    throw new Error("Filesystem operations are not available in the browser.");
  }
  export function _setPlatformIOForTesting() {}
  export function _resetPlatformIO() {}
`;
const NODE_FS_BROWSER_STUB = `
  export function getNodeFsSync() {
    return null;
  }
`;

/**
 * Which comments survive into the browser bundles: the functional ones only.
 *
 * rolldown keeps every JSDoc block where the retired esbuild build discarded
 * nearly all of them, and carrying that prose cost 22 KB on index.browser.js
 * (151 KB → 173 KB) plus 15 KB of gzip on that entry (37 KB across the three).
 * `comments: false` recovers that but also throws
 * away the `@__PURE__` marker, which is not prose — it tells a consumer's
 * minifier that an allocation or namespace helper is droppable, and losing it
 * makes minified app bundles ~800 B larger. rolldown exposes the split
 * declaratively as `{ legal, annotation, jsdoc }`, so the browser entries keep
 * annotations and legal notices and drop the JSDoc. (rolldown's `//#region`
 * banners are emitted outside this filter and survive; they carry no code.)
 */
const BROWSER_COMMENTS = {
  legal: true,
  annotation: true,
  jsdoc: false,
} as const;

/** The rolldown equivalent of the retired esbuild browser-redirect plugin: same redirects, same stubs. */
function browserRedirect(): TsdownPlugin {
  return {
    name: "taglib-browser-redirect",
    resolveId(source, importer) {
      // The Emscripten glue is a separate artifact copied to dist/, never
      // bundled. Externalise it with its final emitted specifier so the
      // browser entries do not depend on scripts/fix-imports.js to repair a
      // build/-shaped path (and so minified template-literal quotes stay valid).
      if (source.endsWith("taglib-wrapper.js")) {
        return { id: "./taglib-wrapper.js", external: true };
      }
      if (
        source.endsWith("module-loader.ts") &&
        importer &&
        !source.includes("module-loader-browser")
      ) {
        return join(
          dirname(importer),
          source.replace("module-loader.ts", "module-loader-browser.ts"),
        );
      }
      if (source.endsWith("platform-io.ts")) return "\0taglib:platform-io-stub";
      if (source.endsWith("node-fs.ts")) return "\0taglib:node-fs-stub";
      return null;
    },
    renderChunk(code) {
      // rolldown emits //#region banners outside the comments filter; they
      // carry no code and leak internal source paths into the published bundle.
      return code.replace(/^\/\/#region .*\r?\n/gm, "");
    },
    load(id) {
      if (id === "\0taglib:platform-io-stub") return PLATFORM_IO_BROWSER_STUB;
      if (id === "\0taglib:node-fs-stub") return NODE_FS_BROWSER_STUB;
      return null;
    },
  };
}

export default defineConfig({
  // `vpr static` is the commit gate: the read-only whole-tree checks. It lives
  // here rather than in package.json because Vite Task content-caches tasks
  // defined in this file and does not cache package.json scripts — the hook
  // previously ran both passes on every commit.
  run: {
    tasks: {
      static: {
        command: "vp check",
        // The content cache tracks file reads with an fspy preload
        // (DYLD_INSERT_LIBRARIES). On macOS that preload makes `/usr/bin/env`
        // fail to exec `node`, which breaks tools launched through a
        // `#!/usr/bin/env node` shebang (oxlint's tsgolint wrapper). Caching
        // this gate is not worth breaking it (taglib-agec).
        cache: false,
      },
    },
  },
  fmt: {
    printWidth: 80,
    // Vendored trees, generated artifacts, and repo-hygiene scratch, plus
    // `lib/taglib/doc/` and `lib/taglib/bindings/README`, which hard-error
    // oxfmt's HTML/parser pass (`SyntaxError: Unexpected closing tag "body"`,
    // check exit 2). oxfmt reads these as gitignore-style `ignorePatterns`, not
    // `exclude`. The patterns `.gitignore` already covers (.beads/, .omp/,
    // .serena/, .worktrees/, .coverage/, dist/) are deliberately not repeated:
    // `vp fmt` uses .gitignore as its ignore file by default.
    ignorePatterns: [
      "lib/",
      "build/",
      "docs/.vuepress/",
      "docs/index.html",
      ".ast-grep/rule-tests/__snapshots__/",
      ".superpowers/",
    ],
  },
  lint: {
    options: { typeAware: true },
    // `options.typeAware` only makes the type-checked rules AVAILABLE, it does
    // not enable them, and oxlint's own defaults are mostly `warn`, so nothing
    // below exits non-zero on its own. `categories.correctness` is the lever
    // for the 111 rules oxlint enables by default (no-const-assign, the
    // no-unsafe-* family where it has a non-type-aware form, unicorn's
    // default set, …): they ran at `warn` and never failed the gate, while
    // both retired linters failed CI at `error`. Setting the category to
    // `error` restores that. `overrides` cannot set a category (oxlint accepts
    // only `files`/`rules`/… there), so the trees the retired linters never
    // linted at all are excluded from linting outright below.
    categories: { correctness: "error" },
    // Excluded by both retired linters (eslint.config.mjs `ignores` and
    // deno.json `lint.exclude`), so nothing in them was ever enforced —
    // keeping them unlinted is the pre-existing scope, not a new exemption.
    // Same scope the old `eslint .` and `deno lint` had.
    ignorePatterns: ["scripts/", "examples/", "tools/"],
    // Rules that oxlint does NOT enable by default (category `pedantic`,
    // `style`, `restriction`, or `correctness` with `default: false`) but
    // that a retired linter ran at `error`. Two sources:
    //   * the non-type-checked half of typescript-eslint's
    //     `recommendedTypeChecked` (the retired eslint.config.mjs extended that
    //     preset, so all 43 of its `error` rules were enforced for `src/`
    //     non-test). The 22 type-checked ones are listed first; the rest are
    //     below. Two of the preset's rules have no `typescript/` form in
    //     oxlint (`@typescript-eslint/no-array-constructor`,
    //     `@typescript-eslint/no-unused-expressions`), so their eslint core
    //     equivalents are enabled instead; `typescript/no-unused-vars` is off
    //     (both retired linters turned it off, and oxlint's `no-unused-vars`
    //     does not understand the `void x` idiom this repo uses).
    //   * deno lint's `recommended` set (87 rules, `deno lint` ran it at
    //     `error` over `src/` AND `tests/`). Its TS/ESLint rules that oxlint
    //     does not default-enable are enabled here, except `no-redeclare`:
    //     oxlint only ships the JS form, which reads `declare global {
    //     namespace Deno }` in src/global.d.ts as a redeclaration — legal TS
    //     that tsc checks, and the same reason typescript-eslint switches the
    //     core rule off for `.ts` files. Its rules that oxlint does not ship at
    //     all (`ban-untagged-ignore`, `no-sloppy-imports`, `no-window*`, the
    //     `jsx-*` set — this repo has no JSX, …) cannot be restored;
    //     `ban-types` / `no-empty-interface` are covered by their
    //     typescript-eslint v8 successors `no-unsafe-function-type`,
    //     `no-wrapper-object-types` and `no-empty-object-type`, which are
    //     already on via the category.
    rules: {
      "typescript/await-thenable": "error",
      "typescript/no-array-delete": "error",
      "typescript/no-base-to-string": "error",
      "typescript/no-duplicate-type-constituents": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-for-in-array": "error",
      "typescript/no-implied-eval": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-redundant-type-constituents": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-enum-comparison": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-unsafe-unary-minus": "error",
      "typescript/only-throw-error": "error",
      "typescript/prefer-promise-reject-errors": "error",
      "typescript/restrict-plus-operands": "error",
      "typescript/restrict-template-expressions": "error",
      "typescript/unbound-method": "error",

      // The `@typescript-eslint/ban-ts-comment` form of the retired eslint
      // config banned `@ts-nocheck` outright; deno lint's version (which also
      // covered `tests/`) allowed a directive that carries an explanation, and
      // the surviving four directives in this repo all carry one. Match deno's
      // semantics so those pre-existing, previously-green comments stay green.
      "typescript/ban-ts-comment": [
        "error",
        {
          "ts-check": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "ts-nocheck": "allow-with-description",
        },
      ],
      "typescript/adjacent-overload-signatures": "error",
      "typescript/no-empty-object-type": "error",
      "typescript/no-namespace": "error",
      "typescript/no-require-imports": "error",
      "typescript/no-unnecessary-type-constraint": "error",
      "typescript/no-unsafe-function-type": "error",
      "eslint/no-array-constructor": "error",
      "eslint/no-case-declarations": "error",
      "eslint/no-empty": "error",
      "eslint/no-fallthrough": "error",
      "eslint/no-inner-declarations": "error",
      "eslint/no-prototype-builtins": "error",
      "eslint/no-regex-spaces": "error",
      "eslint/no-var": "error",
      "eslint/prefer-const": "error",
      "eslint/prefer-rest-params": "error",
      "eslint/prefer-spread": "error",

      // Decisions inherited from the retired eslint.config.mjs (parity).
      // require-await is one of the 22 type-checked rules above in the preset
      // but the old config switched it off, so it stays off here.
      "typescript/require-await": "off",
      "typescript/no-explicit-any": "off",
      "no-unused-vars": "off",
    },
    overrides: [
      {
        // Tests were never type-checked by the retired eslint.config.mjs (it
        // ignored `tests/` and `**/*.test.ts`), so rules carrying pre-existing
        // findings there report at `warn`: new coverage, reported but not
        // gating. Every rule below with a finding in `tests/` was verified
        // against the pre-branch tree — the offending lines are byte-identical
        // at the base commit, so nothing here is a regression introduced by
        // this branch.
        files: ["tests/**", "**/*.test.ts"],
        rules: {
          "typescript/no-base-to-string": "warn",
          "typescript/no-floating-promises": "warn",
          "typescript/no-implied-eval": "warn",
          "typescript/no-redundant-type-constituents": "warn",
          "typescript/no-unnecessary-type-assertion": "warn",
          "typescript/no-unsafe-argument": "warn",
          "typescript/no-unsafe-assignment": "warn",
          "typescript/no-unsafe-call": "warn",
          "typescript/no-unsafe-member-access": "warn",
          "typescript/no-unsafe-return": "warn",
          "typescript/restrict-template-expressions": "warn",
          "typescript/unbound-method": "warn",
          "no-unused-expressions": "warn",
          "no-useless-escape": "warn",
          "unicorn/no-new-array": "warn",
          "unicorn/no-useless-length-check": "warn",
        },
      },
      {
        // The only rule with a genuine dist/ dependence: these two assertions
        // are flagged only while the gitignored `dist/taglib-wrapper.js` is
        // present, so at `error` the local gate reds on a build artifact while
        // CI (no dist/) stays green. `warn` keeps the finding visible on both.
        files: [
          "src/runtime/module-loader-browser.ts",
          "src/runtime/unified-loader/module-loading.ts",
        ],
        rules: {
          "typescript/no-unnecessary-type-assertion": "warn",
        },
      },
      {
        // `docs/` is a separate package: its dependencies live in
        // docs/package.json, and CI's lint job installs only the root
        // node_modules. With VitePress unresolved, docs/.vitepress/config.ts's
        // `defineConfig` import types as `error` and every type-aware
        // `no-unsafe-*` rule fires there — on CI only, and never a code defect
        // (measured: `vp lint --type-aware` exits 1 with docs/node_modules
        // hidden and 0 with it present, the identical one-line finding). Keep
        // the family visible at `warn` rather than red on missing deps.
        files: ["docs/**"],
        rules: {
          "typescript/no-unsafe-argument": "warn",
          "typescript/no-unsafe-assignment": "warn",
          "typescript/no-unsafe-call": "warn",
          "typescript/no-unsafe-member-access": "warn",
          "typescript/no-unsafe-return": "warn",
        },
      },
      {
        // Multi-runtime boundary code that necessarily uses `any` for
        // globalThis.Deno / .Bun / .process runtime detection. The old ESLint
        // config turned the whole `no-unsafe-*` family off for these five
        // files; oxlint's per-file `overrides` express the same thing.
        files: [
          "src/folder-api/file-processors.ts",
          "src/msgpack/decoder.ts",
          "src/msgpack/utils.ts",
          "src/runtime/detector.ts",
          "src/runtime/module-loader.ts",
        ],
        rules: {
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
        },
      },
      // Rules that neither retired linter enforced for `src/` (unicorn's
      // default set is oxlint-only; deno lint's `no-useless-escape` is not in
      // its `recommended` tag and eslint.config.mjs did not enforce core
      // rules for `.ts`). Each finding below is byte-identical at the base
      // commit, so `warn` keeps the pre-existing finding visible instead of
      // gating the branch on it.
      {
        files: ["src/simple/batch-operations.ts"],
        rules: { "unicorn/no-new-array": "warn" },
      },
      {
        files: ["src/folder-api/folder-disc.ts"],
        rules: { "no-useless-escape": "warn" },
      },
      {
        files: ["src/runtime/wasi-adapter/structured-fields.ts"],
        rules: { "unicorn/no-useless-fallback-in-spread": "warn" },
      },
      {
        files: ["src/folder-api/album-identity.ts"],
        rules: { "unicorn/no-useless-spread": "warn" },
      },
    ],
  },
  test: {
    // The suite is split across tests/ (integration) and src/ (colocated unit
    // tests). These globs replace the per-batch include list the migration grew.
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Test files that must NOT run under Vitest:
    //  - bun-integration.test.ts registers with bun:test (pnpm run test:bun)
    //  - cross-runtime/ runs under three runtimes via tests/cross-runtime/run.sh
    //  - tests/deno-*.test.ts run under Deno's own test runner
    //    (pnpm run test:deno) and use Deno-only globals.
    exclude: [
      "tests/bun-integration.test.ts",
      "tests/cross-runtime/**",
      "tests/deno-*.test.ts",
    ],
    pool: "forks",
    execArgv: ["--expose-gc"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: { provider: "v8", reporter: ["lcov", "text"] },
    // The Sonar run adds a Generic Test Data reporter (root <testExecutions>);
    // every other run keeps the default + junit reporters unchanged. Enable it
    // with SONAR_REPORT=1 (pnpm run test:sonar).
    reporters: process.env.SONAR_REPORT
      ? [
          "default",
          "junit",
          ["vitest-sonar-reporter", { outputFile: "sonar-report.xml" }],
        ]
      : ["default", "junit"],
    outputFile: { junit: "./junit.xml" },
  },
  pack: [
    {
      name: "js",
      entry: [
        // The public entry barrels are src/*.ts, so this glob's base is src/
        // and every file lands flat in dist/ (dist/index.js, dist/taglib/…).
        // Listing a repo-root file here would raise the base to the repo root
        // and nest everything under dist/src/ — that is what the retired
        // root-level barrels used to do.
        "src/**/*.ts",
        "!src/**/*.test.ts",
        // Owned by their own configs, which emit them as single files.
        "!src/*.browser.ts",
        "!src/disc-folder.ts",
      ],
      outDir: "dist",
      // The config default is false, but the retired esbuild build hard-failed
      // on an unresolvable bare specifier — the resolution gate CI advertises.
      // With warnings ignored, `vp pack` quietly treats an undeclared import as
      // an external, so every config sets this. The relative-specifier half is
      // covered by `node scripts/check-dist-resolution.mjs`.
      failOnWarn: true,
      // Syntax floor: the retired esbuild build passed `--target=es2020` in
      // every mode, and tsdown would otherwise default to package.json's
      // `engines.node` (>=24.0.0). The browser entries inherited that Node
      // default too, so every config sets this.
      //
      // Lowering to ES2020 makes oxc route class fields/private members through
      // runtime helpers, which the unbundled `js` config emits as separate
      // modules under `_virtual/_@oxc-project_runtime@<toolchain version>/`
      // (the browser entries inline them instead, ~1.6 KB each). The version in
      // that directory name is the one vite-plus pins, so a toolchain bump
      // renames it and the published file list moves with it; the files are
      // internal (no `exports` subpath reaches them) and ship under `dist/**`.
      target: "es2020",
      unbundle: true,
      treeshake: false,
      sourcemap: false,
      // Defaults to `platform === "node"`, i.e. true here; `.mjs` otherwise.
      fixedExtension: false,
      dts: false,
      platform: "node",
      // `build:clean` + `build:copy-wasm` own clearing/populating `dist`; a
      // pack-time clean would delete the copied wasm/glue.
      clean: false,
      // The glue is a copied, separately-loaded artifact: tsdown must not
      // re-emit a copy of it. `external` is deprecated in favour of this key.
      deps: { neverBundle: [/taglib-wrapper\.js$/] },
    },
    {
      name: "disc-folder",
      entry: ["src/disc-folder.ts"],
      outDir: "dist",
      failOnWarn: true,
      target: "es2020",
      platform: "neutral",
      fixedExtension: false,
      dts: false,
      clean: false,
    },
    // THREE single-entry configs, not one 3-entry config:
    // `outputOptions: { codeSplitting: false }` is rejected with multiple
    // inputs ("[INVALID_OPTION] … multiple inputs are not supported when
    // «output.codeSplitting» is false"), and rolldown's default splitting
    // emits hash-named sibling chunks. One entry per config ⇒ one file each.
    //
    // `comments: keepFunctional` rather than `false`: rolldown keeps every
    // JSDoc block where the retired esbuild build discarded nearly all of them,
    // and carrying that prose cost 22 KB on index.browser.js (151 KB → 173 KB)
    // plus 39 KB of *gzip*. Dropping *all* comments is not the fix either —
    // `/* @__PURE__ */` is functional (it is what lets a consumer's minifier
    // drop an unused allocation, and a build without it makes minified app
    // bundles ~800 B larger), and it is the one class of comment in these
    // files a consumer needs. So keep the annotations and legal notices, drop
    // the prose. rolldown's `//#region` banners are not comments it filters, so
    // they remain; they carry no code. All three entries are smaller than their
    // 2.3.0 files, raw and gzipped.
    {
      name: "browser-index",
      entry: ["src/index.browser.ts"],
      outDir: "dist",
      failOnWarn: true,
      target: "es2020",
      platform: "browser",
      fixedExtension: false,
      dts: false,
      clean: false,
      minify: { compress: false, mangle: false },
      outputOptions: { codeSplitting: false, comments: BROWSER_COMMENTS },
      plugins: [browserRedirect()],
    },
    {
      name: "browser-simple",
      entry: ["src/simple.browser.ts"],
      outDir: "dist",
      failOnWarn: true,
      target: "es2020",
      platform: "browser",
      fixedExtension: false,
      dts: false,
      clean: false,
      minify: { compress: false, mangle: false },
      outputOptions: { codeSplitting: false, comments: BROWSER_COMMENTS },
      plugins: [browserRedirect()],
    },
    {
      name: "browser-web",
      entry: ["src/web.browser.ts"],
      outDir: "dist",
      failOnWarn: true,
      target: "es2020",
      platform: "browser",
      fixedExtension: false,
      dts: false,
      clean: false,
      minify: { compress: false, mangle: false },
      outputOptions: { codeSplitting: false, comments: BROWSER_COMMENTS },
      plugins: [browserRedirect()],
    },
  ],
});
