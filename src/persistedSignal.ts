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

const readInitialValue = <T>(
  key: string,
  initialValue: T,
  options: PersistedSignalOptions<T>,
  driver = resolveDriver(resolveStorageType(options.storage), options as PersistedSignalOptions<unknown>),
): T => {
  const deserialize = options.deserialize ?? defaultDeserialize<T>;
  const raw = driver.get(key, options as PersistedSignalOptions<unknown>);

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

  state.clear = () => {
    isApplyingExternalValue = true;
    driver.remove(key, options as PersistedSignalOptions<unknown>);
    state.value = initialValue;
    isApplyingExternalValue = false;
  };

  state.reset = () => {
    state.value = initialValue;
  };

  const stopEffect = effect(() => {
    const value = state.value;

    if (isApplyingExternalValue) {
      return;
    }

    if (value === undefined && removeOnUndefined) {
      driver.remove(key, options as PersistedSignalOptions<unknown>);
      return;
    }

    try {
      driver.set(
        key,
        value === undefined ? UNDEFINED_TOKEN : serialize(value),
        options as PersistedSignalOptions<unknown>,
      );
    } catch {
      // ignore storage write errors and keep signal reactive in memory
    }
  });

  const stopSync = options.sync === false || !driver.subscribe
    ? () => {}
    : driver.subscribe(key, () => {
        const raw = driver.get(key, options as PersistedSignalOptions<unknown>);
        const nextValue = raw === null
          ? initialValue
          : raw === UNDEFINED_TOKEN
            ? (undefined as T)
            : deserialize(raw);

        if (Object.is(nextValue, state.value)) {
          return;
        }

        isApplyingExternalValue = true;
        state.value = nextValue;
        isApplyingExternalValue = false;
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
