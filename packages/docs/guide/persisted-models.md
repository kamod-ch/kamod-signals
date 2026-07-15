---
title: Persisted models
description: Persist a typed subset of a Preact Signals model with Kamod storage drivers.
---

# Persisted models

`createPersistedModel()` combines official Preact Signals models with Kamod storage drivers.

It persists only the snapshot you explicitly select. Computed values, functions, actions, and internal metadata are not serialized unless you put them in the selected snapshot yourself.

## Quick start

```ts
import { computed, createPersistedModel, signal } from "@kamod-ch/signals";

const PreferencesModel = createPersistedModel(
  {
    key: "preferences",
    storage: "local",
    select(model) {
      return {
        theme: model.theme.value,
        density: model.density.value,
      };
    },
    apply(model, snapshot: { theme: "light" | "dark"; density: "compact" | "comfortable" }) {
      model.theme.value = snapshot.theme;
      model.density.value = snapshot.density;
    },
  },
  () => {
    const theme = signal<"light" | "dark">("light");
    const density = signal<"compact" | "comfortable">("comfortable");
    const isDark = computed(() => theme.value === "dark");

    return {
      theme,
      density,
      isDark,
      setTheme(value: "light" | "dark") {
        theme.value = value;
      },
    };
  },
);
```

## Sync vs async storage

- `local`, `session`, `cookie`, and `memory` hydrate from storage immediately from the caller's perspective.
- `indexeddb` hydrates asynchronously, so the model starts with its factory defaults and then applies the stored snapshot.

Use `model.hydration.value` to observe status:

```ts
if (preferences.hydration.value === "loading") {
  // show a loading hint for async storage if needed
}
```

Statuses are `idle`, `loading`, `ready`, and `error`.

## Lifecycle operations

Every persisted model has controlled operations:

```ts
await preferences.hydrate(); // read storage and apply the snapshot
await preferences.flush();   // write the current selected snapshot
await preferences.reset();   // restore the initial selected snapshot and write it
preferences.dispose();       // stop persistence effects and subscriptions
```

`useModel()` also disposes model effects on component unmount.

## Error handling

Persistence errors are captured in `model.error` and do not create unhandled promise rejections during automatic hydration or persistence.

```ts
if (preferences.error.value) {
  console.error("Persistence failed", preferences.error.value);
}
```

## Full Preferences example

```tsx
import { computed, createPersistedModel, signal, useModel } from "@kamod-ch/signals";

const PreferencesModel = createPersistedModel(
  {
    key: "preferences",
    storage: "local",
    select: (model) => ({
      theme: model.theme.value,
      density: model.density.value,
    }),
    apply(model, snapshot: { theme: "light" | "dark"; density: "compact" | "comfortable" }) {
      model.theme.value = snapshot.theme;
      model.density.value = snapshot.density;
    },
  },
  () => {
    const theme = signal<"light" | "dark">("light");
    const density = signal<"compact" | "comfortable">("comfortable");
    const isDark = computed(() => theme.value === "dark");

    return {
      theme,
      density,
      isDark,
      setTheme(value: "light" | "dark") {
        theme.value = value;
      },
      setDensity(value: "compact" | "comfortable") {
        density.value = value;
      },
    };
  },
);

export function PreferencesPanel() {
  const preferences = useModel(() => new PreferencesModel());

  return (
    <section>
      <button onClick={() => preferences.setTheme(preferences.isDark.value ? "light" : "dark")}>
        Theme: {preferences.theme}
      </button>
      <button onClick={() => preferences.setDensity("compact")}>
        Compact density
      </button>
    </section>
  );
}
```

## SSR safety

Importing and creating persisted models does not require browser globals. Browser-only storage drivers fall back to memory when unavailable. For cookie-backed SSR state, pass a request-local `cookieContext`.
