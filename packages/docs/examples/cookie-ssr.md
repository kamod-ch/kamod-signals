---
title: Cookie SSR
description: Read and write cookie-backed signals during SSR.
---

# Cookie SSR

Use `createCookieContext()` when a cookie-backed value must be available during server-side rendering.

> Choose cookie storage when both the browser and the server should see the same value.

## When you need this

Use cookie SSR for values like:
- locale
- theme chosen before hydration
- lightweight personalization hints

If the server does **not** need the value, prefer `local` or `session` storage.

## Minimal example

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

## What this gives you

- SSR can read the incoming cookie value
- updates can write `Set-Cookie` headers
- each SSR request stays isolated by `cookieContext`
- no explicit cleanup call is needed for the normal request-scoped pattern

## Good fits

- locale and personalization hints
- values needed by middleware or SSR templates
- auth-adjacent non-sensitive UI preferences

## Keep in mind

- Cookies are small; do not store large payloads.
- Browser cookies are shared across tabs and windows.
- For larger data, prefer `indexeddb` or `local` storage.
- Use the same effective options when reusing the same cookie signal identity inside one request.

## Related pages

- [Getting started](/guide/getting-started)
- [API overview](/guide/api)
- [Storage showcase](/examples/storage-showcase)
