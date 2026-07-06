# @kamod-ch/signals

Persisted Preact signals for `localStorage`, `sessionStorage`, IndexedDB, cookies, and memory.

`@kamod-ch/signals` is a lightweight helper package for Preact apps that need reactive state with durable storage. It is SSR-safe, supports cookie request contexts, and keeps the familiar `@preact/signals` API.

- Docs: <https://kamod-ch.github.io/kamod-signals/>
- npm: <https://www.npmjs.com/package/@kamod-ch/signals>
- Repository: <https://github.com/kamod-ch/kamod-signals>

## Install

```bash
pnpm add @kamod-ch/signals @preact/signals preact
```

## Usage

```ts
import { persistedSignal, usePersistedSignal } from "@kamod-ch/signals";

export const theme = persistedSignal("theme", "dark", { storage: "local" });

export const token = persistedSignal("token", "", {
  storage: "cookie",
  cookie: { expires: 7, path: "/" },
});

function Sidebar() {
  const isOpen = usePersistedSignal("sidebar-open", true, { storage: "session" });

  return <button onClick={() => (isOpen.value = !isOpen.value)}>Toggle</button>;
}
```

## API

```ts
persistedSignal<T>(
  key: string,
  initialValue: T,
  options?: PersistedSignalOptions<T>
): PersistedSignal<T>;

usePersistedSignal<T>(
  key: string,
  initialValue: T,
  options?: PersistedSignalOptions<T>
): PersistedSignal<T>;
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

## Notes

- SSR-safe: browser-only storage is never touched on the server.
- `local`, `session`, and `indexeddb` fall back to in-memory storage when unavailable.
- IndexedDB hydration is async, so signals start with `initialValue` and update after the persisted value loads.
- Cookie SSR works when you pass `cookieContext`; cache identity stays scoped to that request context.

## Publishing

This package is published from `packages/core` only:

```bash
pnpm publish:core
```
