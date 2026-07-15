---
title: Cross-tab sync
description: Opt-in synchronization for persisted models across browser tabs.
---

# Cross-tab sync

Persisted models can opt in to cross-tab synchronization.

By default, persisted models only persist to their configured storage. Enable sync explicitly when another tab should receive updates.

## Enable sync

```ts
const PreferencesModel = createPersistedModel(
  {
    key: "preferences",
    storage: "local",
    sync: "tabs",
    select: (model) => ({ theme: model.theme.value }),
    apply(model, snapshot: { theme: "light" | "dark" }) {
      model.theme.value = snapshot.theme;
    },
  },
  createPreferencesModel,
);
```

`sync: "tabs"` uses `BroadcastChannel` when available and falls back to the browser `storage` event. If no browser transport is available, the feature stays disabled.

## Custom transport

You can pass an explicit transport. This is useful for tests or adapters.

```ts
import type { PersistedSyncTransport } from "@kamod-ch/signals";

const transport: PersistedSyncTransport<PreferencesSnapshot> = createCustomTransport();

createPersistedModel({
  key: "preferences",
  storage: "local",
  sync: transport,
  select,
  apply,
}, createPreferencesModel);
```

A transport receives messages with:

- `key`
- `source`
- `revision`
- optional `version`
- `payload`

Own messages are ignored.

## Conflict behavior

The initial strategy is deterministic last-write-wins:

1. higher `revision` wins
2. equal revisions are ordered by `source` id as a stable tie-breaker

Remote updates are applied without re-broadcasting, so tabs do not enter persist/broadcast loops.

## Validation and migrations

Incoming remote payloads go through the same versioning and validation path as stored data. Invalid payloads, failed migrations, and unsupported future versions are rejected and exposed through `model.error`.

## Disposal

`dispose()` unsubscribes listeners and closes the transport when possible.

```ts
const preferences = new PreferencesModel();
preferences.dispose();
```

`useModel()` disposes model effects during component unmount.

## Limits

Cross-tab sync is not a security boundary and does not encrypt data. Any payload placed in browser storage or browser messaging should be considered client-readable.

For single `persistedSignal()` values, the existing `sync` option controls inbound driver synchronization. Use persisted models with `sync: "tabs"` when you need explicit BroadcastChannel/localStorage transport behavior.
