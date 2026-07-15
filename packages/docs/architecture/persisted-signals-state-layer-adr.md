---
title: "ADR: Persisted signals state layer"
---

# ADR: Persisted signals state layer

Status: draft  
Date: 2026-07-15

## Context

`@kamod-ch/signals` currently adds persistence to `@preact/signals` signals. The reactive runtime remains upstream Preact Signals; Kamod should not introduce a separate signal engine, Redux/Zustand-style store, server-state cache, or form-state layer.

The current package supports `localStorage`, `sessionStorage`, IndexedDB, cookies, and memory. Browser-only APIs are guarded by `isBrowser`, and SSR cookie usage is isolated with explicit `CookieContext` objects.

## Current public API

| Export | Purpose | Browser/SSR | Sync/async | Stability risk |
| --- | --- | --- | --- | --- |
| `persistedSignal<T>(key, initialValue, options?)` | Creates or reuses a globally identified persisted signal. | Browser-safe; SSR-safe; cookie SSR requires `cookieContext`. | Sync for local/session/cookie/memory; async hydration for IndexedDB. | Medium: global registry identity and option conflict semantics are observable. |
| `usePersistedSignal<T>(key, initialValue, options?)` | Component-scoped persisted signal controller with cleanup on unmount. | Browser/preact component usage; import is SSR-safe. | Same as `persistedSignal`; cleanup via hook effect. | Medium: dependency tracking must stay aligned with options. |
| `createCookieContext(input?)` | Request/local cookie adapter for SSR and tests. | Browser-independent; request-scoped when caller creates per request. | Sync. | Low/medium: API is central for SSR isolation. |
| `serializeCookie(key, value, options?)` | Formats a `Set-Cookie` header value. | SSR and browser-independent. | Sync. | Low: utility behavior is simple but security-sensitive. |
| `PersistedSignal<T>` | `Signal<T>` plus `clear()` and `reset()`. | Type only. | N/A | Medium: methods are already public. |
| `PersistedSignalOptions<T>` | Storage, serializer, sync, cookie, and IndexedDB configuration. | Type only. | N/A | Medium: future options must avoid collisions. |
| `PersistedStorage` | Built-in storage discriminator. | Type only. | N/A | Low. |
| `CookieOptions` | Cookie attributes. | Type only. | N/A | Low. |
| `CookieContext` | Cookie read/write/subscribe adapter. | Type only. | N/A | Medium: request scope contract. |
| `IndexedDBOptions` | IndexedDB database/store/version options. | Type only. | N/A | Low. |

Implementation-only exports in `persistedSignal.ts` (`createPersistedSignal`, `__private__`) are not reachable from the package root and must remain private or be replaced by intentional public APIs.

## Upstream Preact Signals comparison

Installed development version: `@preact/signals@2.9.2` with `@preact/signals-core@1.14.3`.

Upstream exports include:

- `signal`
- `computed`
- `effect`
- `batch`
- `untracked`
- `action`
- `createModel`
- `useModel`
- `Signal`
- `ReadonlySignal`
- `Model`
- `ModelConstructor`
- Preact hooks: `useSignal`, `useComputed`, `useSignalEffect`

Current Kamod root exports do not re-export upstream primitives. This avoids collisions today, but users cannot import model/action primitives from `@kamod-ch/signals` yet. Future additions should be direct, tree-shakable re-exports and must not alter upstream semantics.

Recommended additive re-exports:

```ts
export {
  signal,
  computed,
  effect,
  batch,
  untracked,
  action,
  createModel,
  useModel,
  Signal,
  type ReadonlySignal,
  type Model,
  type ModelConstructor,
} from "@preact/signals";
```

Do not create Kamod-specific functions with upstream names.

## Architecture findings

### Storage abstraction

Storage is centralized in `src/drivers.ts` behind `StorageDriver`. This is the correct extension point. It supports sync and async drivers and optional `subscribe`. `resolveDriver()` falls back to memory when the preferred driver is unavailable.

Risks:

- Driver interface is internal and tied to `PersistedSignalOptions<T>`, making later public custom drivers harder.
- In-memory storage is a module-level singleton. This is fine for browser fallback and tests, but server request data must not rely on global memory for isolation.

### Serialization

