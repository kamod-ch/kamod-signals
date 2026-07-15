---
title: Troubleshooting
description: Common persistence, hydration, migration, SSR, and sync issues.
---

# Troubleshooting

## Hydration mismatch

Call `hydratePersisted()` before creating persisted models/signals on the client. Server snapshots have priority over storage and defaults only if they are available before creation.

## Storage not available

Browser storage can be blocked by privacy settings or unavailable during SSR. Kamod falls back to memory for browser-only drivers.

## IndexedDB async hydration

IndexedDB is asynchronous. Render defaults first and check `model.hydration.value` when you need loading UI.

## Migration failed

By default, failed migration or validation preserves the original payload. Inspect `model.error.value` and avoid `migrationErrorStrategy: "reset"` unless data loss is acceptable.

## SSR state leak

Do not create request-specific persisted models as module globals on the server. Use `createPersistedScope()` once per request and dispose it at request end.

## Cross-tab conflict

Cross-tab sync uses last-write-wins with a stable source tie-breaker. If your domain needs merging, resolve conflicts in your model actions before persisting.
