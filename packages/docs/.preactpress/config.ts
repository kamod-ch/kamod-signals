import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@kamod-ch/preactpress/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(configDir, "..");
const preactpressPackage = path.resolve(docsRoot, "node_modules/@kamod-ch/preactpress");
const preactpressClient = path.join(preactpressPackage, "src/client");
const preactpressTheme = path.join(preactpressClient, "theme-default");

const matomoImageTracker =
  '<!-- Matomo Image Tracker--><img referrerpolicy="no-referrer-when-downgrade" src="https://matomo.kamod.ch/matomo.php?idsite=8&amp;rec=1" style="border:0" alt="" /><!-- End Matomo -->'

const includeMatomoImageTracker = process.env.PREACTPRESS_INCLUDE_MATOMO === 'true'

const isGithubPagesBuild = process.env.GITHUB_ACTIONS === 'true' || process.env.KAMOD_DOCS_BASE === 'github-pages'
const base = isGithubPagesBuild ? '/kamod-signals/' : '/'
const url = isGithubPagesBuild ? 'https://kamod-ch.github.io' : 'http://localhost:4173'


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
    base,
    url
  },
  markdown: {
    html: false,
    emoji: true,
  },
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg`, type: "image/svg+xml" }],
    ["link", { rel: "apple-touch-icon", href: `${base}favicon.svg` }],
  ],
  transformHtml(html) {
    if (!includeMatomoImageTracker) return html
    return html.replace('</body>', `  ${matomoImageTracker}\n  </body>`)
  },
  themeConfig: {
    search: true,
    outline: true,
    footer: "Built with PreactPress.",
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/kamod-ch/kamod-signals",
        ariaLabel: "@kamod-ch/signals",
      },
    ],
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Models", link: "/guide/models-and-actions" },
      { text: "API", link: "/guide/api" },
      { text: "Examples", link: "/examples/storage-showcase" },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Models and actions", link: "/guide/models-and-actions" },
          { text: "Persisted models", link: "/guide/persisted-models" },
          { text: "Versioning and migrations", link: "/guide/versioning-and-migrations" },
          { text: "API", link: "/guide/api" },
          { text: "Architecture ADR", link: "/architecture/persisted-signals-state-layer-adr" },
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
