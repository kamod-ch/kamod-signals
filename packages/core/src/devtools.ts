import type { PersistedEvent, PersistedEventTarget } from "./events";

export interface PersistedDevLoggerOptions {
  includeSnapshots?: boolean;
  enabled?: boolean;
  console?: Pick<Console, "debug" | "error">;
}

export const createPersistedDevLogger = <TSnapshot = unknown>(
  options: PersistedDevLoggerOptions = {},
): PersistedEventTarget<TSnapshot> => {
  const logger = options.console ?? console;
  const enabled = options.enabled ?? process.env.NODE_ENV !== "production";
  const listeners = new Set<(event: PersistedEvent<TSnapshot>) => void>();

  const emit = (event: PersistedEvent<TSnapshot>) => {
    const safeEvent = options.includeSnapshots
      ? event
      : { ...event, snapshot: event.snapshot === undefined ? undefined : "[redacted]" as const };

    if (enabled) {
      const log = safeEvent.type.endsWith(":error") || safeEvent.type === "sync:reject" ? logger.error : logger.debug;
      log.call(logger, "[kamod-signals]", safeEvent.type, safeEvent);
    }

    for (const listener of listeners) {
      try {
        listener(safeEvent as PersistedEvent<TSnapshot>);
      } catch {
        // logger listeners must not affect application code
      }
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit,
    dispose() {
      listeners.clear();
    },
  };
};
