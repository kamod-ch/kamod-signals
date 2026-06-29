---
title: API
description: Options and return values for persistedSignal and usePersistedSignal.
---

# API

A quick reference for the main functions, options, and runtime behavior.

> **Recommended order:** choose `storage` first, then add `sync`, custom serialization, cookie options, or IndexedDB config only if needed.

## Functions

```ts
persistedSignal<T>(key: string, initialValue: T, options?: PersistedSignalOptions<T>): PersistedSignal<T>
usePersistedSignal<T>(key: string, initialValue: T, options?: PersistedSignalOptions<T>): PersistedSignal<T>
```

- Use `persistedSignal()` for shared signals across modules.
- Use `usePersistedSignal()` inside components.

## Quick examples

```ts
const theme = persistedSignal("theme", "dark", { storage: "local" });
const sidebarOpen = usePersistedSignal("sidebar-open", true, { storage: "session" });
```

## Options

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

## Most important options

| Option | Purpose | Typical use |
| --- | --- | --- |
| `storage` | selects the backing store | `local`, `session`, `cookie`, `indexeddb` |
| `serialize` / `deserialize` | customize stored format | complex values or compatibility with existing data |
| `sync` | keep controllers in sync | disable only when inbound updates are not wanted |
| `removeOnUndefined` | remove persisted value when signal becomes `undefined` | optional values |
| `indexedDB` | IndexedDB-specific settings | multi-db or multi-store setups |
| `cookie` | cookie-specific settings | SSR-visible values |
| `cookieContext` | server-aware cookie access during SSR | Astro, Fresh, middleware, SSR routes |

## Returned signal

```ts
type PersistedSignal<T> = Signal<T> & {
  clear(): void;
  reset(): void;
}
```

### Methods

- `clear()` removes the persisted value and restores `initialValue`.
- `reset()` restores `initialValue` and persists it again.

## Runtime rules

- Browser-only storage is never touched on the server.
- `local`, `session`, and `indexeddb` fall back to memory when unavailable.
- IndexedDB hydration is async, so the signal starts with `initialValue` and updates after loading.
- `persistedSignal()` is global by identity.
- Reusing the same global identity requires the same effective options; conflicting options throw.
- For SSR cookie usage, different `cookieContext` values stay isolated.

## Important behavior notes

### Global `persistedSignal()` reuse

These calls reuse the same signal:

```ts
persistedSignal("theme", "dark", { storage: "local" });
persistedSignal("theme", "light", { storage: "local" });
```

But if you reuse the same identity with conflicting options, an error is thrown:

```ts
persistedSignal("theme", "dark", { storage: "local", sync: true });
persistedSignal("theme", "dark", { storage: "local", sync: false }); // throws
```

### IndexedDB hydration

IndexedDB-backed signals do not block render. They start with `initialValue` and update after the stored value loads.

### Cookie SSR

Use `cookieContext` only when the server must read or write the cookie during SSR.

## Related pages

- [Getting started](/guide/getting-started)
- [Storage showcase](/examples/storage-showcase)
- [Cookie SSR](/examples/cookie-ssr)
