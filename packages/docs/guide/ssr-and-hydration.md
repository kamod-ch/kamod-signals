---
title: SSR and hydration
description: Request-local scopes, dehydrate/hydrate, and safe HTML embedding.
---

# SSR and hydration

Kamod Signals is import-safe during SSR. Browser-only storage is resolved lazily, and cookie-backed state stays tied to the request when you pass a request-local cookie context.

Use a persisted scope when server-rendered state must be collected and sent to the client.

## Request-local scope

Create one scope per request. Do not share scopes or model instances globally on the server.

```ts
import { createCookieContext, createPersistedScope } from "@kamod-ch/signals";

const cookieContext = createCookieContext({
  cookie: request.headers,
  onSetCookie: (header) => response.headers.append("set-cookie", header),
});

const scope = createPersistedScope({ cookieContext });
```

Pass `scope` to persisted signals or persisted models created for that request.

```ts
const theme = persistedSignal("theme", "light", {
  storage: "cookie",
  cookieContext: scope.cookieContext,
  scope,
});
```

## Dehydrate on the server

```tsx
import {
  dehydratePersisted,
  serializePersistedStateForHtml,
} from "@kamod-ch/signals";

const appHtml = renderToString(<App scope={scope} />);
const state = dehydratePersisted(scope);
const serialized = serializePersistedStateForHtml(state);

const html = `<!doctype html>
<html>
  <body>
    <div id="app">${appHtml}</div>
    <script>window.__KAMOD_SIGNALS__=${serialized}</script>
    <script type="module" src="/src/client.tsx"></script>
  </body>
</html>`;
```

`serializePersistedStateForHtml()` escapes script-breakout characters such as `<`, `>`, `&`, U+2028, and U+2029. Do not embed raw `JSON.stringify()` output directly into HTML.

## Hydrate on the client

Call `hydratePersisted()` before creating persisted models/signals for the initial render.

```ts
import { hydratePersisted } from "@kamod-ch/signals";

hydratePersisted(window.__KAMOD_SIGNALS__ ?? {});
hydrate(<App />, document.getElementById("app")!);
```

## Hydration priority

When a persisted value is created, the priority is:

1. explicit request/client scope snapshot
2. client `hydratePersisted()` snapshot
3. cookie/storage snapshot
4. factory/default state

This prevents default values from immediately overwriting server-rendered state before the first persistence effect runs.

## Hono-style handler

```ts
app.get("/", async (c) => {
  const cookieContext = createCookieContext({
    cookie: c.req.raw.headers,
    onSetCookie: (header) => c.header("set-cookie", header, { append: true }),
  });
  const scope = createPersistedScope({ cookieContext });

  try {
    const appHtml = renderToString(<App scope={scope} />);
    const state = serializePersistedStateForHtml(dehydratePersisted(scope));

    return c.html(`<!doctype html><div id="app">${appHtml}</div><script>window.__KAMOD_SIGNALS__=${state}</script>`);
  } finally {
    scope.dispose();
  }
});
```

## Otok integration

Otok can later provide a thin adapter that creates a scope per request, passes it through route rendering, dehydrates it into the HTML shell, and calls `scope.dispose()` after the request. The core package does not depend on Otok.

## Cleanup

Call `scope.dispose()` at request end. Persisted models also expose `dispose()`, and `useModel()` disposes model effects on component unmount.
