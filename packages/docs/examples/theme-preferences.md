---
title: Theme and UI preferences
description: Persist theme and density preferences with a persisted model.
---

# Theme and UI preferences

```tsx
import { computed, createPersistedModel, signal, useModel } from "@kamod-ch/signals";

type PreferencesSnapshot = {
  theme: "light" | "dark";
  density: "compact" | "comfortable";
};

const PreferencesModel = createPersistedModel(
  {
    key: "preferences",
    storage: "local",
    select: (model): PreferencesSnapshot => ({
      theme: model.theme.value,
      density: model.density.value,
    }),
    apply(model, snapshot) {
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
      toggleTheme() {
        theme.value = isDark.value ? "light" : "dark";
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
      <button onClick={preferences.toggleTheme}>Theme: {preferences.theme}</button>
      <button onClick={() => preferences.setDensity("compact")}>Compact</button>
      <button onClick={() => preferences.setDensity("comfortable")}>Comfortable</button>
    </section>
  );
}
```
