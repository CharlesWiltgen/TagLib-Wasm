import { defaultTheme } from "@vuepress/theme-default";
import { defineUserConfig } from "vuepress";
import { viteBundler } from "@vuepress/bundler-vite";

export default defineUserConfig({
  lang: "en-US",
  title: "TagLib-Wasm",
  description:
    "TagLib compiled to WebAssembly with TypeScript bindings for universal audio metadata handling",

  base: "/taglib-wasm/",

  bundler: viteBundler(),

  theme: defaultTheme({
    logo: null,
    repo: "CharlesWiltgen/taglib-wasm",
    docsDir: "docs",
    editLink: true,
    editLinkText: "Edit this page on GitHub",
    lastUpdated: true,

    navbar: [
      {
        text: "Guide",
        link: "/guide/",
      },
      {
        text: "API Reference",
        link: "/api/",
      },
      {
        text: "Examples",
        link: "/guide/examples.md",
      },
      {
        text: "NPM",
        link: "https://www.npmjs.com/package/taglib-wasm",
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          children: [
            "/guide/README.md",
            "/guide/installation.md",
            "/guide/quick-start.md",
            "/guide/platform-examples.md",
            "/guide/deno-compile.md",
          ],
        },
        {
          text: "Features",
          children: [
            "/guide/cover-art.md",
            "/guide/folder-operations.md",
            "/guide/examples.md",
            "/guide/workers-setup.md",
            "/features/codec-detection.md",
          ],
        },
        {
          text: "Core Concepts",
          children: [
            "/concepts/runtime-compatibility.md",
            "/concepts/memory-management.md",
            "/concepts/performance.md",
            "/guide/performance-streaming.md",
            "/concepts/error-handling.md",
          ],
        },
        {
          text: "API Reference",
          children: [
            "/api/README.md",
            "/api/folder-api.md",
            "/api/tag-name-constants.md",
            "/api/property-map.md",
          ],
        },
        {
          text: "Advanced",
          children: [
            "/advanced/implementation.md",
            "/advanced/troubleshooting.md",
            "/advanced/cloudflare-workers.md",
          ],
        },
        {
          text: "Development",
          children: [
            "/development/testing.md",
            "/development/version-management.md",
            "/development/improvements.md",
            "/development/deno-compatibility-fix.md",
            "/advanced/publishing.md",
          ],
        },
      ],
      "/": [
        {
          text: "Documentation",
          children: [
            "/api/README.md",
            "/api/tag-name-constants.md",
            "/api/property-map.md",
            "/concepts/runtime-compatibility.md",
            "/concepts/memory-management.md",
            "/concepts/performance.md",
            "/concepts/error-handling.md",
            "/advanced/implementation.md",
            "/advanced/troubleshooting.md",
            "/advanced/publishing.md",
            "/advanced/cloudflare-workers.md",
          ],
        },
      ],
    },
  }),
});
