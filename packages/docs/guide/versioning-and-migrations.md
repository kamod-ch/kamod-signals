---
title: Versioning and migrations
description: Safely evolve persisted signal and model payloads.
---

# Versioning and migrations

Persisted signals and persisted models can use a small version envelope when you pass `version`.

## Payload format

New versioned writes use this JSON shape:

```ts
type PersistedEnvelope<T> = {
  __kamod: "signals";
  v: number;
  data: T;
};
```

Existing unversioned values remain readable. They are treated as legacy version `0` by default.

## Persisted signal migration

```ts
const theme = persistedSignal("theme", "light", {
  storage: "local",
  version: 2,
  migrate(snapshot, fromVersion) {
    if (fromVersion === 0 || fromVersion === 1) {
      return snapshot === "dark" ? "dark" : "light";
    }
    return "light";
  },
  validate(snapshot): snapshot is "light" | "dark" {
    return snapshot === "light" || snapshot === "dark";
  },
});
```

## Persisted model migration

```ts
const PreferencesModel = createPersistedModel(
  {
    key: "preferences",
    storage: "local",
    version: 2,
    migrate(snapshot, fromVersion) {
      if (fromVersion === 0 || fromVersion === 1) {
        return {
          ...(snapshot as { theme: "light" | "dark" }),
          density: "comfortable" as const,
        };
      }
      return snapshot as PreferencesSnapshot;
    },
    validate(snapshot): snapshot is PreferencesSnapshot {
      return isPreferencesSnapshot(snapshot);
    },
    select: (model) => ({
      theme: model.theme.value,
      density: model.density.value,
    }),
    apply(model, snapshot) {
      model.theme.value = snapshot.theme;
      model.density.value = snapshot.density;
    },
  },
  createPreferencesModel,
);
```

## Failure strategy

By default, failed migration or validation preserves the original stored value and exposes the error on persisted models through `model.error`.

Available strategies:

- `preserve` — default, keep the original payload and block automatic overwrite.
- `reset` — allow explicit reset/default behavior to replace the bad payload.
- `throw` — rethrow migration/validation errors.

```ts
createPersistedModel({
  key: "preferences",
  version: 3,
  migrationErrorStrategy: "preserve",
  // ...
}, createPreferencesModel);
```

## Downgrade behavior

If a runtime sees a future version, for example stored `v: 5` while the current code supports `version: 2`, it does not silently overwrite the data. This prevents older deployments from destroying newer data.

Use an explicit `reset()` or `clear()` only when you intentionally want to discard the stored payload.

## Sensitive data

Persistence is not encryption. Do not store secrets, access tokens, or sensitive personal data in client-readable storage. Cookies also need appropriate `Secure`, `HttpOnly` server handling, and SameSite policies outside client-side state.
