---
title: Storage drivers
description: Choose localStorage, sessionStorage, IndexedDB, cookies, or memory.
---

# Storage drivers

| Driver | Best for | Hydration | SSR behavior |
| --- | --- | --- | --- |
| `local` | preferences | sync in browser | memory fallback |
| `session` | tab-local UI state | sync in browser | memory fallback |
| `indexeddb` | larger client data | async | memory fallback |
| `cookie` | SSR-visible hints | sync | request context or browser cookie |
| `memory` | ephemeral/test state | sync | process-local memory |

## IndexedDB

```ts
const drafts = persistedSignal("drafts", [], {
  storage: "indexeddb",
  indexedDB: { database: "app", store: "drafts" },
});
```

IndexedDB starts with the default value and applies stored data after async hydration.

## Cookies

Use cookies only for small values that the server needs during SSR. Do not store secrets in client-readable state.
