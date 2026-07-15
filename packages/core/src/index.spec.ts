import { h, render } from "preact";
import { act } from "preact/test-utils";
import {
  action,
  computed,
  createCookieContext,
  createModel,
  createPersistedModel,
  createPersistedScope,
  dehydratePersisted,
  effect,
  hydratePersisted,
  persistedSignal,
  signal,
  serializePersistedStateForHtml,
  useModel,
  usePersistedSignal,
  type Model,
  type ModelConstructor,
} from ".";
import { __private__ } from "./persistedSignal";
import type { PersistedSignal, PersistedSignalOptions } from "./types";

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

  it("supports versioned signal migration and future-version preservation", () => {
    const migratedKey = `signal-version-${Date.now()}-migrate`;
    const futureKey = `signal-version-${Date.now()}-future`;
    localStorage.setItem(migratedKey, JSON.stringify("dark"));
    const futureRaw = JSON.stringify({ __kamod: "signals", v: 99, data: "dark" });
    localStorage.setItem(futureKey, futureRaw);

    const migrated = persistedSignal(migratedKey, "light", {
      storage: "local",
      version: 2,
      migrate(snapshot, fromVersion) {
        expect(fromVersion).toBe(0);
        return snapshot === "dark" ? "solarized" : "light";
      },
      validate: (snapshot): snapshot is string => typeof snapshot === "string",
    });
    const future = persistedSignal(futureKey, "light", {
      storage: "local",
      version: 2,
      validate: (snapshot): snapshot is string => typeof snapshot === "string",
    });

    expect(migrated.value).toBe("solarized");
    expect(JSON.parse(localStorage.getItem(migratedKey) ?? "null")).toEqual({
      __kamod: "signals",
      v: 2,
      data: "solarized",
    });

    expect(future.value).toBe("light");
    future.value = "solarized";
    expect(localStorage.getItem(futureKey)).toBe(futureRaw);
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

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const renderModelHook = <TModel,>(factory: () => Model<TModel>) => {
  let currentModel: Model<TModel> | undefined;
  const container = document.createElement("div");
  document.body.appendChild(container);

  const TestComponent = () => {
    currentModel = useModel(factory);
    return null;
  };

  return {
    mount: async () => {
      await act(async () => {
        render(h(TestComponent, {}), container);
      });
      await flushEffects();
      if (!currentModel) {
        throw new Error("Hook did not produce a model");
      }
      return currentModel;
    },
    unmount: async () => {
      await act(async () => {
        render(null, container);
      });
      await flushEffects();
      container.remove();
    },
  };
};

describe("Preact Signals model re-exports", () => {
  it("creates models through the upstream createModel API", () => {
    const CounterModel = createModel((initialCount: number) => {
      const count = signal(initialCount);
      const doubled = computed(() => count.value * 2);

      return {
        count,
        doubled,
        increment() {
          count.value += 1;
        },
      };
    });

    const counter = new CounterModel(2);

    expect(counter.count.value).toBe(2);
    expect(counter.doubled.value).toBe(4);

    counter.increment();

    expect(counter.count.value).toBe(3);
    expect(counter.doubled.value).toBe(6);

    counter[Symbol.dispose]();
  });

  it("exports action and batches updates with computed model values", () => {
    const updateBoth = action((left: ReturnType<typeof signal<number>>, right: ReturnType<typeof signal<number>>) => {
      left.value = 2;
      right.value = 3;
    });
    const PairModel = createModel(() => {
      const left = signal(0);
      const right = signal(0);
      const total = computed(() => left.value + right.value);

      return { left, right, total, updateBoth };
    });
    const pair = new PairModel();

    pair.updateBoth(pair.left, pair.right);

    expect(pair.total.value).toBe(5);

    pair[Symbol.dispose]();
  });

  it("disposes model effects when useModel unmounts", async () => {
    const source = signal(0);
    let runs = 0;
    let cleanups = 0;
    const EffectModel = createModel(() => {
      const disposeEffect = effect(() => {
        source.value;
        runs += 1;
        return () => {
          cleanups += 1;
        };
      });

      return {
        source,
        disposeEffect,
      };
    });
    const hook = renderModelHook(() => new EffectModel());

    await hook.mount();
    expect(runs).toBe(1);

    await hook.unmount();
    source.value += 1;

    expect(cleanups).toBeGreaterThanOrEqual(1);
    expect(runs).toBe(1);
  });

  it("keeps initialization argument and model return types inferred", () => {
    const PreferencesModel = createModel((theme: "light" | "dark", density = 1) => {
      const selectedTheme = signal(theme);
      const selectedDensity = signal(density);
      const label = computed(() => `${selectedTheme.value}:${selectedDensity.value}`);

      return {
        selectedTheme,
        selectedDensity,
        label,
        setTheme(value: "light" | "dark") {
          selectedTheme.value = value;
        },
      };
    });

    const preferences = new PreferencesModel("dark", 2);
    preferences.setTheme("light");

    expect(preferences.label.value).toBe("light:2");

    type ThemeCheck = Expect<Equal<InstanceType<typeof PreferencesModel>["selectedTheme"]["value"], "light" | "dark">>;
    const _themeCheck: ThemeCheck = true;
    const _constructor: ModelConstructor<{
      selectedTheme: ReturnType<typeof signal<"light" | "dark">>;
      selectedDensity: ReturnType<typeof signal<number>>;
      label: ReturnType<typeof computed<string>>;
      setTheme(value: "light" | "dark"): void;
    }, ["light" | "dark", number?]> = PreferencesModel;
    const _constructedWithInferredArgs = new PreferencesModel("dark", 2);
    const _themeValue: "light" | "dark" = _constructedWithInferredArgs.selectedTheme.value;
    expect(_themeCheck).toBe(true);
    expect(typeof _constructor).toBe("function");

    preferences[Symbol.dispose]();
  });
});

const createPreferencesModel = (key: string) =>
  createPersistedModel(
    {
      key,
      storage: "memory",
      select(model) {
        return {
          theme: model.theme.value,
          density: model.density.value,
        };
      },
      apply(model, snapshot: { theme: "light" | "dark"; density: "compact" | "comfortable" }) {
        model.theme.value = snapshot.theme;
        model.density.value = snapshot.density;
      },
    },
    () => {
      const theme = signal<"light" | "dark">("light");
      const density = signal<"compact" | "comfortable">("comfortable");
      const isDark = computed(() => theme.value === "dark");

      return {
        theme,
        density,
        isDark,
        setTheme(value: "light" | "dark") {
          theme.value = value;
        },
        setDensity(value: "compact" | "comfortable") {
          density.value = value;
        },
      };
    },
  );

describe("createPersistedModel", () => {
  it("uses default model state when no stored value exists", async () => {
    const key = `persisted-model-${Date.now()}-defaults`;
    const PreferencesModel = createPreferencesModel(key);
    const preferences = new PreferencesModel();

    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    expect(preferences.theme.value).toBe("light");
    expect(preferences.density.value).toBe("comfortable");
    expect(__private__.drivers.memory.get(key, { storage: "memory" })).toBeNull();

    preferences.dispose();
  });

  it("hydrates from an existing stored snapshot", async () => {
    const key = `persisted-model-${Date.now()}-hydrate`;
    await __private__.drivers.memory.set(key, JSON.stringify({ theme: "dark", density: "compact" }), {
      storage: "memory",
    });
    const PreferencesModel = createPreferencesModel(key);
    const preferences = new PreferencesModel();

    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    expect(preferences.theme.value).toBe("dark");
    expect(preferences.density.value).toBe("compact");
    expect(preferences.isDark.value).toBe(true);

    preferences.dispose();
  });

  it("migrates a legacy model payload to the current envelope once", async () => {
    const key = `persisted-model-${Date.now()}-legacy-migrate`;
    await __private__.drivers.memory.set(key, JSON.stringify({ theme: "dark" }), { storage: "memory" });
    const PreferencesModel = createPersistedModel(
      {
        key,
        storage: "memory",
        version: 2,
        migrate(snapshot, fromVersion) {
          expect(fromVersion).toBe(0);
          return { ...(snapshot as { theme: "light" | "dark" }), density: "comfortable" as const };
        },
        validate(snapshot): snapshot is { theme: "light" | "dark"; density: "compact" | "comfortable" } {
          return typeof snapshot === "object" && snapshot !== null && "theme" in snapshot && "density" in snapshot;
        },
        select: (model) => ({ theme: model.theme.value, density: model.density.value }),
        apply(model, snapshot) {
          model.theme.value = snapshot.theme;
          model.density.value = snapshot.density;
        },
      },
      () => ({
        theme: signal<"light" | "dark">("light"),
        density: signal<"compact" | "comfortable">("compact"),
      }),
    );
    const preferences = new PreferencesModel();

    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    expect(preferences.theme.value).toBe("dark");
    expect(preferences.density.value).toBe("comfortable");
    expect(JSON.parse(__private__.drivers.memory.get(key, { storage: "memory" }) as string)).toEqual({
      __kamod: "signals",
      v: 2,
      data: { theme: "dark", density: "comfortable" },
    });

    preferences.dispose();
  });

  it("runs asynchronous model migrations", async () => {
    const key = `persisted-model-${Date.now()}-async-migrate`;
    await __private__.drivers.memory.set(key, JSON.stringify({ __kamod: "signals", v: 1, data: { theme: "dark" } }), {
      storage: "memory",
    });
    const PreferencesModel = createPersistedModel(
      {
        key,
        storage: "memory",
        version: 2,
        async migrate(snapshot) {
          await Promise.resolve();
          return { ...(snapshot as { theme: "light" | "dark" }), density: "compact" as const };
        },
        select: (model) => ({ theme: model.theme.value, density: model.density.value }),
        apply(model, snapshot: { theme: "light" | "dark"; density: "compact" | "comfortable" }) {
          model.theme.value = snapshot.theme;
          model.density.value = snapshot.density;
        },
      },
      () => ({
        theme: signal<"light" | "dark">("light"),
        density: signal<"compact" | "comfortable">("comfortable"),
      }),
    );
    const preferences = new PreferencesModel();

    await vi.waitFor(() => expect(preferences.density.value).toBe("compact"));

    preferences.dispose();
  });

  it("preserves invalid, failed, and future-version payloads", async () => {
    const invalidKey = `persisted-model-${Date.now()}-invalid`;
    const futureKey = `persisted-model-${Date.now()}-future`;
    const invalidRaw = JSON.stringify({ __kamod: "signals", v: 1, data: { theme: "dark" } });
    const futureRaw = JSON.stringify({ __kamod: "signals", v: 99, data: { theme: "dark", density: "compact" } });
    await __private__.drivers.memory.set(invalidKey, invalidRaw, { storage: "memory" });
    await __private__.drivers.memory.set(futureKey, futureRaw, { storage: "memory" });

    const makeModel = (key: string) =>
      createPersistedModel(
        {
          key,
          storage: "memory",
          version: 2,
          migrate() {
            throw new Error("boom");
          },
          validate(snapshot): snapshot is { theme: "light" | "dark"; density: "compact" | "comfortable" } {
            return typeof snapshot === "object" && snapshot !== null && "density" in snapshot;
          },
          select: (model) => ({ theme: model.theme.value, density: model.density.value }),
          apply(model, snapshot) {
            model.theme.value = snapshot.theme;
            model.density.value = snapshot.density;
          },
        },
        () => ({
          theme: signal<"light" | "dark">("light"),
          density: signal<"compact" | "comfortable">("comfortable"),
        }),
      );

    const invalid = new (makeModel(invalidKey))();
    const future = new (makeModel(futureKey))();
    await vi.waitFor(() => expect(invalid.error.value).toBeTruthy());
    await vi.waitFor(() => expect(future.error.value).toBeTruthy());

    invalid.theme.value = "dark";
    future.theme.value = "dark";
    await Promise.resolve();

    expect(__private__.drivers.memory.get(invalidKey, { storage: "memory" })).toBe(invalidRaw);
    expect(__private__.drivers.memory.get(futureKey, { storage: "memory" })).toBe(futureRaw);

    invalid.dispose();
    future.dispose();
  });

  it("persists selected state after an action", async () => {
    const key = `persisted-model-${Date.now()}-persist`;
    const PreferencesModel = createPreferencesModel(key);
    const preferences = new PreferencesModel();
    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    preferences.setTheme("dark");

    await vi.waitFor(async () => {
      expect(__private__.drivers.memory.get(key, { storage: "memory" })).toBe(
        JSON.stringify({ theme: "dark", density: "comfortable" }),
      );
    });

    preferences.dispose();
  });

  it("does not serialize computed values or functions", async () => {
    const key = `persisted-model-${Date.now()}-selected-only`;
    const PreferencesModel = createPreferencesModel(key);
    const preferences = new PreferencesModel();
    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    preferences.setTheme("dark");

    await vi.waitFor(async () => {
      const raw = await __private__.drivers.memory.get(key, { storage: "memory" });
      expect(raw).toBe(JSON.stringify({ theme: "dark", density: "comfortable" }));
      expect(raw).not.toContain("isDark");
      expect(raw).not.toContain("setTheme");
    });

    preferences.dispose();
  });

  it("hydrates asynchronously from IndexedDB", async () => {
    const key = `persisted-model-${Date.now()}-indexeddb`;
    const database = `persisted-model-${Date.now()}-db`;
    await __private__.drivers.indexeddb.set(key, JSON.stringify({ theme: "dark", density: "compact" }), {
      storage: "indexeddb",
      indexedDB: { database },
    });
    const PreferencesModel = createPersistedModel(
      {
        key,
        storage: "indexeddb",
        indexedDB: { database },
        select: (model) => ({ theme: model.theme.value, density: model.density.value }),
        apply(model, snapshot: { theme: "light" | "dark"; density: "compact" | "comfortable" }) {
          model.theme.value = snapshot.theme;
          model.density.value = snapshot.density;
        },
      },
      () => ({
        theme: signal<"light" | "dark">("light"),
        density: signal<"compact" | "comfortable">("comfortable"),
      }),
    );
    const preferences = new PreferencesModel();

    expect(preferences.theme.value).toBe("light");
    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));
    expect(preferences.theme.value).toBe("dark");
    expect(preferences.density.value).toBe("compact");

    preferences.dispose();
  });

  it("reports async hydration errors without unhandled rejections", async () => {
    const key = `persisted-model-${Date.now()}-error`;
    const originalGet = __private__.drivers.memory.get;
    const originalAsync = __private__.drivers.memory.async;
    Object.defineProperty(__private__.drivers.memory, "async", { configurable: true, value: true });
    __private__.drivers.memory.get = () => Promise.reject(new Error("read failed"));

    try {
      const PreferencesModel = createPreferencesModel(key);
      const preferences = new PreferencesModel();

      await vi.waitFor(() => expect(preferences.hydration.value).toBe("error"));
      expect(preferences.error.value).toBeInstanceOf(Error);

      preferences.dispose();
    } finally {
      __private__.drivers.memory.get = originalGet;
      Object.defineProperty(__private__.drivers.memory, "async", { configurable: true, value: originalAsync });
    }
  });

  it("supports reset, flush, and dispose", async () => {
    const key = `persisted-model-${Date.now()}-controls`;
    const PreferencesModel = createPreferencesModel(key);
    const preferences = new PreferencesModel();
    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    preferences.setTheme("dark");
    await preferences.flush();
    expect(__private__.drivers.memory.get(key, { storage: "memory" })).toBe(
      JSON.stringify({ theme: "dark", density: "comfortable" }),
    );

    await preferences.reset();
    expect(preferences.theme.value).toBe("light");
    expect(__private__.drivers.memory.get(key, { storage: "memory" })).toBe(
      JSON.stringify({ theme: "light", density: "comfortable" }),
    );

    preferences.dispose();
    preferences.setTheme("dark");
    await Promise.resolve();
    expect(__private__.drivers.memory.get(key, { storage: "memory" })).toBe(
      JSON.stringify({ theme: "light", density: "comfortable" }),
    );
  });

  it("keeps independent model instances isolated by key", async () => {
    const FirstModel = createPreferencesModel(`persisted-model-${Date.now()}-first`);
    const SecondModel = createPreferencesModel(`persisted-model-${Date.now()}-second`);
    const first = new FirstModel();
    const second = new SecondModel();
    await vi.waitFor(() => expect(first.hydration.value).toBe("ready"));
    await vi.waitFor(() => expect(second.hydration.value).toBe("ready"));

    first.setTheme("dark");

    expect(first.theme.value).toBe("dark");
    expect(second.theme.value).toBe("light");

    first.dispose();
    second.dispose();
  });

  it("can be created when browser globals are unavailable", async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");

    try {
      const PreferencesModel = createPersistedModel(
        {
          key: `persisted-model-${Date.now()}-ssr`,
          storage: "memory",
          sync: false,
          select: (model) => ({ theme: model.theme.value }),
          apply(model, snapshot: { theme: "light" | "dark" }) {
            model.theme.value = snapshot.theme;
          },
        },
        () => ({ theme: signal<"light" | "dark">("light") }),
      );
      const preferences = new PreferencesModel();
      await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));
      expect(preferences.theme.value).toBe("light");
      preferences.dispose();
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    }
  });
});

