export default function MarketingHero() {
  return (
    <section class="signals-mkt-shell">
      <section class="signals-mkt-hero">
        <div>
          <div class="signals-brand-row">
            <div class="signals-brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div>
              <div class="signals-brand-name">@kamod-ch/signals</div>
              <span class="signals-badge">Preact · Signals · Persistence</span>
            </div>
          </div>
          <div class="signals-hero-eyebrow">Storage-aware state for modern Preact apps</div>
          <h1>Persisted signals for real app state</h1>
          <p class="signals-lead signals-mkt-copy">
            Ship preferences, drafts, SSR-visible values, and tab-scoped UI state with the same Signals API
            you already use—just choose localStorage, sessionStorage, IndexedDB, cookies, or memory.
          </p>
          <ul class="signals-feature-pills">
            <li>local + session</li>
            <li>cookies + SSR</li>
            <li>IndexedDB hydration</li>
            <li>memory fallback</li>
          </ul>
          <div class="signals-mkt-actions">
            <a class="signals-btn signals-btn-brand" href="/guide/getting-started">Start in 2 minutes</a>
            <a class="signals-btn signals-btn-alt" href="/examples/storage-showcase">See live storage demos</a>
          </div>
          <ul class="signals-trust-list" aria-label="Key benefits">
            <li><strong>5</strong><span>storage drivers</span></li>
            <li><strong>SSR</strong><span>cookie support</span></li>
            <li><strong>Sync</strong><span>shared-key updates</span></li>
          </ul>
        </div>
        <div class="signals-mkt-panel">
        <div class="signals-window-bar">
          <span></span><span></span><span></span>
        </div>
        <div class="signals-panel-meta">
          <span class="signals-panel-label">Example</span>
          <span class="signals-panel-caption">Persist once, reuse everywhere</span>
        </div>
        <pre class="signals-code-panel">{`import { persistedSignal } from "@kamod-ch/signals";

export const theme = persistedSignal("theme", "dark", {
  storage: "local",
});

export const draft = persistedSignal("draft", "", {
  storage: "indexeddb",
  indexedDB: { database: "app", store: "drafts" },
});`}</pre>
          <ul class="signals-stat-list">
            <li><em>Drivers</em><strong>5 storage drivers</strong><span>local, session, indexeddb, cookie, memory</span></li>
            <li><em>Server</em><strong>SSR-aware cookies</strong><span>with createCookieContext()</span></li>
            <li><em>Scale</em><strong>Async IndexedDB hydration</strong><span>for larger client-side payloads</span></li>
          </ul>
        </div>
      </section>
    </section>
  );
}
