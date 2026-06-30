<p align="center">
  <a href="https://kamod-ch.github.io/kamod-signals/">
    <img src="assets/readme-banner-light.svg#gh-light-mode-only" alt="kamod Signals" height="40" />
    <img src="assets/readme-banner-dark.svg#gh-dark-mode-only" alt="kamod Signals" height="40" />
  </a>
</p>

# @kamod-ch/signals

Persisted Preact signals for localStorage, sessionStorage, IndexedDB, cookies, and memory.

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
persistedSignal<T>(key: string, initialValue: T, options?: PersistedSignalOptions<T>): PersistedSignal<T>
usePersistedSignal<T>(key: string, initialValue: T, options?: PersistedSignalOptions<T>): PersistedSignal<T>
```

### Options

```ts
type PersistedSignalOptions<T> = {
  storage?: "local" | "session" | "indexeddb" | "cookie" | "memory";
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  sync?: boolean;
  removeOnUndefined?: boolean;
  indexedDB?: {
    database?: string;
    store?: string;
    version?: number;
  };
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

### Returned signal

```ts
type PersistedSignal<T> = Signal<T> & {
  clear(): void; // remove persisted value and restore initialValue
  reset(): void; // restore initialValue and persist it again
}
```

### SSR cookie context

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

`createCookieContext()` accepts:
- a raw cookie header string
- a `Headers` instance
- `{ cookie, onSetCookie }`

Use `cookieContext.toSetCookieHeaders?.()` if you want to collect outgoing `Set-Cookie` values manually.

### Fresh example

```ts
import { createCookieContext, persistedSignal } from "@kamod-ch/signals";
import { FreshContext } from "$fresh/server.ts";

export async function handler(req: Request, ctx: FreshContext) {
  const response = await ctx.render();

  const cookieContext = createCookieContext({
    cookie: req.headers,
    onSetCookie: (header) => response.headers.append("set-cookie", header),
  });

  const theme = persistedSignal("theme", "dark", {
    storage: "cookie",
    cookieContext,
    cookie: { path: "/", sameSite: "Lax" },
  });

  theme.value = "light";
  return response;
}
```

### Astro example

```ts
---
import { createCookieContext, persistedSignal } from "@kamod-ch/signals";

const cookieContext = createCookieContext({
  cookie: Astro.request.headers,
  onSetCookie: (header) => Astro.response.headers.append("set-cookie", header),
});

const theme = persistedSignal("theme", "dark", {
  storage: "cookie",
  cookieContext,
  cookie: { path: "/", sameSite: "Lax" },
});
---
```

## Notes

- SSR-safe: browser-only storage is never touched on the server.
- Cookie SSR works when you pass `cookieContext`, and caching stays scoped to that request context.
- Different SSR cookie contexts stay isolated, and no explicit cleanup call is required for the documented pattern.
- `local`, `session`, and `indexeddb` fall back to in-memory storage when unavailable.
- IndexedDB hydration is async, so signals start with `initialValue` and update after the persisted value loads.
- `persistedSignal()` returns the same signal for the same global identity (`storage + key`, with `cookieContext` scoping for SSR cookies).
- Reusing that identity requires the same effective options; conflicting options throw instead of being ignored.
