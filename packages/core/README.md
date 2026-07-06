<p align="center">
  <img src="https://raw.githubusercontent.com/kamod-ch/signals/main/assets/readme-banner.svg" alt="Kamod Signals" width="304" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kamod-ch/signals"><img src="https://img.shields.io/npm/v/%40kamod-ch%2Fsignals" alt="npm version" /></a>
  <a href="https://github.com/kamod-ch/kamod-signals/actions/workflows/gh-pages.yml"><img src="https://github.com/kamod-ch/kamod-signals/actions/workflows/gh-pages.yml/badge.svg" alt="Docs deploy" /></a>
  <a href="https://github.com/kamod-ch/signals/stargazers"><img src="https://img.shields.io/github/stars/kamod-ch/signals?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/kamod-ch/signals/blob/main/packages/core/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

<p align="center">
  <strong><a href="https://kamod-ch.github.io/kamod-signals/">Docs</a></strong> ·
  <strong><a href="https://www.npmjs.com/package/@kamod-ch/signals">npm</a></strong> ·
  <strong><a href="https://github.com/kamod-ch/signals">GitHub</a></strong> ·
  <strong><a href="https://github.com/kamod-ch/signals/issues">Issues</a></strong>
</p>

# @kamod-ch/signals

Persisted Preact signals for `localStorage`, `sessionStorage`, IndexedDB, cookies, and memory.

`@kamod-ch/signals` is a lightweight helper package for Preact apps that need reactive state with durable storage. It is SSR-safe, supports cookie request contexts, and keeps the familiar `@preact/signals` API.

## Keywords

`preact` · `signals` · `preact-signals` · `state-management` · `persistent-state` · `localstorage` · `sessionstorage` · `reactivity` · `typescript` · `vite` · `kamod`

## Installation

```bash
npm install @kamod-ch/signals @preact/signals preact
```

`@preact/signals` and `preact` are peer dependencies.

## Usage

### Basic persisted signal

```ts
import { persistedSignal } from "@kamod-ch/signals";

export const theme = persistedSignal("theme", "dark", { storage: "local" });
```

### Preact hook

```tsx
import { usePersistedSignal } from "@kamod-ch/signals";

export function Sidebar() {
  const isOpen = usePersistedSignal("sidebar-open", true, { storage: "session" });

  return <button onClick={() => (isOpen.value = !isOpen.value)}>Toggle</button>;
}
```

### Cookie-backed signal

```ts
import { persistedSignal } from "@kamod-ch/signals";

export const token = persistedSignal("token", "", {
  storage: "cookie",
  cookie: { expires: 7, path: "/" },
});
```

## API

```ts
persistedSignal<T>(key: string, initialValue: T, options?: PersistedSignalOptions<T>): PersistedSignal<T>
usePersistedSignal<T>(key: string, initialValue: T, options?: PersistedSignalOptions<T>): PersistedSignal<T>
```

```ts
type PersistedSignalOptions<T> = {
  storage?: "local" | "session" | "indexeddb" | "cookie" | "memory";
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  sync?: boolean;
  removeOnUndefined?: boolean;
  indexedDB?: { database?: string; store?: string; version?: number };
  cookie?: {
    expires?: number | Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
  };
  cookieContext?: CookieContext;
};
```

All persisted signals keep the normal signal shape, so values are read and written via `.value`.

## SSR cookie context

Use `createCookieContext()` when a cookie-backed value must be available during server-side rendering.

```ts
import { createCookieContext, persistedSignal } from "@kamod-ch/signals";

const cookieContext = createCookieContext({
  cookie: request.headers,
  onSetCookie: (header) => response.headers.append("set-cookie", header),
});

const theme = persistedSignal("theme", "dark", {
  storage: "cookie",
  cookieContext,
  cookie: { path: "/", sameSite: "Lax" },
});
```

## Storage drivers

- `local`: persists to `localStorage` in the browser.
- `session`: persists to `sessionStorage` in the browser.
- `indexeddb`: persists asynchronously to IndexedDB.
- `cookie`: persists to browser cookies or an SSR `cookieContext`.
- `memory`: keeps values in memory only.

## Notes

- SSR-safe: browser-only storage is never touched on the server.
- Cookie SSR works when you pass `cookieContext`, and caching stays scoped to that request context.
- `local`, `session`, and `indexeddb` fall back to in-memory storage when unavailable.
- IndexedDB hydration is async, so signals start with `initialValue` and update after the persisted value loads.
- `persistedSignal()` returns the same signal for the same global identity (`storage + key`, with `cookieContext` scoping for SSR cookies).
- Reusing that identity requires the same effective options; conflicting options throw instead of being ignored.

## Publishing

This package is published from `packages/core` only:

```bash
pnpm publish:core
```

---

Built by Klaus Zahiragic | Kamod GmbH

[Website](https://www.kamod.ch) ·
[LinkedIn](https://www.linkedin.com/in/klauszahiragic/)
