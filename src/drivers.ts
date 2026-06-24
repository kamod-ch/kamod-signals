import { isBrowser, type StorageDriver } from "./shared";
import type { CookieContext, CookieOptions, PersistedSignalOptions, PersistedStorage } from "./types";

const CHANNEL_PREFIX = "@kamod-ch/signals";
const memoryStore = new Map<string, string>();
const memoryListeners = new Map<string, Set<() => void>>();

const channelName = (storage: PersistedStorage, key: string) => `${CHANNEL_PREFIX}:${storage}:${key}`;

const emitChannel = (storage: PersistedStorage, key: string) => {
  const name = channelName(storage, key);

  if (isBrowser) {
    window.dispatchEvent(new CustomEvent(name));
    return;
  }

  const listeners = memoryListeners.get(name);
  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
};

const subscribeChannel = (storage: PersistedStorage, key: string, callback: () => void) => {
  const name = channelName(storage, key);

  if (isBrowser) {
    const browserListener = () => callback();
    window.addEventListener(name, browserListener as EventListener);
    return () => {
      window.removeEventListener(name, browserListener as EventListener);
    };
  }

  const listeners = memoryListeners.get(name) ?? new Set<() => void>();
  listeners.add(callback);
  memoryListeners.set(name, listeners);

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      memoryListeners.delete(name);
    }
  };
};

