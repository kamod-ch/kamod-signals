import { effect, signal } from "@preact/signals";
import { drivers, resolveDriver } from "./drivers";
import {
  defaultDeserialize,
  defaultSerialize,
  registryKey,
  resolveStorageType,
  type PersistedSignalController,
} from "./shared";
import type { CookieOptions, PersistedSignal, PersistedSignalOptions, PersistedStorage } from "./types";

type NormalizedCookieOptions = {
  expires: string | number | undefined;
  path: string;
  domain: string | undefined;
  secure: boolean | undefined;
  sameSite: CookieOptions["sameSite"] | undefined;
};

type CompatibilitySnapshot = {
  storage: PersistedStorage;
  serialize: unknown;
  deserialize: unknown;
  sync: boolean;
  removeOnUndefined: boolean;
  cookie: NormalizedCookieOptions | undefined;
  indexedDB:
    | {
        database: string;
        store: string;
        version: number;
      }
    | undefined;
};

type RegistryEntry = {
  controller: PersistedSignalController<unknown>;
  snapshot: CompatibilitySnapshot;
};

const globalRegistry = new Map<string, RegistryEntry>();
const cookieContextRegistry = new WeakMap<object, Map<string, RegistryEntry>>();
const UNDEFINED_TOKEN = "__KAMOD_SIGNALS_UNDEFINED__";

const isPromiseLike = <T>(value: unknown): value is Promise<T> =>
  typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";

const parseStoredValue = <T>(raw: string | null, initialValue: T, deserialize: (raw: string) => T): T => {
  if (raw === null) {
    return initialValue;
  }

  if (raw === UNDEFINED_TOKEN) {
    return undefined as T;
  }

  try {
    return deserialize(raw);
  } catch {
    return initialValue;
  }
};

const readInitialValue = <T>(
  key: string,
  initialValue: T,
  options: PersistedSignalOptions<T>,
  driver = resolveDriver(resolveStorageType(options.storage), options as PersistedSignalOptions<unknown>),
): T => {
  const deserialize = options.deserialize ?? defaultDeserialize<T>;
  const raw = driver.get(key, options as PersistedSignalOptions<unknown>);

  if (isPromiseLike<string | null>(raw)) {
    return initialValue;
  }

  return parseStoredValue(raw, initialValue, deserialize);
};

const normalizeCookieOptions = (cookie?: CookieOptions): NormalizedCookieOptions => ({
  expires: cookie?.expires instanceof Date ? cookie.expires.toUTCString() : cookie?.expires,
  path: cookie?.path ?? "/",
  domain: cookie?.domain,
  secure: cookie?.secure,
  sameSite: cookie?.sameSite,
});

const createCompatibilitySnapshot = <T>(options: PersistedSignalOptions<T>): CompatibilitySnapshot => {
  const storage = resolveStorageType(options.storage);

  return {
    storage,
    serialize: options.serialize ?? defaultSerialize<T>,
    deserialize: options.deserialize ?? defaultDeserialize<T>,
    sync: options.sync ?? true,
    removeOnUndefined: options.removeOnUndefined ?? true,
    cookie: storage === "cookie" ? normalizeCookieOptions(options.cookie) : undefined,
    indexedDB:
      storage === "indexeddb"
        ? {
            database: options.indexedDB?.database ?? "@kamod-ch/signals",
            store: options.indexedDB?.store ?? "signals",
            version: options.indexedDB?.version ?? 1,
          }
        : undefined,
  };
};

const snapshotsMatch = (left: CompatibilitySnapshot, right: CompatibilitySnapshot) =>
  left.storage === right.storage &&
  left.serialize === right.serialize &&
  left.deserialize === right.deserialize &&
  left.sync === right.sync &&
  left.removeOnUndefined === right.removeOnUndefined &&
  JSON.stringify(left.cookie) === JSON.stringify(right.cookie) &&
  JSON.stringify(left.indexedDB) === JSON.stringify(right.indexedDB);

const createOptionConflictError = (id: string) =>
  new Error(`persistedSignal(${id}) received conflicting options for an existing global signal`);

const getCompatibleEntry = <T>(entry: RegistryEntry | undefined, snapshot: CompatibilitySnapshot, id: string) => {
  if (!entry) {
    return undefined;
  }

  if (!snapshotsMatch(entry.snapshot, snapshot)) {
    throw createOptionConflictError(id);
  }

  return entry.controller as PersistedSignalController<T>;
};

