import { useState } from "preact/hooks";
import { usePersistedSignal } from "../../src/index.ts";
import { pretty } from "./DemoCard.tsx";

const DRIVERS = [
  {
    id: "local",
    label: "local",
    title: "Theme preference",
    description: "Survives browser restarts — ideal for theme, density, or dashboard preferences.",
    code: `const theme = persistedSignal("hero-theme", "dark", {
  storage: "local",
});`,
    accent: "local",
  },
  {
    id: "session",
    label: "session",
    title: "Tab-scoped UI state",
    description: "Lives only in the active tab — perfect for open sidebars or draft filters.",
    code: `const sidebarOpen = persistedSignal("hero-sidebar", true, {
  storage: "session",
});`,
    accent: "session",
  },
  {
    id: "cookie",
    label: "cookie",
    title: "SSR-visible locale",
    description: "The server can read the same value during SSR — useful for locale or auth hints.",
    code: `const locale = persistedSignal("hero-locale", "de", {
  storage: "cookie",
  cookie: { path: "/", sameSite: "Lax" },
});`,
    accent: "cookie",
  },
  {
    id: "memory",
    label: "memory",
    title: "Ephemeral counter",
    description: "Reactive in-memory state with no browser persistence — great as a fallback.",
    code: `const counter = persistedSignal("hero-counter", 1, {
  storage: "memory",
});`,
    accent: "memory",
  },
  {
    id: "indexeddb",
    label: "indexeddb",
    title: "Draft storage",
    description: "Async hydration for larger client-side payloads like drafts or offline caches.",
    code: `const draft = persistedSignal("hero-draft", "draft-a", {
  storage: "indexeddb",
  indexedDB: { database: "kamod-signals-hero", store: "examples" },
});`,
    accent: "indexeddb",
  },
] as const;

const CODE_IMPORT = `import { persistedSignal } from "@kamod-ch/signals";`;

type DriverId = (typeof DRIVERS)[number]["id"];

type DemoAction = { text: string; onClick: () => void; secondary?: boolean };

function LiveActions(props: { actions: DemoAction[] }) {
  return (
    <div class="signals-demo-actions signals-hero-live-actions">
      {props.actions.map((action) => (
        <button
          class={action.secondary ? "secondary" : undefined}
          onClick={action.onClick}
          type="button"
          style={action.secondary
            ? { color: "var(--pp-c-text-1, #0f172a)", WebkitTextFillColor: "var(--pp-c-text-1, #0f172a)" }
            : { color: "#ffffff", WebkitTextFillColor: "#ffffff", background: "#1d4ed8" }}
        >
          {action.text}
        </button>
      ))}
    </div>
  );
}

export default function HeroDriverShowcase() {
  const [active, setActive] = useState<DriverId>("local");

  const theme = usePersistedSignal("hero-theme", "dark", { storage: "local" });
  const sidebar = usePersistedSignal("hero-sidebar", true, { storage: "session" });
  const locale = usePersistedSignal("hero-locale", "de", {
    storage: "cookie",
    cookie: { path: "/", sameSite: "Lax" },
  });
  const counter = usePersistedSignal("hero-counter", 1, { storage: "memory" });
  const draft = usePersistedSignal("hero-draft", "draft-a", {
    storage: "indexeddb",
    indexedDB: { database: "kamod-signals-hero", store: "examples" },
  });

  const driver = DRIVERS.find((item) => item.id === active) ?? DRIVERS[0];

  const demoProps = {
    local: {
      value: theme.value,
      actions: [
        { text: "Dark", onClick: () => (theme.value = "dark") },
        { text: "Light", onClick: () => (theme.value = "light") },
        { text: "Clear", onClick: () => theme.clear(), secondary: true },
      ],
    },
    session: {
      value: sidebar.value,
      actions: [
        { text: "Toggle", onClick: () => (sidebar.value = !sidebar.value) },
        { text: "Reset", onClick: () => sidebar.reset(), secondary: true },
      ],
    },
    cookie: {
      value: locale.value,
      actions: [
        { text: "DE", onClick: () => (locale.value = "de") },
        { text: "EN", onClick: () => (locale.value = "en") },
        { text: "Clear", onClick: () => locale.clear(), secondary: true },
      ],
    },
    memory: {
      value: counter.value,
      actions: [
        { text: "+1", onClick: () => (counter.value += 1) },
        { text: "-1", onClick: () => (counter.value -= 1), secondary: true },
        { text: "Reset", onClick: () => counter.reset(), secondary: true },
      ],
    },
    indexeddb: {
      value: draft.value,
      actions: [
        { text: "Draft A", onClick: () => (draft.value = "draft-a") },
        { text: "Draft B", onClick: () => (draft.value = "draft-b") },
        { text: "Reset", onClick: () => draft.reset(), secondary: true },
      ],
    },
  } as const;

  const live = demoProps[active];

  return (
    <div class="signals-mkt-panel">
      <div class="signals-window-bar">
        <span></span><span></span><span></span>
      </div>
      <div class="signals-panel-meta">
        <span class="signals-panel-label">Live examples</span>
        <span class="signals-panel-caption">Try each storage driver — values update instantly</span>
      </div>

      <div class="signals-hero-tabs" role="tablist" aria-label="Storage drivers">
        {DRIVERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            class={`signals-hero-tab signals-hero-tab-${item.accent}${active === item.id ? " is-active" : ""}`}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div class="signals-hero-showcase" role="tabpanel">
        <pre class="signals-code-panel">{`${CODE_IMPORT}\n\n${driver.code}`}</pre>

        <div class={`signals-hero-live signals-hero-live-${driver.accent}`}>
          <div class="signals-hero-live-intro">
            <div class="signals-hero-live-head">
              <span class="signals-panel-label">Try it</span>
              <span class="signals-kbd">{driver.label}</span>
            </div>
            <p class="signals-hero-live-desc">{driver.description}</p>
          </div>
          <div class="signals-hero-live-bar">
            <pre class="signals-demo-value signals-hero-live-value">
              <span class="signals-demo-value-label">value </span>
              {pretty(live.value)}
            </pre>
            <LiveActions actions={[...live.actions]} />
          </div>
        </div>
      </div>
    </div>
  );
}