const createWebStorageDriver = (type: "local" | "session", getStorage: () => Storage): StorageDriver => ({
  type,
  isAvailable() {
    if (!isBrowser) {
      return false;
    }

    try {
      const storage = getStorage();
      const probe = `${CHANNEL_PREFIX}:probe`;
      storage.setItem(probe, probe);
      storage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  },
  get(key) {
    try {
      return getStorage().getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      getStorage().setItem(key, value);
    } finally {
      emitChannel(type, key);
    }
  },
  remove(key) {
    try {
      getStorage().removeItem(key);
    } finally {
      emitChannel(type, key);
    }
  },
  subscribe(key, callback) {
    const unsubscribeChannelListener = subscribeChannel(type, key, callback);

    if (!isBrowser) {
      return unsubscribeChannelListener;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === getStorage()) {
        callback();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      unsubscribeChannelListener();
      window.removeEventListener("storage", onStorage);
    };
  },
});

const encodeCookieValue = (value: string) => encodeURIComponent(value);
const decodeCookieValue = (value: string) => decodeURIComponent(value);

const parseCookieHeader = (cookieHeader: string | null | undefined) => {
  const result = new Map<string, string>();

  if (!cookieHeader) {
    return result;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result.set(key, decodeCookieValue(value));
  }

  return result;
};

export const serializeCookie = (key: string, value: string, options: CookieOptions = {}) => {
  const parts = [`${key}=${encodeCookieValue(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);

  if (options.expires !== undefined) {
    const expires =
      typeof options.expires === "number"
        ? new Date(Date.now() + options.expires * 24 * 60 * 60 * 1000)
        : options.expires;
    parts.push(`Expires=${expires.toUTCString()}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const expireCookie = (key: string, options: CookieOptions = {}) =>
  serializeCookie(key, "", { ...options, expires: new Date(0) });

const createMemoryCookieContext = (
  cookieHeader?: string,
  onSetCookie?: (header: string) => void,
): CookieContext => {
  const store = parseCookieHeader(cookieHeader);
  const pendingHeaders: string[] = [];
  const listeners = new Map<string, Set<() => void>>();

  const emit = (key: string) => {
    const callbacks = listeners.get(key);
    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {
      callback();
    }
  };

  return {
    get(key) {
      return store.get(key) ?? null;
    },
    set(key, value, options) {
      store.set(key, value);
      const header = serializeCookie(key, value, options);
      pendingHeaders.push(header);
      onSetCookie?.(header);
      emit(key);
    },
    remove(key, options) {
      store.delete(key);
      const header = expireCookie(key, options);
      pendingHeaders.push(header);
      onSetCookie?.(header);
      emit(key);
    },
    subscribe(key, callback) {
      const callbacks = listeners.get(key) ?? new Set<() => void>();
      callbacks.add(callback);
      listeners.set(key, callbacks);

      return () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          listeners.delete(key);
        }
      };
    },
    toSetCookieHeaders() {
      return [...pendingHeaders];
    },
  };
};

type CookieContextInput = {
  cookie?: string | Headers | null;
  onSetCookie?: (header: string) => void;
};

export const createCookieContext = (
  input?: string | Headers | CookieContextInput,
): CookieContext => {
  if (typeof Headers !== "undefined" && input instanceof Headers) {
    return createMemoryCookieContext(input.get("cookie") ?? undefined);
  }

  if (typeof input === "string") {
    return createMemoryCookieContext(input);
  }

  const objectInput = input as CookieContextInput | undefined;
  const cookieSource = objectInput?.cookie;
  const onSetCookie = objectInput?.onSetCookie;

  if (typeof Headers !== "undefined" && cookieSource instanceof Headers) {
    return createMemoryCookieContext(cookieSource.get("cookie") ?? undefined, onSetCookie);
  }

  return createMemoryCookieContext(typeof cookieSource === "string" ? cookieSource : undefined, onSetCookie);
};

const getCookieContext = (options?: PersistedSignalOptions<unknown>) => options?.cookieContext;

const getCookie = (key: string, options?: PersistedSignalOptions<unknown>) => {
  const context = getCookieContext(options);
  if (context) {
    return context.get(key);
  }

  if (!isBrowser) {
    return null;
  }

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedKey}=([^;]*)`));
  return match ? decodeCookieValue(match[1]) : null;
};

const setCookie = (key: string, value: string, options?: PersistedSignalOptions<unknown>) => {
  const context = getCookieContext(options);
  if (context) {
    context.set(key, value, options?.cookie);
    return;
  }

  if (!isBrowser) {
    return;
  }

  document.cookie = serializeCookie(key, value, options?.cookie);
};

const removeCookie = (key: string, options?: PersistedSignalOptions<unknown>) => {
  const context = getCookieContext(options);
  if (context) {
    context.remove(key, options?.cookie);
    return;
  }

  if (!isBrowser) {
    return;
  }

  document.cookie = expireCookie(key, options?.cookie);
};

const cookieDriver: StorageDriver = {
  type: "cookie",
  isAvailable(options) {
    return Boolean(options?.cookieContext) || isBrowser;
  },
  get(key, options) {
    return getCookie(key, options);
  },
  set(key, value, options) {
    setCookie(key, value, options);
    emitChannel("cookie", key);
  },
  remove(key, options) {
    removeCookie(key, options);
    emitChannel("cookie", key);
  },
  subscribe(key, callback, options) {
    const unsubscribeChannelListener = subscribeChannel("cookie", key, callback);
    const unsubscribeContext = options?.cookieContext?.subscribe?.(key, callback) ?? (() => {});

    return () => {
      unsubscribeChannelListener();
      unsubscribeContext();
    };
  },
};

const memoryDriver: StorageDriver = {
  type: "memory",
  isAvailable: () => true,
  get(key) {
    return memoryStore.get(key) ?? null;
  },
  set(key, value) {
    memoryStore.set(key, value);
    emitChannel("memory", key);
  },
  remove(key) {
    memoryStore.delete(key);
    emitChannel("memory", key);
  },
  subscribe(key, callback) {
    return subscribeChannel("memory", key, callback);
  },
};

const localDriver = createWebStorageDriver("local", () => window.localStorage);
const sessionDriver = createWebStorageDriver("session", () => window.sessionStorage);

export const drivers: Record<PersistedStorage, StorageDriver> = {
  local: localDriver,
  session: sessionDriver,
  cookie: cookieDriver,
  memory: memoryDriver,
};

export const resolveDriver = (
  storage: PersistedStorage,
  options?: PersistedSignalOptions<unknown>,
): StorageDriver => {
  const preferred = drivers[storage];
  return preferred.isAvailable(options) ? preferred : memoryDriver;
};
