---
title: Lifecycle and devtools
description: Observe persisted model hydration, persistence, migration, sync, reset, and dispose events.
---

# Lifecycle and devtools

Persisted models can emit typed lifecycle events without exposing full state by default.

## Event target

```ts
import { createPersistedEventTarget } from "@kamod-ch/signals";

const events = createPersistedEventTarget<PreferencesSnapshot>();
const unsubscribe = events.subscribe((event) => {
  console.log(event.type, event.key, event.metadata);
});

const PreferencesModel = createPersistedModel({
  key: "preferences",
  storage: "local",
  events,
  select,
  apply,
}, createPreferencesModel);
```

Listener errors are isolated and do not break persistence. Call `unsubscribe()` or `events.dispose()` during cleanup.

## Events

| Event | Meaning |
| --- | --- |
| `hydrate:start` | storage/scope hydration started |
| `hydrate:success` | hydration completed |
| `hydrate:error` | hydration failed |
| `persist:start` | snapshot write started |
| `persist:success` | snapshot write completed |
| `persist:error` | snapshot write failed |
| `migrate:start` | migration started |
| `migrate:success` | migration completed |
| `migrate:error` | migration or validation failed |
| `sync:receive` | remote sync message received |
| `sync:reject` | remote sync message rejected |
| `reset` | model reset requested |
| `dispose` | model disposed |

Events include `key`, optional `storage`, `timestamp`, optional `metadata`, and optional `error`.

## Redaction

Snapshots are redacted by default:

```ts
const events = createPersistedEventTarget();
```

If you need full snapshots for a controlled development tool, opt in explicitly:

```ts
const events = createPersistedEventTarget<PreferencesSnapshot>({
  includeSnapshots: true,
});
```

Do not enable full snapshots for sensitive state.

## Development logger

The optional logger is available through a tree-shakable subpath:

```ts
import { createPersistedDevLogger } from "@kamod-ch/signals/devtools";

const events = createPersistedDevLogger();
```

It logs in development by default and is inactive in production unless explicitly enabled. Snapshots remain redacted unless `includeSnapshots: true` is passed.

## Plugin example

```ts
export function createMetricsPlugin() {
  const events = createPersistedEventTarget();
  const unsubscribe = events.subscribe((event) => {
    if (event.type === "persist:error") {
      reportPersistenceError(event.key, event.error);
    }
  });

  return { events, dispose: unsubscribe };
}
```

A future browser devtools panel can subscribe to the same event API. The core package does not include a browser extension or Redux DevTools dependency.
