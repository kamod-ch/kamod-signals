<p align="center">
  <img src="assets/readme-banner.svg" alt="Kamod Signals" width="304" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kamod-ch/signals"><img src="https://img.shields.io/npm/v/%40kamod-ch%2Fsignals" alt="npm version" /></a>
  <a href="https://github.com/kamod-ch/signals/actions/workflows/gh-pages.yml"><img src="https://github.com/kamod-ch/signals/actions/workflows/gh-pages.yml/badge.svg" alt="Docs deploy" /></a>
  <a href="https://github.com/kamod-ch/signals/stargazers"><img src="https://img.shields.io/github/stars/kamod-ch/signals?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/kamod-ch/signals/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

<p align="center">
  <strong><a href="https://kamod-ch.github.io/signals/">Live docs</a></strong> ·
  <strong><a href="https://www.npmjs.com/package/@kamod-ch/signals">npm</a></strong> ·
  <strong><a href="https://github.com/kamod-ch/signals">GitHub</a></strong> ·
  <strong><a href="https://github.com/kamod-ch/signals/issues">Issues</a></strong>
</p>

> If Kamod Signals saves you time, **[star the repo](https://github.com/kamod-ch/signals)** — it helps others discover the project.

# Kamod Signals

Monorepo for `@kamod-ch/signals` and the PreactPress documentation site.

`@kamod-ch/signals` is a lightweight helper package for Preact apps that need reactive state with durable storage. It is SSR-safe, supports cookie request contexts, and keeps the familiar `@preact/signals` API for `localStorage`, `sessionStorage`, IndexedDB, cookies, and memory.

## Structure

```txt
packages/core/  # @kamod-ch/signals package source, storage drivers and tests
packages/docs/  # PreactPress documentation site
```

## Install

Install dependencies from the repository root:

```bash
pnpm install
```

The root package uses pnpm workspaces for `packages/*`.

## Commands

```bash
pnpm run build          # build @kamod-ch/signals
pnpm run build:core     # build only the core package
pnpm run build:docs     # build only the docs site
pnpm run test           # run Vitest tests
pnpm run typecheck      # run TypeScript checks
pnpm run docs:dev       # start PreactPress locally
pnpm run docs:check     # run PreactPress checks
pnpm run docs:build     # build the docs site
pnpm run docs:preview   # preview the built docs
pnpm run verify         # typecheck, test, build and check docs
pnpm run pack:core      # dry-run the published package contents
pnpm run publish:core   # publish packages/core
```

## Local docs

```bash
pnpm install
pnpm run docs:dev
```

The docs live in `packages/docs/` and are configured in `packages/docs/.preactpress/config.ts`.

## Build and verify

```bash
pnpm run verify
```

This runs:

1. `pnpm run typecheck`
2. `pnpm run test`
3. `pnpm run build`
4. `pnpm run docs:check`

---

Built by Klaus Zahiragic | Kamod GmbH

[Website](https://www.kamod.ch) ·
[LinkedIn](https://www.linkedin.com/in/klauszahiragic/)
