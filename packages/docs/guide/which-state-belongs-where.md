---
title: Which state belongs where?
description: Pick the right state tool for each kind of application data.
---

# Which state belongs where?

| State kind | Recommended tool |
| --- | --- |
| Local component UI state | Preact `useState` / `useReducer` |
| Shared client state | `@preact/signals` / `@kamod-ch/signals` |
| Durable preferences | `@kamod-ch/signals` persisted signals/models |
| Form state | Formisch |
| Server state/cache | `@tanstack/preact-query` |
| Complex state machines | XState |

Kamod Signals is for client state that benefits from Preact Signals reactivity and optional persistence. It is not a server-state cache, form library, or workflow/state-machine runtime.
