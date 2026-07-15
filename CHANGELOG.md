# Changelog

## Unreleased

- Re-export official Preact Signals primitives, models, actions, and `useModel`.
- Add `createPersistedModel()` with explicit snapshot selection, hydration status, flush/reset/dispose controls, and existing storage-driver support.
- Add versioned envelopes, migrations, validation, and downgrade protection.
- Add SSR request scopes, dehydrate/hydrate helpers, and XSS-safe HTML serialization.
- Add optional persisted model cross-tab synchronization.
- Add lifecycle events and optional development logger via `@kamod-ch/signals/devtools`.
- Expand documentation, examples, troubleshooting, and state-selection guidance.