Default serialization is raw `JSON.stringify` / `JSON.parse` in `src/shared.ts`. `undefined` is represented by `__KAMOD_SIGNALS_UNDEFINED__` when `removeOnUndefined: false`.

Risks:

- No version envelope exists.
- Malformed values silently fall back to `initialValue`, which is safe but not observable.
- Future model persistence must not serialize computed values, functions, actions, or metadata.

### Error handling

Most storage, deserialization, async hydration, and sync errors are swallowed. This protects app runtime but makes failures hard to observe.

Needed: typed lifecycle events and optional logger hooks. Defaults should continue not throwing or causing unhandled promise rejections.

### Hydration

Sync drivers read before signal creation. IndexedDB starts with `initialValue`, then applies stored value unless the user changed the signal during hydration. This avoids overwriting user changes.

Needed: explicit hydration status for persisted models (`idle | loading | ready | error`) and SSR hydration priority rules.

### SSR isolation

Browser APIs are gated by `isBrowser`. Cookie SSR is isolated through `cookieContextRegistry: WeakMap<object, Map<...>>`, so request-scoped cookie contexts do not enter the strong global registry.

Risks:

- Non-cookie `persistedSignal()` uses a global registry and is unsafe as request-local state on the server.
- No generic request scope/dehydrate/hydrate API exists yet.

### Cleanup/dispose

`usePersistedSignal()` creates a controller and disposes it on unmount. Global `persistedSignal()` has no public dispose, by design. Internal controllers dispose effects and subscriptions.

Risks:

- Public model persistence will need explicit `dispose()` and must guarantee no timers, effects, pending writes, or transports continue afterward.

### TypeScript inference

Signal values are generic and inferred from `initialValue`. Custom serialization/deserialization is typed. Current package root exports source `.ts` files via `exports`, `main`, and `types`; built declarations also exist from `tsup`.

Risks:

- Package metadata points `main/types/exports` to `./src/index.ts`, while builds write `dist`. This is source-friendly but unusual for npm packages and pack contents include `src` only. It should be reviewed before release hardening.
- Future persisted model snapshot selection must preserve model factory argument inference and typed snapshot fields.

### Package exports and tree shaking

`sideEffects: false` is present. `tsup` externalizes `@preact/signals`, `preact`, and `preact/hooks`. There is only one root export path.

Needed later:

- Keep new upstream re-exports direct.
- If a development logger is added, expose it through an optional subpath such as `@kamod-ch/signals/devtools`.
- Avoid importing browser-only transports at the root in a way that touches globals.

## Target architecture

### Persisted single signals

Keep `persistedSignal()` and `usePersistedSignal()` backward compatible. Add versioning, lifecycle events, and SSR hydration in-place through additive options only.

Potential additive options:

```ts
type PersistedSignalOptions<T> = {
  // existing fields stay unchanged
  version?: number;
  migrate?: PersistedMigration<T> | PersistedMigrationMap<T>;
  validate?: (value: unknown) => value is T;
  onError?: (error: PersistedSignalError) => void;
  events?: PersistedEventTarget;
};
```

### Persisted models

Build on upstream `createModel`, `action`, and `useModel`. Persist only an explicit snapshot selected by the user.

Proposed API:

```ts
type MaybePromise<T> = T | Promise<T>;
type HydrationStatus = "idle" | "loading" | "ready" | "error";

type PersistedModelOptions<TModel, TSnapshot> = {
  key: string;
  storage?: PersistedStorage;
  serialize?: (snapshot: TSnapshot) => string;
  deserialize?: (raw: string) => TSnapshot;
  select: (model: TModel) => TSnapshot;
  apply?: (model: TModel, snapshot: TSnapshot) => MaybePromise<void>;
  version?: number;
  migrate?: (snapshot: unknown, fromVersion: number) => MaybePromise<TSnapshot>;
  validate?: (snapshot: unknown) => snapshot is TSnapshot;
  sync?: false | "tabs" | PersistedSyncTransport;
  cookie?: CookieOptions;
  cookieContext?: CookieContext;
  indexedDB?: IndexedDBOptions;
};

type PersistedModel<TModel> = Model<TModel> & {
  readonly hydration: ReadonlySignal<HydrationStatus>;
  readonly error: ReadonlySignal<unknown | null>;
  hydrate(): Promise<void>;
  flush(): Promise<void>;
  reset(): Promise<void>;
  dispose(): void;
};

declare function createPersistedModel<TModel, TSnapshot, TArgs extends unknown[]>(
  options: PersistedModelOptions<Model<TModel>, TSnapshot>,
  factory: (...args: TArgs) => TModel,
): ModelConstructor<PersistedModel<TModel>, TArgs>;
```