describe("SSR persisted scopes and hydration", () => {
  beforeEach(() => {
    __private__.globalRegistry.clear();
  });

  it("isolates two server request scopes", async () => {
    const firstScope = createPersistedScope();
    const secondScope = createPersistedScope();
    const FirstModel = createPersistedModel(
      {
        key: "preferences",
        storage: "memory",
        scope: firstScope,
        select: (model) => ({ theme: model.theme.value }),
        apply(model, snapshot: { theme: "light" | "dark" }) {
          model.theme.value = snapshot.theme;
        },
      },
      () => ({ theme: signal<"light" | "dark">("light") }),
    );
    const SecondModel = createPersistedModel(
      {
        key: "preferences",
        storage: "memory",
        scope: secondScope,
        select: (model) => ({ theme: model.theme.value }),
        apply(model, snapshot: { theme: "light" | "dark" }) {
          model.theme.value = snapshot.theme;
        },
      },
      () => ({ theme: signal<"light" | "dark">("light") }),
    );

    const first = new FirstModel();
    const second = new SecondModel();
    await vi.waitFor(() => expect(first.hydration.value).toBe("ready"));
    await vi.waitFor(() => expect(second.hydration.value).toBe("ready"));

    first.theme.value = "dark";
    second.theme.value = "light";
    await Promise.resolve();

    expect(dehydratePersisted(firstScope)).toEqual({ preferences: { theme: "dark" } });
    expect(dehydratePersisted(secondScope)).toEqual({ preferences: { theme: "light" } });

    first.dispose();
    second.dispose();
    firstScope.dispose();
    secondScope.dispose();
  });

  it("hydrates client state before storage defaults can overwrite it", async () => {
    const key = `ssr-hydrate-${Date.now()}`;
    await __private__.drivers.memory.set(key, JSON.stringify({ theme: "light" }), { storage: "memory" });
    hydratePersisted({ [key]: { theme: "dark" } });
    const PreferencesModel = createPersistedModel(
      {
        key,
        storage: "memory",
        select: (model) => ({ theme: model.theme.value }),
        apply(model, snapshot: { theme: "light" | "dark" }) {
          model.theme.value = snapshot.theme;
        },
      },
      () => ({ theme: signal<"light" | "dark">("light") }),
    );

    const preferences = new PreferencesModel();
    await vi.waitFor(() => expect(preferences.hydration.value).toBe("ready"));

    expect(preferences.theme.value).toBe("dark");
    preferences.dispose();
  });

  it("hydrates persisted signals from a client snapshot", () => {
    const key = `ssr-signal-${Date.now()}`;
    localStorage.setItem(key, JSON.stringify("light"));
    hydratePersisted({ [key]: "dark" });

    const theme = persistedSignal(key, "light", { storage: "local" });

    expect(theme.value).toBe("dark");
  });

  it("escapes dehydrated state for safe HTML embedding", () => {
    const serialized = serializePersistedStateForHtml({ value: "</script><script>alert(1)</script>&\u2028" });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003C/script\\u003E");
    expect(serialized).toContain("\\u0026");
  });

  it("keeps cookie request contexts isolated inside scopes", () => {
    const firstContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const secondContext = createCookieContext({ cookie: 'theme=%22light%22' });
    const firstScope = createPersistedScope({ cookieContext: firstContext });
    const secondScope = createPersistedScope({ cookieContext: secondContext });

    const first = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: firstScope.cookieContext,
      scope: firstScope,
    });
    const second = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: secondScope.cookieContext,
      scope: secondScope,
    });

    expect(first.value).toBe("dark");
    expect(second.value).toBe("light");
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
