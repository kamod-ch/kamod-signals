---
title: Cookie request contexts
description: Keep cookie-backed signals scoped to the current request.
---

# Cookie request contexts

`createCookieContext()` connects cookie-backed state to the current request and response.

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

Create a new context for every request. Different contexts are isolated with a `WeakMap`, so request-local cookie state does not enter the strong global signal registry.