const createController = <T>(
  key: string,
  initialValue: T,
  options: PersistedSignalOptions<T> = {},
): PersistedSignalController<T> => {
  const storage = resolveStorageType(options.storage);
  const driver = resolveDriver(storage, options as PersistedSignalOptions<unknown>);
  const serialize = options.serialize ?? defaultSerialize<T>;
  const deserialize = options.deserialize ?? defaultDeserialize<T>;
  const removeOnUndefined = options.removeOnUndefined ?? true;
  const state = signal<T>(readInitialValue(key, initialValue, options, driver)) as PersistedSignal<T>;
  let isApplyingExternalValue = false;
  let isHydrating = Boolean(driver.async);
  let observedValue = state.value;
  let hasPendingHydrationChange = false;

  const persistValue = (value: T) => {
    try {
      if (value === undefined && removeOnUndefined) {
        return driver.remove(key, options as PersistedSignalOptions<unknown>);
      }

      return driver.set(
        key,
        value === undefined ? UNDEFINED_TOKEN : serialize(value),
        options as PersistedSignalOptions<unknown>,
      );
    } catch {
      return undefined;
    }
  };

  state.clear = () => {
    isApplyingExternalValue = true;
    driver.remove(key, options as PersistedSignalOptions<unknown>);
    state.value = initialValue;
    observedValue = state.value;
    isApplyingExternalValue = false;
  };

  state.reset = () => {
    state.value = initialValue;
  };

  const stopEffect = effect(() => {
    const value = state.value;

    if (isApplyingExternalValue) {
      observedValue = value;
      return;
    }

    if (isHydrating) {
      if (!Object.is(value, observedValue)) {
        hasPendingHydrationChange = true;
      }
      observedValue = value;
      return;
    }

    observedValue = value;
    persistValue(value);
  });

  if (driver.async) {
    Promise.resolve(driver.get(key, options as PersistedSignalOptions<unknown>))
      .then((raw) => {
        if (!hasPendingHydrationChange) {
          const nextValue = parseStoredValue(raw, initialValue, deserialize);
          if (!Object.is(nextValue, state.value)) {
            isApplyingExternalValue = true;
            state.value = nextValue;
            observedValue = nextValue;
            isApplyingExternalValue = false;
          }
        }

        isHydrating = false;

        if (hasPendingHydrationChange) {
          persistValue(state.value);
        }
      })
      .catch(() => {
        isHydrating = false;
        if (hasPendingHydrationChange) {
          persistValue(state.value);
        }
      });
  }

  const applyExternalRaw = (raw: string | null) => {
    const nextValue = parseStoredValue(raw, initialValue, deserialize);

    if (Object.is(nextValue, state.value)) {
      return;
    }

    isApplyingExternalValue = true;
    state.value = nextValue;
    observedValue = nextValue;
    isApplyingExternalValue = false;
  };

  const stopSync = options.sync === false || !driver.subscribe
    ? () => {}
    : driver.subscribe(key, () => {
        try {
          const raw = driver.get(key, options as PersistedSignalOptions<unknown>);

          if (isPromiseLike<string | null>(raw)) {
            raw
              .then((value) => {
                applyExternalRaw(value);
              })
              .catch(() => {
                // ignore malformed external updates
              });
            return;
          }

          applyExternalRaw(raw);
        } catch {
          // ignore malformed external updates
        }
      }, options as PersistedSignalOptions<unknown>);

  return {
    signal: state,
    dispose() {
      stopSync();
      stopEffect();
    },
  };
};

export const persistedSignal = <T>(
  key: string,
  initialValue: T,
  options: PersistedSignalOptions<T> = {},
): PersistedSignal<T> => {
  const storage = resolveStorageType(options.storage);
  const id = registryKey(storage, key);
  const snapshot = createCompatibilitySnapshot(options);
  const context = storage === "cookie" ? options.cookieContext : undefined;

  if (context) {
    let scopedRegistry = cookieContextRegistry.get(context as object);
    if (!scopedRegistry) {
      scopedRegistry = new Map<string, RegistryEntry>();
      cookieContextRegistry.set(context as object, scopedRegistry);
    }

    const existing = getCompatibleEntry<T>(scopedRegistry.get(id), snapshot, id);
    if (existing) {
      return existing.signal;
    }

    const controller = createController(key, initialValue, options);
    scopedRegistry.set(id, { controller: controller as PersistedSignalController<unknown>, snapshot });
    return controller.signal;
  }

  const existing = getCompatibleEntry<T>(globalRegistry.get(id), snapshot, id);
  if (existing) {
    return existing.signal;
  }

  const controller = createController(key, initialValue, options);
  globalRegistry.set(id, { controller: controller as PersistedSignalController<unknown>, snapshot });
  return controller.signal;
};

export const createPersistedSignal = createController;
export const __private__ = { createController, readInitialValue, drivers, globalRegistry };
