import { createCookieContext } from "./drivers";
import { __private__, persistedSignal } from "./persistedSignal";

const installIndexedDbPolyfill = () => {
  if (typeof indexedDB !== "undefined") {
    return;
  }

  type StoreMap = Map<string, unknown>;
  type DatabaseState = { version: number; stores: Map<string, StoreMap> };
  const databases = new Map<string, DatabaseState>();

  const createRequest = <T>() => ({
    result: undefined as T,
    error: null as DOMException | null,
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onupgradeneeded: null as ((event: Event) => void) | null,
    onblocked: null as ((event: Event) => void) | null,
  });

  const createDatabase = (name: string, stores: Map<string, StoreMap>) => ({
    name,
    objectStoreNames: {
      contains(storeName: string) {
        return stores.has(storeName);
      },
    },
    createObjectStore(storeName: string) {
      const store = new Map<string, unknown>();
      stores.set(storeName, store);
      return store as unknown as IDBObjectStore;
    },
    transaction(storeName: string) {
      const store = stores.get(storeName);
      if (!store) {
        throw new Error(`Missing object store: ${storeName}`);
      }

      return {
        objectStore() {
          return {
            get(key: string) {
              const request = createRequest<unknown>();
              queueMicrotask(() => {
                request.result = store.get(key);
                request.onsuccess?.(new Event("success"));
              });
              return request as unknown as IDBRequest<unknown>;
            },
            put(value: unknown, key: string) {
              const request = createRequest<unknown>();
              queueMicrotask(() => {
                store.set(key, value);
                request.result = value;
                request.onsuccess?.(new Event("success"));
              });
              return request as unknown as IDBRequest<unknown>;
            },
            delete(key: string) {
              const request = createRequest<undefined>();
              queueMicrotask(() => {
                store.delete(key);
                request.result = undefined;
                request.onsuccess?.(new Event("success"));
              });
              return request as unknown as IDBRequest<undefined>;
            },
          } as IDBObjectStore;
        },
      } as unknown as IDBTransaction;
    },
    close() {},
    onversionchange: null as ((this: IDBDatabase, event: Event) => void) | null,
  });

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open(name: string, version?: number) {
        const request = createRequest<IDBDatabase>();

        queueMicrotask(() => {
          const current = databases.get(name);
          const nextVersion = version ?? current?.version ?? 1;
          const needsUpgrade = !current || nextVersion > current.version;
          const state = current ?? { version: nextVersion, stores: new Map<string, StoreMap>() };

          if (needsUpgrade) {
            state.version = nextVersion;
          }

          databases.set(name, state);
          const db = createDatabase(name, state.stores) as unknown as IDBDatabase;
          request.result = db;
          if (needsUpgrade) {
            request.onupgradeneeded?.(new Event("upgradeneeded"));
          }
          request.onsuccess?.(new Event("success"));
        });

        return request as unknown as IDBOpenDBRequest;
      },
      deleteDatabase(name: string) {
        const request = createRequest<undefined>();
        queueMicrotask(() => {
          databases.delete(name);
          request.result = undefined;
          request.onsuccess?.(new Event("success"));
        });
        return request as unknown as IDBOpenDBRequest;
      },
    },
  });
};

installIndexedDbPolyfill();

describe("persistedSignal", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    __private__.globalRegistry.clear();
  });

  it("hydrates from localStorage and writes updates back", () => {
    localStorage.setItem("theme", JSON.stringify("dark"));

    const theme = persistedSignal("theme", "light", { storage: "local" });
    expect(theme.value).toBe("dark");

    theme.value = "solarized";
    expect(JSON.parse(localStorage.getItem("theme") ?? "null")).toBe("solarized");
  });

  it("syncs independent controllers through memory storage", () => {
    const first = __private__.createController("shared-memory", 1, { storage: "memory" });
    const second = __private__.createController("shared-memory", 0, { storage: "memory" });

    first.signal.value = 5;
    expect(second.signal.value).toBe(5);

    first.dispose();
    second.dispose();
  });

  it("supports cookie storage", () => {
    const token = persistedSignal("theme", "light", {
      storage: "cookie",
      cookie: { path: "/" },
    });

    token.value = "dark";
    expect(document.cookie).toContain("theme=%22dark%22");
  });

  it("clear removes persisted state and restores the initial value", () => {
    const theme = persistedSignal("theme", "light", { storage: "local" });

    theme.value = "dark";
    theme.clear();

    expect(theme.value).toBe("light");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("keeps undefined when removeOnUndefined is false", () => {
    const value = persistedSignal<string | undefined>("optional", "fallback", {
      storage: "local",
      removeOnUndefined: false,
    });

    value.value = undefined;

    expect(value.value).toBeUndefined();
    expect(localStorage.getItem("optional")).toBeTruthy();
  });

  it("hydrates and writes through an SSR cookie context", () => {
    const cookieContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const theme = persistedSignal("theme", "light", {
      storage: "cookie",
      cookieContext,
      cookie: { path: "/", sameSite: "Lax" },
    });

    expect(theme.value).toBe("dark");

    theme.value = "solarized";

    expect(cookieContext.get("theme")).toBe('"solarized"');
    expect(cookieContext.toSetCookieHeaders?.().some((header) => header.includes('theme=%22dark%22'))).toBe(true);
    expect(cookieContext.toSetCookieHeaders?.().some((header) => header.includes('theme=%22solarized%22'))).toBe(true);
  });

  it("isolates global cookie signals by cookie context", () => {
    const firstContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const secondContext = createCookieContext({ cookie: 'theme=%22light%22' });

    const first = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: firstContext,
    });
    const second = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: secondContext,
    });

    expect(first.value).toBe("dark");
    expect(second.value).toBe("light");
  });

  it("hydrates from indexeddb asynchronously", async () => {
    const database = `signals-test-${Date.now()}-hydrate`;
    const seeded = __private__.createController("theme", "light", {
      storage: "indexeddb",
      indexedDB: { database },
    });

    seeded.signal.value = "dark";
    await vi.waitFor(async () => {
      await expect(
        __private__.drivers.indexeddb.get("theme", {
          storage: "indexeddb",
          indexedDB: { database },
        }),
      ).resolves.toBe('"dark"');
    });
    seeded.dispose();
    __private__.globalRegistry.clear();

    const theme = persistedSignal("theme", "light", {
      storage: "indexeddb",
      indexedDB: { database },
    });

    expect(theme.value).toBe("light");
    await vi.waitFor(() => expect(theme.value).toBe("dark"));
  });

  it("syncs independent controllers through indexeddb", async () => {
    const database = `signals-test-${Date.now()}-sync`;
    const first = __private__.createController("shared-indexeddb", 1, {
      storage: "indexeddb",
      indexedDB: { database },
    });
    const second = __private__.createController("shared-indexeddb", 0, {
      storage: "indexeddb",
      indexedDB: { database },
    });

    first.signal.value = 5;
    await vi.waitFor(() => expect(second.signal.value).toBe(5));

    first.dispose();
    second.dispose();
  });
});
