---
title: Cart with versioned migration
description: Evolve a persisted cart payload safely.
---

# Cart with versioned migration

```ts
import { createPersistedModel, signal } from "@kamod-ch/signals";

type CartItem = { sku: string; quantity: number; currency: "CHF" | "EUR" };
type CartSnapshot = { items: CartItem[] };

const isCartSnapshot = (value: unknown): value is CartSnapshot =>
  typeof value === "object" && value !== null && Array.isArray((value as CartSnapshot).items);

export const CartModel = createPersistedModel(
  {
    key: "cart",
    storage: "local",
    version: 2,
    migrate(snapshot, fromVersion): CartSnapshot {
      if (fromVersion === 0 || fromVersion === 1) {
        const old = snapshot as { items: Array<{ sku: string; quantity: number }> };
        return { items: old.items.map((item) => ({ ...item, currency: "CHF" })) };
      }
      return snapshot as CartSnapshot;
    },
    validate: isCartSnapshot,
    select: (model): CartSnapshot => ({ items: model.items.value }),
    apply(model, snapshot) {
      model.items.value = snapshot.items;
    },
  },
  () => {
    const items = signal<CartItem[]>([]);
    return {
      items,
      add(sku: string) {
        items.value = [...items.value, { sku, quantity: 1, currency: "CHF" }];
      },
    };
  },
);
```
