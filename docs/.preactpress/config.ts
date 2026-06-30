import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@kamod-ch/preactpress/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(configDir, "..");
const preactpressPackage = path.resolve(docsRoot, "node_modules/@kamod-ch/preactpress");
const preactpressClient = path.join(preactpressPackage, "src/client");
const preactpressTheme = path.join(preactpressClient, "theme-default");

const base = process.env.VITE_BASE_PATH?.trim() || "/";

export default defineConfig({
  theme: "./theme/Layout.tsx",
  vite: {
    resolve: {
      alias: [
        { find: "@preactpress-internal/client", replacement: preactpressClient },
        { find: "@preactpress-internal/theme-default", replacement: preactpressTheme },
      ],
    },
  },
  srcExclude: ["README.md"],
  site: {
    title: "kamod Signals",
    description: "Persisted Preact signals for localStorage, sessionStorage, IndexedDB, cookies, and memory.",
    url: "https://kamod-ch.github.io",
    base,
  },
  markdown: {
    html: false,
    emoji: true,
  },
  themeConfig: {
    search: true,
    outline: true,
    footer: "Built with PreactPress.",
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/kamod-ch/kamod-signals",
        ariaLabel: "kamod-signals on GitHub",
      },
    ],
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/guide/api" },
      { text: "Examples", link: "/examples/storage-showcase" },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "API", link: "/guide/api" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Storage showcase", link: "/examples/storage-showcase" },
          { text: "Cookie SSR", link: "/examples/cookie-ssr" },
        ],
      },
    ],
  },
});
