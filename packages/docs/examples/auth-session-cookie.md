---
title: Auth session with cookie request context
description: Keep SSR-visible auth hints in cookies without exposing secrets in client state.
---

# Auth session with cookie request context

Do not store access tokens or secrets in client-readable state. Store only non-sensitive UI/session hints.

```ts
import { createCookieContext, createPersistedScope, persistedSignal } from "@kamod-ch/signals";

export function createRequestState(request: Request, responseHeaders: Headers) {
  const cookieContext = createCookieContext({
    cookie: request.headers,
    onSetCookie: (header) => responseHeaders.append("set-cookie", header),
  });
  const scope = createPersistedScope({ cookieContext });

  const sessionHint = persistedSignal(
    "session-hint",
    { signedIn: false, displayName: "" },
    {
      storage: "cookie",
      cookieContext,
      scope,
      cookie: { path: "/", sameSite: "Lax", secure: true },
    },
  );

  return { scope, sessionHint };
}
```

The real session should stay server-side, for example in an HTTP-only cookie or server session store.
