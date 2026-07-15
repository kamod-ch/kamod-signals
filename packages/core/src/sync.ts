export interface PersistedSyncMessage<TPayload = unknown> {
  key: string;
  source: string;
  revision: number;
  version?: number;
  payload: TPayload;
}

export interface PersistedSyncTransport<TPayload = unknown> {
  post(message: PersistedSyncMessage<TPayload>): void;
  subscribe(listener: (message: PersistedSyncMessage<TPayload>) => void): () => void;
  dispose(): void;
}

const STORAGE_PREFIX = "@kamod-ch/signals:sync:";
let sourceCounter = 0;

export const createPersistedSyncSource = () => `${Date.now().toString(36)}-${(sourceCounter += 1).toString(36)}`;

export const comparePersistedSyncMessages = (
  left: Pick<PersistedSyncMessage, "revision" | "source">,
  right: Pick<PersistedSyncMessage, "revision" | "source">,
) => {
  if (left.revision !== right.revision) {
    return left.revision - right.revision;
  }

  return left.source.localeCompare(right.source);
};

export const createBroadcastSyncTransport = (channel: string): PersistedSyncTransport | null => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  if (typeof BroadcastChannel !== "undefined") {
    const broadcastChannel = new BroadcastChannel(channel);
    return {
      post(message) {
        broadcastChannel.postMessage(message);
      },
      subscribe(listener) {
        const onMessage = (event: MessageEvent<PersistedSyncMessage>) => listener(event.data);
        broadcastChannel.addEventListener("message", onMessage);
        return () => broadcastChannel.removeEventListener("message", onMessage);
      },
      dispose() {
        broadcastChannel.close();
      },
    };
  }

  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }

  const storageKey = `${STORAGE_PREFIX}${channel}`;
  return {
    post(message) {
      window.localStorage.setItem(storageKey, JSON.stringify(message));
    },
    subscribe(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== storageKey || !event.newValue) {
          return;
        }

        try {
          listener(JSON.parse(event.newValue) as PersistedSyncMessage);
        } catch {
          // ignore invalid sync messages
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    dispose() {
      // storage-event fallback has no channel resource to close
    },
  };
};

const memoryChannels = new Map<string, Set<(message: PersistedSyncMessage) => void>>();

export const createMemorySyncTransport = <TPayload = unknown>(channel: string): PersistedSyncTransport<TPayload> => {
  let disposed = false;
  const listeners = memoryChannels.get(channel) ?? new Set<(message: PersistedSyncMessage) => void>();
  memoryChannels.set(channel, listeners);

  return {
    post(message) {
      if (disposed) {
        return;
      }

      for (const listener of listeners) {
        queueMicrotask(() => listener(message as PersistedSyncMessage));
      }
    },
    subscribe(listener) {
      const untypedListener = listener as (message: PersistedSyncMessage) => void;
      listeners.add(untypedListener);
      return () => {
        listeners.delete(untypedListener);
        if (listeners.size === 0) {
          memoryChannels.delete(channel);
        }
      };
    },
    dispose() {
      disposed = true;
      listeners.delete(() => {});
    },
  };
};
