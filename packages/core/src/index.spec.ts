import { h, render } from "preact";
import { act } from "preact/test-utils";
import { createCookieContext } from "./drivers";
import { __private__, persistedSignal } from "./persistedSignal";
import type { PersistedSignal, PersistedSignalOptions } from "./types";
import { usePersistedSignal } from "./usePersistedSignal";

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

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>(queueMicrotask);
  });
};

type HookRenderProps<T> = {
  signalKey: string;
  initialValue: T;
  options?: PersistedSignalOptions<T>;
};

const renderPersistedSignalHook = <T>(initialProps: HookRenderProps<T>) => {
  let currentSignal: PersistedSignal<T> | undefined;
  let currentProps = initialProps;
  const container = document.createElement("div");
  document.body.appendChild(container);

  const TestComponent = (props: HookRenderProps<T>) => {
    currentSignal = usePersistedSignal(props.signalKey, props.initialValue, props.options ?? {});
    return null;
  };

  const Wrapper = ({ mounted, props }: { mounted: boolean; props: HookRenderProps<T> }) =>
    mounted ? h(TestComponent, props) : null;

  const renderWithProps = async (props: HookRenderProps<T>) => {
    currentProps = props;
    await act(async () => {
      render(h(Wrapper, { mounted: true, props }), container);
    });
    await flushEffects();
    if (!currentSignal) {
      throw new Error("Hook did not produce a signal");
    }
    return currentSignal;
  };

  return {
    render: () => renderWithProps(initialProps),
    rerender: (props: HookRenderProps<T>) => renderWithProps(props),
    unmount: async () => {
      await act(async () => {
        render(h(Wrapper, { mounted: false, props: currentProps }), container);
      });
      await flushEffects();
      await act(async () => {
        render(null, container);
      });
      await flushEffects();
      container.remove();
    },
    get signal() {
      if (!currentSignal) {
        throw new Error("Hook did not produce a signal");
      }
      return currentSignal;
    },
  };
};

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

  it("reuses cookie signals within the same cookie context", () => {
    const cookieContext = createCookieContext({ cookie: 'theme=%22dark%22' });

    const first = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext,
    });
    const second = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext,
    });

    expect(first).toBe(second);
    expect(first.value).toBe("dark");
  });

  it("isolates cookie signals by cookie context", () => {
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

    expect(first).not.toBe(second);
    expect(first.value).toBe("dark");
    expect(second.value).toBe("light");
  });

  it("keeps cookie-context signals out of the strong global registry", () => {
    __private__.globalRegistry.clear();
    const initialSize = __private__.globalRegistry.size;
    const firstContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const secondContext = createCookieContext({ cookie: 'theme=%22light%22' });

    persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: firstContext,
    });
    persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: secondContext,
    });

    expect(__private__.globalRegistry.size).toBe(initialSize);

    persistedSignal("theme", "fallback", { storage: "memory" });

    expect(__private__.globalRegistry.size).toBe(initialSize + 1);
  });

  it("keeps non-cookie persisted signals global for the same storage and key", () => {
    const first = persistedSignal("theme", "light", { storage: "memory" });
    const second = persistedSignal("theme", "light", { storage: "memory" });

    expect(first).toBe(second);
  });

  it("reuses the same signal for the same effective options", () => {
    const serialize = (value: string) => JSON.stringify(value);
    const deserialize = (raw: string) => JSON.parse(raw) as string;

    const first = persistedSignal("shared-options", "light", {
      storage: "memory",
      sync: true,
      removeOnUndefined: true,
      serialize,
      deserialize,
    });
    const second = persistedSignal("shared-options", "dark", {
      storage: "memory",
      serialize,
      deserialize,
    });

    expect(second).toBe(first);
  });

  it("throws when the same key is reused with conflicting removeOnUndefined", () => {
    persistedSignal("remove-on-undefined-conflict", "light", {
      storage: "memory",
      removeOnUndefined: true,
    });

    expect(() =>
      persistedSignal("remove-on-undefined-conflict", "light", {
        storage: "memory",
        removeOnUndefined: false,
      }),
    ).toThrow(/memory:remove-on-undefined-conflict.*conflicting options/i);
  });

  it("throws when the same key is reused with conflicting sync", () => {
    persistedSignal("sync-conflict", "light", {
      storage: "memory",
      sync: true,
    });

    expect(() =>
      persistedSignal("sync-conflict", "light", {
        storage: "memory",
        sync: false,
      }),
    ).toThrow(/memory:sync-conflict.*conflicting options/i);
  });

  it("throws when the same key is reused with a different serializer reference", () => {
    persistedSignal("serializer-conflict", "light", {
      storage: "memory",
      serialize: (value) => JSON.stringify(value),
    });

    expect(() =>
      persistedSignal("serializer-conflict", "light", {
        storage: "memory",
        serialize: (value) => JSON.stringify(value),
      }),
    ).toThrow(/memory:serializer-conflict.*conflicting options/i);
  });

  it("throws when the same key is reused with a different deserializer reference", () => {
    persistedSignal("deserializer-conflict", "light", {
      storage: "memory",
      deserialize: (raw) => JSON.parse(raw) as string,
    });

    expect(() =>
      persistedSignal("deserializer-conflict", "light", {
        storage: "memory",
        deserialize: (raw) => JSON.parse(raw) as string,
      }),
    ).toThrow(/memory:deserializer-conflict.*conflicting options/i);
  });

  it("reuses the same signal when custom serializer and deserializer references match", () => {
    const serialize = (value: string) => JSON.stringify(value);
    const deserialize = (raw: string) => JSON.parse(raw) as string;

    const first = persistedSignal("custom-functions-shared", "light", {
      storage: "memory",
      serialize,
      deserialize,
    });
    const second = persistedSignal("custom-functions-shared", "dark", {
      storage: "memory",
      serialize,
      deserialize,
    });

    expect(second).toBe(first);
  });

  it("throws when cookie options conflict within the same cookie context", () => {
    const cookieContext = createCookieContext();

    persistedSignal("cookie-conflict", "light", {
      storage: "cookie",
      cookieContext,
      cookie: { path: "/", sameSite: "Lax" },
    });

    expect(() =>
      persistedSignal("cookie-conflict", "light", {
        storage: "cookie",
        cookieContext,
        cookie: { path: "/app", sameSite: "Lax" },
      }),
    ).toThrow(/cookie:cookie-conflict.*conflicting options/i);
  });

  it("throws when indexeddb config conflicts for the same key", () => {
    persistedSignal("indexeddb-conflict", "light", {
      storage: "indexeddb",
      indexedDB: { database: "db-a", store: "signals", version: 1 },
    });

    expect(() =>
      persistedSignal("indexeddb-conflict", "light", {
        storage: "indexeddb",
        indexedDB: { database: "db-b", store: "signals", version: 1 },
      }),
    ).toThrow(/indexeddb:indexeddb-conflict.*conflicting options/i);
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

describe("usePersistedSignal", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    __private__.globalRegistry.clear();
  });

  it("disposes the controller subscriptions and effects on unmount", async () => {
    const key = `hook-memory-${Date.now()}-dispose`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "memory" },
    });

    const signal = await hook.render();

    await hook.unmount();

    const external = __private__.createController(key, "fallback", { storage: "memory" });
    external.signal.value = "dark";

    expect(signal.value).toBe("light");

    signal.value = "solarized";
    expect(external.signal.value).toBe("dark");

    external.dispose();
  });

  it("keeps the same signal instance across rerenders with the same props", async () => {
    const props = {
      signalKey: `hook-memory-${Date.now()}-same-props`,
      initialValue: "light",
      options: { storage: "memory" as const },
    };
    const hook = renderPersistedSignalHook(props);

    const first = await hook.render();
    first.value = "dark";

    const second = await hook.rerender(props);

    expect(second).toBe(first);
    expect(second.value).toBe("dark");

    await hook.unmount();
  });

  it("recreates the controller when the key changes", async () => {
    const hook = renderPersistedSignalHook({
      signalKey: `hook-memory-${Date.now()}-first-key`,
      initialValue: "light",
      options: { storage: "memory" },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: `hook-memory-${Date.now()}-second-key`,
      initialValue: "light",
      options: { storage: "memory" },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("recreates the controller when the initial value changes", async () => {
    const key = `hook-memory-${Date.now()}-initial-value`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "memory" },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "dark",
      options: { storage: "memory" },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("recreates the controller when the storage type changes", async () => {
    const key = `hook-storage-${Date.now()}-change`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "memory" },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "light",
      options: { storage: "local" },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("recreates the controller when the cookie context changes", async () => {
    const key = `hook-cookie-${Date.now()}-context`;
    const firstContext = createCookieContext({ cookie: `${key}=%22dark%22` });
    const secondContext = createCookieContext({ cookie: `${key}=%22light%22` });
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "fallback",
      options: { storage: "cookie", cookieContext: firstContext },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "fallback",
      options: { storage: "cookie", cookieContext: secondContext },
    });

    expect(first.value).toBe("dark");
    expect(second).not.toBe(first);
    expect(second.value).toBe("light");

    await hook.unmount();
  });

  it("recreates the controller when tracked cookie options change", async () => {
    const key = `hook-cookie-${Date.now()}-options`;
    const cookieContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "fallback",
      options: {
        storage: "cookie",
        cookieContext,
        cookie: { path: "/", sameSite: "Lax" },
      },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "fallback",
      options: {
        storage: "cookie",
        cookieContext,
        cookie: { path: "/app", sameSite: "Strict" },
      },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("recreates the controller when the indexeddb database changes", async () => {
    const key = `hook-indexeddb-${Date.now()}-database`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb", indexedDB: { database: `${key}-db-a`, store: "store", version: 1 } },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb", indexedDB: { database: `${key}-db-b`, store: "store", version: 1 } },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("recreates the controller when the indexeddb store changes", async () => {
    const key = `hook-indexeddb-${Date.now()}-store`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb", indexedDB: { database: `${key}-db`, store: "store-a", version: 1 } },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb", indexedDB: { database: `${key}-db`, store: "store-b", version: 1 } },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("recreates the controller when the indexeddb version changes", async () => {
    const key = `hook-indexeddb-${Date.now()}-version`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb", indexedDB: { database: `${key}-db`, store: "store", version: 1 } },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb", indexedDB: { database: `${key}-db`, store: "store", version: 2 } },
    });

    expect(second).not.toBe(first);

    await hook.unmount();
  });

  it("keeps the same controller for equivalent indexeddb config", async () => {
    const key = `hook-indexeddb-${Date.now()}-equivalent`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "light",
      options: { storage: "indexeddb" },
    });

    const first = await hook.render();
    const second = await hook.rerender({
      signalKey: key,
      initialValue: "light",
      options: {
        storage: "indexeddb",
        indexedDB: { database: "@kamod-ch/signals", store: "signals", version: 1 },
      },
    });

    expect(second).toBe(first);

    await hook.unmount();
  });

  it("disables inbound synchronization when sync is false", async () => {
    const key = `hook-memory-${Date.now()}-sync-false`;
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: 1,
      options: { storage: "memory", sync: false },
    });

    const signal = await hook.render();
    const external = __private__.createController(key, 0, { storage: "memory" });

    external.signal.value = 5;

    expect(signal.value).toBe(1);

    external.dispose();
    await hook.unmount();
  });

  it("falls back to the initial value for malformed persisted values", async () => {
    const key = `hook-local-${Date.now()}-malformed`;
    localStorage.setItem(key, "{not-json");
    const hook = renderPersistedSignalHook({
      signalKey: key,
      initialValue: "fallback",
      options: { storage: "local" },
    });

    await expect(hook.render()).resolves.toMatchObject({ value: "fallback" });

    await hook.unmount();
  });
});
