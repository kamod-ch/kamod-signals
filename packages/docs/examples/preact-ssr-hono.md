---
title: Preact SSR and Hono
description: Dehydrate persisted state in a Hono-style server handler.
---

# Preact SSR and Hono

```tsx
import { renderToString } from "preact-render-to-string";
import {
  createCookieContext,
  createPersistedScope,
  dehydratePersisted,
  serializePersistedStateForHtml,
} from "@kamod-ch/signals";

app.get("/", (c) => {
  const cookieContext = createCookieContext({
    cookie: c.req.raw.headers,
    onSetCookie: (header) => c.header("set-cookie", header, { append: true }),
  });
  const scope = createPersistedScope({ cookieContext });

  try {
    const appHtml = renderToString(<App scope={scope} />);
    const state = serializePersistedStateForHtml(dehydratePersisted(scope));
    return c.html(`<!doctype html>
      <div id="app">${appHtml}</div>
      <script>window.__KAMOD_SIGNALS__=${state}</script>
      <script type="module" src="/client.js"></script>`);
  } finally {
    scope.dispose();
  }
});
```

Otok can provide the same shape as an adapter later: create a scope per request, pass it through rendering, dehydrate into HTML, then dispose it.
