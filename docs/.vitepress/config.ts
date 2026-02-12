import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",
  title: "TagLib-Wasm",
  description:
    "TagLib compiled to WebAssembly with TypeScript bindings for universal audio metadata handling",

  base: "/taglib-wasm/",

  lastUpdated: true,

  // Dead links checking enabled
  ignoreDeadLinks: false,

  // Clean URLs (no .html extension)
  cleanUrls: true,

  themeConfig: {
    logo: undefined,
    siteTitle: "TagLib-Wasm",

    search: {
      provider: "local",
    },

    editLink: {
      pattern:
        "https://github.com/CharlesWiltgen/taglib-wasm/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/CharlesWiltgen/taglib-wasm" },
      { icon: "npm", link: "https://www.npmjs.com/package/taglib-wasm" },
    ],

    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API Reference", link: "/api/" },
      { text: "Examples", link: "/guide/examples" },
      { text: "NPM", link: "https://www.npmjs.com/package/taglib-wasm" },
      { text: "JSR", link: "https://jsr.io/@charlesw/taglib-wasm" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Platform Guide", link: "/guide/platform-examples" },
            { text: "Deno Compile", link: "/guide/deno-compile" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Cover Art", link: "/guide/cover-art" },
            { text: "Track Ratings", link: "/guide/ratings" },
            { text: "Folder Operations", link: "/guide/folder-operations" },
            { text: "Examples", link: "/guide/examples" },
            { text: "Workers Setup", link: "/guide/workers-setup" },
            { text: "Codec Detection", link: "/guide/codec-detection" },
            { text: "Album Processing", link: "/guide/album-processing" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            {
              text: "Runtime Compatibility",
              link: "/concepts/runtime-compatibility",
            },
            { text: "Memory Management", link: "/concepts/memory-management" },
            { text: "Performance", link: "/concepts/performance" },
            {
              text: "Performance & Streaming",
              link: "/guide/performance-streaming",
            },
            { text: "Error Handling", link: "/concepts/error-handling" },
          ],
        },
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Folder API", link: "/api/folder-api" },
            { text: "Tag Name Constants", link: "/api/tag-constants" },
            { text: "Property Map", link: "/api/property-map" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Implementation", link: "/advanced/implementation" },
            { text: "Troubleshooting", link: "/advanced/troubleshooting" },
            {
              text: "Cloudflare Workers",
              link: "/advanced/cloudflare-workers",
            },
          ],
        },
        {
          text: "Development",
          items: [
            { text: "Testing", link: "/development/testing" },
            {
              text: "Version Management",
              link: "/development/version-management",
            },
            { text: "Improvements", link: "/development/improvements" },
            {
              text: "Deno Compatibility Fix",
              link: "/development/deno-compatibility-fix",
            },
            { text: "Publishing", link: "/advanced/publishing" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Folder API", link: "/api/folder-api" },
            { text: "Tag Name Constants", link: "/api/tag-constants" },
            { text: "Property Map", link: "/api/property-map" },
          ],
        },
      ],
      "/concepts/": [
        {
          text: "Core Concepts",
          items: [
            {
              text: "Runtime Compatibility",
              link: "/concepts/runtime-compatibility",
            },
            { text: "Memory Management", link: "/concepts/memory-management" },
            { text: "Performance", link: "/concepts/performance" },
            { text: "Error Handling", link: "/concepts/error-handling" },
          ],
        },
      ],
      "/advanced/": [
        {
          text: "Advanced Topics",
          items: [
            { text: "Implementation", link: "/advanced/implementation" },
            { text: "Troubleshooting", link: "/advanced/troubleshooting" },
            {
              text: "Cloudflare Workers",
              link: "/advanced/cloudflare-workers",
            },
            { text: "Publishing", link: "/advanced/publishing" },
          ],
        },
      ],
      "/development/": [
        {
          text: "Development",
          items: [
            { text: "Testing", link: "/development/testing" },
            {
              text: "Version Management",
              link: "/development/version-management",
            },
            { text: "Improvements", link: "/development/improvements" },
            {
              text: "Deno Compatibility Fix",
              link: "/development/deno-compatibility-fix",
            },
          ],
        },
      ],
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Charles Wiltgen",
    },
  },
});
