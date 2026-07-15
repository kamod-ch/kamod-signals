---
title: Models and actions
description: Use upstream Preact Signals models and actions from @kamod-ch/signals.
---

# Models and actions

`@kamod-ch/signals` re-exports the official model and action APIs from `@preact/signals`.

Kamod does not reimplement these primitives. Use them exactly like the upstream Preact Signals APIs, and add Kamod persistence only when you need durable state.

## Imports

```ts
import {
  action,
  computed,
  createModel,
  signal,
  useModel,
} from "@kamod-ch/signals";
```

## Create a model

```ts
import { computed, createModel, signal } from "@kamod-ch/signals";

export const CounterModel = createModel((initialCount = 0) => {
  const count = signal(initialCount);
  const doubled = computed(() => count.value * 2);

  return {
    count,
    doubled,
    increment() {
      count.value += 1;
    },
  };
});
```

Functions returned from a model are wrapped by upstream Signals as actions, so related updates are batched.

## Use a model in Preact

```tsx
import { useModel } from "@kamod-ch/signals";
import { CounterModel } from "./CounterModel";

export function Counter() {
  const counter = useModel(() => new CounterModel(1));

  return (
    <button onClick={counter.increment}>
      Count: {counter.count} / doubled: {counter.doubled}
    </button>
  );
}
```

`useModel()` creates the model for the component and disposes model effects when the component unmounts.

## Explicit actions

You can also create standalone actions:

```ts
import { action, signal } from "@kamod-ch/signals";

const first = signal(0);
const second = signal(0);

export const updateBoth = action((value: number) => {
  first.value = value;
  second.value = value;
});
```

## Relationship to persisted signals

Models are the composition layer. Persisted signals are still available for small durable values:

```ts
import { persistedSignal } from "@kamod-ch/signals";

export const theme = persistedSignal("theme", "dark", { storage: "local" });
```

A future `createPersistedModel()` API will combine official models with Kamod storage drivers. Until then, use models for reactive structure and `persistedSignal()` for individual persisted values.
