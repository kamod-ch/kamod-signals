import {
  createModel,
  effect,
  signal,
  type Model,
  type ModelConstructor,
  type ReadonlySignal,
} from "@preact/signals";
import { resolveDriver } from "./drivers";
import { defaultDeserialize, defaultSerialize, resolveStorageType } from "./shared";
import type { CookieContext, CookieOptions, IndexedDBOptions, PersistedSignalOptions, PersistedStorage } from "./types";

export type HydrationStatus = "idle" | "loading" | "ready" | "error";
export type MaybePromise<T> = T | Promise<T>;

export interface PersistedModelOptions<TModel extends object, TSnapshot> {
  key: string;
  storage?: PersistedStorage;
  serialize?: (snapshot: TSnapshot) => string;
  deserialize?: (raw: string) => TSnapshot;
  select: (model: Model<TModel>) => TSnapshot;
  apply: (model: Model<TModel>, snapshot: TSnapshot) => MaybePromise<void>;
  sync?: boolean;
  cookie?: CookieOptions;
  cookieContext?: CookieContext;
  indexedDB?: IndexedDBOptions;
}

export interface PersistedModelControls {
  readonly hydration: ReadonlySignal<HydrationStatus>;
  readonly error: ReadonlySignal<unknown | null>;
  hydrate(): Promise<void>;
  flush(): Promise<void>;
  reset(): Promise<void>;
  dispose(): void;
}

export type PersistedModel<TModel extends object> = Model<TModel & PersistedModelControls>;

const isPromiseLike = <T>(value: unknown): value is Promise<T> =>
  typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";

const toStorageOptions = <TSnapshot>(
  options: PersistedModelOptions<object, TSnapshot>,
): PersistedSignalOptions<TSnapshot> => ({
  storage: options.storage,
  serialize: options.serialize,
  deserialize: options.deserialize,
  sync: options.sync,
  cookie: options.cookie,
  cookieContext: options.cookieContext,
  indexedDB: options.indexedDB,
});

export const createPersistedModel = <TModel extends object, TSnapshot, TArgs extends unknown[]>(
  options: PersistedModelOptions<TModel, TSnapshot>,
  factory: (...args: TArgs) => TModel,
): ModelConstructor<TModel & PersistedModelControls, TArgs> => {
  const PersistedModelConstructor = createModel((...args: TArgs) => {
    const model = factory(...args) as Model<TModel>;
    const storageOptions = toStorageOptions(options as PersistedModelOptions<object, TSnapshot>);
    const storage = resolveStorageType(options.storage);
    const driver = resolveDriver(storage, storageOptions as PersistedSignalOptions<unknown>);
    const serialize = options.serialize ?? defaultSerialize<TSnapshot>;
    const deserialize = options.deserialize ?? defaultDeserialize<TSnapshot>;
    const hydration = signal<HydrationStatus>("idle");
    const error = signal<unknown | null>(null);
    const initialSnapshot = options.select(model);
    let isHydrating = true;
    let isApplyingSnapshot = false;
    let isDisposed = false;
    let hasPendingHydrationChange = false;
    let hasSeenSnapshot = false;
    let stopSync: () => void = () => {};
    let stopPersistEffect: () => void = () => {};
    let stopDisposeEffect: () => void = () => {};

    const persistSnapshot = async (snapshot: TSnapshot) => {
      if (isDisposed) {
        return;
      }

      try {
        await driver.set(options.key, serialize(snapshot), storageOptions as PersistedSignalOptions<unknown>);
        error.value = null;
      } catch (persistError) {
        error.value = persistError;
      }
    };

    const applySnapshot = async (snapshot: TSnapshot) => {
      if (isDisposed) {
        return;
      }

      isApplyingSnapshot = true;
      try {
        await options.apply(model, snapshot);
        error.value = null;
      } catch (applyError) {
        error.value = applyError;
      } finally {
        isApplyingSnapshot = false;
      }
    };

    const applyRaw = async (raw: string | null) => {
      if (raw === null) {
        return;
      }

      try {
        await applySnapshot(deserialize(raw));
      } catch (deserializeError) {
        error.value = deserializeError;
      }
    };

    const hydrate = async () => {
      if (isDisposed) {
        return;
      }

      isHydrating = true;
      hydration.value = "loading";
      error.value = null;

      try {
        const raw = await driver.get(options.key, storageOptions as PersistedSignalOptions<unknown>);
        await applyRaw(raw);
        hydration.value = "ready";
      } catch (hydrateError) {
        error.value = hydrateError;
        hydration.value = "error";
      } finally {
        isHydrating = false;
      }

      if (hasPendingHydrationChange) {
        hasPendingHydrationChange = false;
        await persistSnapshot(options.select(model));
      }
    };

    const flush = async () => {
      await persistSnapshot(options.select(model));
    };

    const reset = async () => {
      await applySnapshot(initialSnapshot);
      await flush();
    };

    const dispose = () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      stopSync();
      stopPersistEffect();
      stopDisposeEffect();
      hydration.value = "idle";
    };

    stopPersistEffect = effect(() => {
      const snapshot = options.select(model);

      if (isDisposed || isApplyingSnapshot) {
        return;
      }

      if (!hasSeenSnapshot) {
        hasSeenSnapshot = true;
        return;
      }

      if (isHydrating) {
        hasPendingHydrationChange = true;
        return;
      }

      void persistSnapshot(snapshot);
    });

    if (options.sync !== false && driver.subscribe) {
      stopSync = driver.subscribe(
        options.key,
        () => {
          if (isDisposed || isApplyingSnapshot) {
            return;
          }

          try {
            const raw = driver.get(options.key, storageOptions as PersistedSignalOptions<unknown>);
            if (isPromiseLike<string | null>(raw)) {
              raw.then((value) => void applyRaw(value)).catch((syncError) => {
                error.value = syncError;
              });
              return;
            }

            void applyRaw(raw);
          } catch (syncError) {
            error.value = syncError;
          }
        },
        storageOptions as PersistedSignalOptions<unknown>,
      );
    }

    stopDisposeEffect = effect(() => () => {
      dispose();
    });

    void hydrate();

    return {
      ...model,
      hydration,
      error,
      hydrate,
      flush,
      reset,
      dispose,
    };
  });

  return PersistedModelConstructor as unknown as ModelConstructor<TModel & PersistedModelControls, TArgs>;
};
