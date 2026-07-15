export type PersistedEventType =
  | "hydrate:start"
  | "hydrate:success"
  | "hydrate:error"
  | "persist:start"
  | "persist:success"
  | "persist:error"
  | "migrate:start"
  | "migrate:success"
  | "migrate:error"
  | "sync:receive"
  | "sync:reject"
  | "reset"
  | "dispose";

export interface PersistedEvent<TSnapshot = unknown> {
  type: PersistedEventType;
  key: string;
  storage?: string;
  timestamp: number;
  snapshot?: TSnapshot | "[redacted]";
  error?: unknown;
  metadata?: Record<string, unknown>;
}

export type PersistedEventListener<TSnapshot = unknown> = (event: PersistedEvent<TSnapshot>) => void;
export type PersistedEventUnsubscribe = () => void;

export interface PersistedEventTarget<TSnapshot = unknown> {
  subscribe(listener: PersistedEventListener<TSnapshot>): PersistedEventUnsubscribe;
  emit(event: PersistedEvent<TSnapshot>): void;
  dispose(): void;
}

export interface PersistedEventOptions<TSnapshot = unknown> {
  includeSnapshots?: boolean;
  onListenerError?: (error: unknown, event: PersistedEvent<TSnapshot>) => void;
}

export const createPersistedEventTarget = <TSnapshot = unknown>(
  options: PersistedEventOptions<TSnapshot> = {},
): PersistedEventTarget<TSnapshot> => {
  const listeners = new Set<PersistedEventListener<TSnapshot>>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event) {
      const safeEvent = options.includeSnapshots ? event : { ...event, snapshot: event.snapshot === undefined ? undefined : "[redacted]" as const };
      for (const listener of listeners) {
        try {
          listener(safeEvent);
        } catch (error) {
          options.onListenerError?.(error, safeEvent);
        }
      }
    },
    dispose() {
      listeners.clear();
    },
  };
};

export const emitPersistedEvent = <TSnapshot>(
  target: PersistedEventTarget<TSnapshot> | undefined,
  event: Omit<PersistedEvent<TSnapshot>, "timestamp">,
) => {
  target?.emit({ ...event, timestamp: Date.now() });
};
