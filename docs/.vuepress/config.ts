import { defaultTheme } from "@vuepress/theme-default";
import { defineUserConfig } from "vuepress";
import { viteBundler } from "@vuepress/bundler-vite";

export default defineUserConfig({
  lang: "en-US",
  title: "TagLib-WASM",
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
        link: "/API.md",
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
          ],
        },
        {
          text: "Core Concepts",
          children: [
            "/Runtime-Compatibility.md",
            "/Performance.md",
            "/Error-Handling.md",
          ],
        },
        {
          text: "Advanced",
          children: [
            "/Implementation.md",
            "/Troubleshooting.md",
            "/Publishing.md",
            "/Cloudflare-Workers.md",
          ],
        },
      ],
      "/": [
        {
          text: "Documentation",
          children: [
            "/API.md",
            "/Runtime-Compatibility.md",
            "/Performance.md",
            "/Error-Handling.md",
            "/Implementation.md",
            "/Troubleshooting.md",
            "/Publishing.md",
            "/Cloudflare-Workers.md",
          ],
        },
      ],
    },
  }),
});
