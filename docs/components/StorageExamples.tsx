import { useMemo } from "preact/hooks";
import { persistedSignal, usePersistedSignal } from "../../src/index.ts";
import DemoCard, { pretty } from "./DemoCard.tsx";

export default function StorageExamples() {
  const theme = usePersistedSignal("docs-theme", "dark", { storage: "local" });
  const sidebar = usePersistedSignal("docs-sidebar", true, { storage: "session" });
  const locale = usePersistedSignal("docs-locale", "de", {
    storage: "cookie",
    cookie: { path: "/", sameSite: "Lax" },
  });
  const counter = usePersistedSignal("docs-counter", 1, { storage: "memory" });
  const notes = usePersistedSignal("docs-notes", "draft-a", {
    storage: "indexeddb",
    indexedDB: { database: "kamod-signals-docs", store: "examples" },
  });

  const sharedA = useMemo(() => persistedSignal("docs-shared", 0, { storage: "memory" }), []);
  const sharedB = useMemo(() => persistedSignal("docs-shared", 0, { storage: "memory" }), []);

  return (
    <div class="signals-demo-grid">
      <DemoCard
        title="Theme preference"
        storage="local"
        description="Keep UI choices across browser restarts. Perfect for theme, density, or dashboard preferences."
        value={theme.value}
        actions={[
          { text: "Dark", onClick: () => (theme.value = "dark") },
          { text: "Light", onClick: () => (theme.value = "light") },
          { text: "Clear", onClick: () => theme.clear(), secondary: true },
        ]}
        accent="local"
      />
      <DemoCard
        title="Temporary UI state"
        storage="session"
        description="Store values only for the active tab, for example open sidebars or draft filters."
        value={sidebar.value}
        actions={[
          { text: "Toggle", onClick: () => (sidebar.value = !sidebar.value) },
          { text: "Reset", onClick: () => sidebar.reset(), secondary: true },
        ]}
        accent="session"
      />
      <DemoCard
        title="Cookie-backed locale"
        storage="cookie"
        description="Useful when a server should also see the value, for example locale or auth-adjacent hints."
        value={locale.value}
        actions={[
          { text: "DE", onClick: () => (locale.value = "de") },
          { text: "EN", onClick: () => (locale.value = "en") },
          { text: "Clear", onClick: () => locale.clear(), secondary: true },
        ]}
        accent="cookie"
      />
      <DemoCard
        title="Ephemeral state"
        storage="memory"
        description="Best for environments without browser storage or when you only need a reactive in-memory fallback."
        value={counter.value}
        actions={[
          { text: "+1", onClick: () => (counter.value += 1) },
          { text: "-1", onClick: () => (counter.value -= 1), secondary: true },
          { text: "Reset", onClick: () => counter.reset(), secondary: true },
        ]}
        accent="memory"
      />
      <DemoCard
        title="Larger client data"
        storage="indexeddb"
        description="IndexedDB hydrates asynchronously and fits bigger client-side payloads like drafts, cached lists, or offline data."
        value={notes.value}
        actions={[
          { text: "Draft A", onClick: () => (notes.value = "draft-a") },
          { text: "Draft B", onClick: () => (notes.value = "draft-b") },
          { text: "Reset", onClick: () => notes.reset(), secondary: true },
        ]}
        accent="indexeddb"
      />
      <article class="signals-demo-card signals-demo-card-sync">
        <div class="signals-demo-head">
          <h3>Shared key sync</h3>
          <span class="signals-kbd">memory</span>
        </div>
        <p>Two controllers with the same storage/key pair share a single reactive state.</p>
        <pre class="signals-demo-value">
          <span class="signals-demo-value-label">value </span>
          {pretty({ first: sharedA.value, second: sharedB.value })}
        </pre>
        <div class="signals-demo-actions">
          <button
            type="button"
            onClick={() => (sharedA.value += 1)}
            style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff", background: "#1d4ed8" }}
          >
            Increment first
          </button>
          <button
            class="secondary"
            type="button"
            onClick={() => (sharedB.value = 0)}
            style={{ color: "var(--pp-c-text-1, #0f172a)", WebkitTextFillColor: "var(--pp-c-text-1, #0f172a)" }}
          >
            Reset second
          </button>
        </div>
      </article>
    </div>
  );
}
