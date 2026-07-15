---
title: Signals and storage
description: Persist individual Preact signals with Kamod storage.
---

# Signals and storage

Use `persistedSignal()` for a single durable value and `usePersistedSignal()` for component-scoped usage.

```ts
import { persistedSignal } from "@kamod-ch/signals";

export const theme = persistedSignal("theme", "dark", { storage: "local" });
```

The returned value is a normal Preact `Signal` with two extra methods:

- `clear()` removes the stored value and restores the initial value.
- `reset()` restores the initial value and persists it.

Storage reads are SSR-safe. Browser-only drivers fall back to memory when unavailable.
