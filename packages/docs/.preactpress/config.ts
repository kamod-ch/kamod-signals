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
      { text: "Introduction", link: "/guide/getting-started" },
      { text: "Guides", link: "/guide/signals-and-storage" },
      { text: "Examples", link: "/examples/theme-preferences" },
      { text: "API", link: "/guide/api" },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Which state belongs where?", link: "/guide/which-state-belongs-where" },
        ],
      },
      {
        text: "Signals and storage",
        items: [
          { text: "Signals and storage", link: "/guide/signals-and-storage" },
          { text: "Storage drivers", link: "/guide/storage-drivers" },
          { text: "Cookie request contexts", link: "/guide/cookie-request-contexts" },
        ],
      },
      {
        text: "Models",
        items: [
          { text: "Models and actions", link: "/guide/models-and-actions" },
          { text: "Persisted models", link: "/guide/persisted-models" },
          { text: "Versioning and migrations", link: "/guide/versioning-and-migrations" },
          { text: "SSR and hydration", link: "/guide/ssr-and-hydration" },
          { text: "Cross-tab sync", link: "/guide/cross-tab-sync" },
          { text: "Lifecycle and devtools", link: "/guide/lifecycle-and-devtools" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Theme preferences", link: "/examples/theme-preferences" },
          { text: "Auth session cookie", link: "/examples/auth-session-cookie" },
          { text: "Cart migration", link: "/examples/cart-migration" },
          { text: "Dashboard filters sync", link: "/examples/dashboard-filters-sync" },
          { text: "Preact SSR and Hono", link: "/examples/preact-ssr-hono" },
          { text: "Storage showcase", link: "/examples/storage-showcase" },
          { text: "Cookie SSR", link: "/examples/cookie-ssr" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/guide/api" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
          { text: "Architecture ADR", link: "/architecture/persisted-signals-state-layer-adr" },
        ],
      },
    ],
  },
});
