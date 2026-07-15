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
createPersistedModel<TModel, TSnapshot, TArgs>(options, factory): ModelConstructor<TModel & PersistedModelControls, TArgs>
createPersistedScope(options?): PersistedScope
dehydratePersisted(scope): PersistedDehydratedState
hydratePersisted(state): void
serializePersistedStateForHtml(state): string
createBroadcastSyncTransport(channel): PersistedSyncTransport | null
createPersistedEventTarget(options?): PersistedEventTarget
```

- Use `persistedSignal()` for shared signals across modules.
- Use `usePersistedSignal()` inside components.
- Use `createPersistedModel()` for a typed, explicitly selected persisted snapshot of a Preact Signals model.
- Use persisted scopes to isolate SSR requests and dehydrate/hydrate state safely.

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
  version?: number;
  migrate?: (snapshot: unknown, fromVersion: number) => T | Promise<T>;
  validate?: (snapshot: unknown) => snapshot is T;
  migrationErrorStrategy?: "preserve" | "reset" | "throw";
  legacyVersion?: number;
  scope?: PersistedScope;
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
| `version` / `migrate` / `validate` | evolve persisted payloads safely | schema changes |
| `scope` | request-local SSR collection and hydration | Preact SSR, Hono, edge runtimes |
| `sync: "tabs"` | opt-in persisted model cross-tab sync | preferences shared across tabs |
| `events` | lifecycle observability | logging, metrics, devtools plugins |
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

## Model APIs

`@kamod-ch/signals` also re-exports official Preact Signals model primitives:

```ts
signal
computed
effect
batch
untracked
action
createModel
useModel
```

See [Models and actions](/guide/models-and-actions), [Persisted models](/guide/persisted-models), and [Versioning and migrations](/guide/versioning-and-migrations).

## Related pages

- [Getting started](/guide/getting-started)
- [Models and actions](/guide/models-and-actions)
- [Persisted models](/guide/persisted-models)
- [Versioning and migrations](/guide/versioning-and-migrations)
- [SSR and hydration](/guide/ssr-and-hydration)
- [Cross-tab sync](/guide/cross-tab-sync)
- [Lifecycle and devtools](/guide/lifecycle-and-devtools)
- [Storage showcase](/examples/storage-showcase)
- [Cookie SSR](/examples/cookie-ssr)