Open design item: whether `apply` is required or can be derived from a structured `state` mapping. The implementation must avoid uncontrolled recursive object traversal.

### Versioning and migrations

Use a compact stable envelope for new writes:

```ts
type PersistedEnvelope<TSnapshot> = {
  __kamod: "signals";
  v: number;
  data: TSnapshot;
};
```

Rules:

- Legacy payloads without an envelope read as version `0`.
- Unknown future versions must not be overwritten by older runtimes.
- Migration/validation failure preserves the original stored value.
- Reset-on-error and throw-on-error are explicit opt-ins only.

### SSR dehydrate/hydrate

Add request-local scopes instead of relying on global registries:

```ts
type PersistedScope = {
  dehydrate(): PersistedDehydratedState;
  dispose(): void;
};

declare function createPersistedScope(options?: { cookieContext?: CookieContext }): PersistedScope;
declare function dehydratePersisted(scope: PersistedScope): PersistedDehydratedState;
declare function hydratePersisted(state: PersistedDehydratedState): void;
declare function serializePersistedStateForHtml(state: PersistedDehydratedState): string;
```

Priority on the client should be documented and tested:

1. Server snapshot supplied before model/signal persistence effects start.
2. Cookie/storage snapshot.
3. Default state.

HTML embedding must escape script-breakout sequences and other XSS-relevant characters.

### Cross-tab synchronization

Make synchronization opt-in for models and preserve current signal `sync` behavior unless changed in a major version.

```ts
type PersistedSyncTransport = {
  post(message: PersistedSyncMessage): void;
  subscribe(listener: (message: PersistedSyncMessage) => void): () => void;
  dispose(): void;
};
```

Use BroadcastChannel when available, with localStorage `storage` event fallback. Messages need key/channel, source id, revision/version, and payload or payload reference. Ignore self-originated messages and suppress re-broadcast loops. Start with deterministic last-write-wins and a stable tie-breaker.

### Lifecycle events and devtools foundation

Add a small typed event model with redacted payloads by default:

```ts
type PersistedEventType =
  | "hydrate:start"
  | "hydrate:success"
  | "hydrate:error"
  | "persist:start"
  | "persist:success"
  | "persist:error"
  | "migrate:start"
  | "migrate:success"
  | "migrate:error"
  | "sync:receive"
  | "sync:reject"
  | "reset"
  | "dispose";
```

Listeners must be isolated from persistence failures. A dev logger should live in a tree-shakable subpath and remain inactive in production by default.

## Backward compatibility risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Upstream names collide with Kamod names. | Only direct re-export upstream `signal`, `computed`, `effect`, `batch`, `untracked`, `createModel`, `action`, and `useModel`; never wrap them under the same names. |
| Existing unversioned persisted data becomes unreadable. | Treat no-envelope payloads as legacy version `0`; keep current custom `deserialize` behavior. |
| Older runtime overwrites newer envelope. | Detect future `v` and block writes until explicit reset or supported migration. |
| Global state leaks across SSR requests. | Introduce request scopes; document avoiding global non-cookie persisted stores on the server. |
| Async hydration overwrites local changes. | Keep current pending-change guard and formalize it for models. |
| Errors become breaking if thrown. | Keep non-throwing defaults; expose errors through signals/events/callbacks. |
| Bundle grows from devtools or sync transports. | Use optional subpaths and lazy browser transport resolution. |

## Implementation order

1. Directly re-export upstream Preact Signals primitives and model/action APIs; add type and runtime smoke tests.
2. Add `createPersistedModel` with explicit snapshot selection, hydration status, `hydrate`, `flush`, `reset`, and `dispose` using existing drivers.
3. Add version envelopes, legacy read support, migration, validation, and future-version protection.
4. Add request scopes plus XSS-safe dehydrate/hydrate helpers.
5. Add optional cross-tab transport with BroadcastChannel/localStorage fallback.
6. Add lifecycle event subscriptions and an optional dev logger subpath.
7. Expand docs, examples, pack dry-run checks, and release notes.

Each step should be independently testable and additive.
