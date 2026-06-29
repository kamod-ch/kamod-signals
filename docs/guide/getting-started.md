---
title: Getting started
description: Install and use @kamod-ch/signals in a Preact app.
---

# Getting started

Get from zero to a working persisted signal in a few minutes.

> **Best first path:** start with `local` storage, get one example working, then switch storage only if your use case needs it.

## Install

```bash
pnpm add @kamod-ch/signals @preact/signals preact
```

## 1) Create your first persisted signal

Use `persistedSignal()` when the signal should be shared across files.

```ts
import { persistedSignal } from "@kamod-ch/signals";

export const theme = persistedSignal("theme", "dark", { storage: "local" });
```

Use it like any other Preact signal:

```tsx
<button onClick={() => (theme.value = theme.value === "dark" ? "light" : "dark")}>
  Theme: {theme.value}
</button>
```

**What happens here:**
- the value starts as `"dark"`
- updates are written to `localStorage`
- the same `storage + key` returns the same global signal

## 2) Use the hook inside a component

Use `usePersistedSignal()` when you want the same persistence behavior directly inside a component.

```tsx
import { usePersistedSignal } from "@kamod-ch/signals";

function SidebarToggle() {
  const isOpen = usePersistedSignal("sidebar-open", true, { storage: "session" });
  return <button onClick={() => (isOpen.value = !isOpen.value)}>{String(isOpen.value)}</button>;
}
```

A good default split is:
- `persistedSignal()` for app-wide shared state
- `usePersistedSignal()` for component-local usage

## 3) Pick the right storage

| Storage | Best for | Notes |
| --- | --- | --- |
| `local` | preferences and UI settings | good default for theme, layout, dismissed UI |
| `session` | per-tab state | resets when the tab closes |
| `indexeddb` | larger client-side data | hydrates asynchronously |
| `cookie` | SSR-visible values | use when the server also needs the value |
| `memory` | fallback or ephemeral state | no browser persistence |

> **Quick decision:** use `local` for preferences, `session` for tab state, `cookie` for SSR-visible values, and `indexeddb` for larger data.

## 4) When to use cookie SSR

Use `storage: "cookie"` with `cookieContext` only when the server must read or write the value during SSR.

```ts
import { createCookieContext, persistedSignal } from "@kamod-ch/signals";

const cookieContext = createCookieContext({
  cookie: request.headers,
  onSetCookie: (header) => response.headers.append("set-cookie", header),
});

const locale = persistedSignal("locale", "en", {
  storage: "cookie",
  cookieContext,
  cookie: { path: "/", sameSite: "Lax" },
});
```

If the server does **not** need the value, prefer `local` or `session`.

## Common first use cases

- theme preference
- sidebar open/closed state
- locale hints for SSR
- drafts or cached data in IndexedDB

## Common gotchas

- IndexedDB starts with `initialValue` and updates after hydration completes.
- `persistedSignal()` is global by identity, so reuse the same key with the same effective options.
- Different SSR `cookieContext` values stay isolated per request.

## Next steps

1. Read the [API overview](/guide/api) for `sync`, custom serialization, cookie settings, and runtime rules.
2. Explore the [storage showcase](/examples/storage-showcase) to compare all drivers in one place.
3. Review [cookie SSR](/examples/cookie-ssr) if the server must also read the value.
