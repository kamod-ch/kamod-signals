# @kamod-ch/signals changelog

## Unreleased

## 1.1.0

### Changed

- **Peer dependency:** `preact` is now `^11.0.0` (was `^10.0.0`). Upgrade Preact in your app when updating this package.
- Dev toolchain: TypeScript 7, Vitest 5, tsup 9, `@preact/signals` 2.11.x, jsdom 30.
- Core build emits `.d.ts` via `tsc` (compatible with TypeScript 7; `tsup` bundles JS only).

## 1.0.3 and earlier

- Re-export official Preact Signals primitives, models, actions, and `useModel`.
- Add `createPersistedModel()`.
- Add versioned persistence, migrations, validation, and downgrade protection.
- Add SSR scopes and safe dehydrate/hydrate helpers.
- Add optional cross-tab sync for persisted models.
- Add lifecycle events and `@kamod-ch/signals/devtools` logger.
