---
title: Dashboard filters with cross-tab sync
description: Keep dashboard filters synchronized across browser tabs.
---

# Dashboard filters with cross-tab sync

```ts
import { createPersistedModel, signal } from "@kamod-ch/signals";

type FiltersSnapshot = {
  range: "today" | "week" | "month";
  region: "all" | "ch" | "eu";
};

export const DashboardFiltersModel = createPersistedModel(
  {
    key: "dashboard-filters",
    storage: "local",
    sync: "tabs",
    select: (model): FiltersSnapshot => ({
      range: model.range.value,
      region: model.region.value,
    }),
    apply(model, snapshot) {
      model.range.value = snapshot.range;
      model.region.value = snapshot.region;
    },
  },
  () => {
    const range = signal<FiltersSnapshot["range"]>("week");
    const region = signal<FiltersSnapshot["region"]>("all");
    return {
      range,
      region,
      setRange(value: FiltersSnapshot["range"]) {
        range.value = value;
      },
      setRegion(value: FiltersSnapshot["region"]) {
        region.value = value;
      },
    };
  },
);
```

`sync: "tabs"` uses BroadcastChannel when available and a `storage` event fallback otherwise.
