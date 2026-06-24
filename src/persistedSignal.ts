import { effect, signal } from "@preact/signals";
import { drivers, resolveDriver } from "./drivers";
import {
  defaultDeserialize,
  defaultSerialize,
  registryKey,
  resolveStorageType,
  type PersistedSignalController,
} from "./shared";
import type { PersistedSignal, PersistedSignalOptions } from "./types";

const globalRegistry = new Map<string, PersistedSignalController<unknown>>();
const cookieContextIds = new WeakMap<object, number>();
const UNDEFINED_TOKEN = "__KAMOD_SIGNALS_UNDEFINED__";
let cookieContextIdCounter = 0;

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

const getCookieContextRegistrySuffix = (options: PersistedSignalOptions<unknown>) => {
  const context = options.cookieContext;
  if (!context) {
    return "";
  }

  let id = cookieContextIds.get(context as object);
  if (!id) {
    id = ++cookieContextIdCounter;
    cookieContextIds.set(context as object, id);
  }

  return `:ctx-${id}`;
};

export const persistedSignal = <T>(
  key: string,
  initialValue: T,
  options: PersistedSignalOptions<T> = {},
): PersistedSignal<T> => {
  const storage = resolveStorageType(options.storage);
  const id = `${registryKey(storage, key)}${storage === "cookie" ? getCookieContextRegistrySuffix(options as PersistedSignalOptions<unknown>) : ""}`;
  const existing = globalRegistry.get(id) as PersistedSignalController<T> | undefined;

  if (existing) {
    return existing.signal;
  }

  const controller = createController(key, initialValue, options);
  globalRegistry.set(id, controller as PersistedSignalController<unknown>);
  return controller.signal;
};

export const createPersistedSignal = createController;
export const __private__ = { createController, readInitialValue, drivers, globalRegistry };
