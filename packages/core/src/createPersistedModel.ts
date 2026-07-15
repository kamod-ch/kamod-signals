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
import { emitPersistedEvent, type PersistedEventTarget } from "./events";
import { consumeHydratedPersistedValue, type PersistedScope } from "./ssr";
import {
  comparePersistedSyncMessages,
  createBroadcastSyncTransport,
  createPersistedSyncSource,
  type PersistedSyncMessage,
  type PersistedSyncTransport,
} from "./sync";
import type { CookieContext, CookieOptions, IndexedDBOptions, PersistedSignalOptions, PersistedStorage } from "./types";
import {
  FuturePersistedVersionError,
  type MaybePromise,
  type MigrationErrorStrategy,
  deserializePersistedValueAsync,
  serializePersistedValue,
} from "./versioning";

export type HydrationStatus = "idle" | "loading" | "ready" | "error";
export type { MaybePromise } from "./versioning";

export interface PersistedModelOptions<TModel extends object, TSnapshot> {
  key: string;
  storage?: PersistedStorage;
  serialize?: (snapshot: TSnapshot) => string;
  deserialize?: (raw: string) => TSnapshot;
  select: (model: Model<TModel>) => TSnapshot;
  apply: (model: Model<TModel>, snapshot: TSnapshot) => MaybePromise<void>;
  sync?: boolean | "tabs" | PersistedSyncTransport<TSnapshot>;
  cookie?: CookieOptions;
  cookieContext?: CookieContext;
  indexedDB?: IndexedDBOptions;
  version?: number;
  migrate?: (snapshot: unknown, fromVersion: number) => MaybePromise<TSnapshot>;
  validate?: (snapshot: unknown) => snapshot is TSnapshot;
  migrationErrorStrategy?: MigrationErrorStrategy;
  legacyVersion?: number;
  scope?: PersistedScope;
  events?: PersistedEventTarget<TSnapshot>;
  includeEventSnapshots?: boolean;
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
  sync: typeof options.sync === "boolean" ? options.sync : undefined,
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
    const scopedSnapshot = options.scope?.get<TSnapshot>(options.key);
    const hydratedSnapshot = scopedSnapshot ?? consumeHydratedPersistedValue<TSnapshot>(options.key);
    let isHydrating = true;
    let isApplyingSnapshot = false;
    let isDisposed = false;
    let hasPendingHydrationChange = false;
    let hasSeenSnapshot = false;
    let persistenceBlocked = false;
    let isApplyingRemoteSnapshot = false;
    let revision = 0;
    let lastAcceptedMessage: Pick<PersistedSyncMessage, "revision" | "source"> = { revision: 0, source: "" };
    const syncSource = createPersistedSyncSource();
    const syncTransport =
      options.sync === "tabs"
        ? createBroadcastSyncTransport(`@kamod-ch/signals:${options.key}`)
        : typeof options.sync === "object"
          ? options.sync
          : null;
    let stopSync: () => void = () => {};
    let stopTransport: () => void = () => {};
    let stopPersistEffect: () => void = () => {};
    let stopDisposeEffect: () => void = () => {};

    const eventBase = () => ({ key: options.key, storage });
    const eventSnapshot = (snapshot: TSnapshot) => options.includeEventSnapshots ? snapshot : undefined;

    const persistSnapshot = async (snapshot: TSnapshot) => {
      if (isDisposed) {
        return;
      }

      try {
        if (persistenceBlocked) {
          return;
        }

        emitPersistedEvent(options.events, { ...eventBase(), type: "persist:start", snapshot: eventSnapshot(snapshot) });
        options.scope?.set(options.key, snapshot);
        revision += 1;
        await driver.set(
          options.key,
          serializePersistedValue(snapshot, options, serialize),
          storageOptions as PersistedSignalOptions<unknown>,
        );
        if (!isApplyingRemoteSnapshot) {
          syncTransport?.post({
            key: options.key,
            source: syncSource,
            revision,
            version: options.version,
            payload: snapshot,
          });
        }
        error.value = null;
        emitPersistedEvent(options.events, { ...eventBase(), type: "persist:success", snapshot: eventSnapshot(snapshot) });
      } catch (persistError) {
        error.value = persistError;
        emitPersistedEvent(options.events, { ...eventBase(), type: "persist:error", error: persistError });
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
        if (options.version !== undefined) {
          emitPersistedEvent(options.events, { ...eventBase(), type: "migrate:start" });
        }
        const parsed = await deserializePersistedValueAsync(raw, options, deserialize);
        persistenceBlocked = false;
        await applySnapshot(parsed.value);
        if (parsed.migrated) {
          emitPersistedEvent(options.events, { ...eventBase(), type: "migrate:success", snapshot: eventSnapshot(parsed.value) });
          await persistSnapshot(parsed.value);
        }
      } catch (deserializeError) {
        if (options.migrationErrorStrategy === "throw") {
          emitPersistedEvent(options.events, { ...eventBase(), type: "migrate:error", error: deserializeError });
          throw deserializeError;
        }
        persistenceBlocked =
          deserializeError instanceof FuturePersistedVersionError || options.migrationErrorStrategy !== "reset";
        error.value = deserializeError;
        emitPersistedEvent(options.events, { ...eventBase(), type: "migrate:error", error: deserializeError });
      }
    };

    const hydrate = async () => {
      if (isDisposed) {
        return;
      }

      isHydrating = true;
      hydration.value = "loading";
      error.value = null;
      emitPersistedEvent(options.events, { ...eventBase(), type: "hydrate:start" });

      try {
        if (hydratedSnapshot !== undefined) {
          await applySnapshot(hydratedSnapshot);
          options.scope?.set(options.key, hydratedSnapshot);
          hydration.value = "ready";
          emitPersistedEvent(options.events, { ...eventBase(), type: "hydrate:success", snapshot: eventSnapshot(hydratedSnapshot) });
        } else {
          const raw = await driver.get(options.key, storageOptions as PersistedSignalOptions<unknown>);
          await applyRaw(raw);
          options.scope?.set(options.key, options.select(model));
          hydration.value = "ready";
          emitPersistedEvent(options.events, { ...eventBase(), type: "hydrate:success", snapshot: eventSnapshot(options.select(model)) });
        }
      } catch (hydrateError) {
        error.value = hydrateError;
        hydration.value = "error";
        emitPersistedEvent(options.events, { ...eventBase(), type: "hydrate:error", error: hydrateError });
      } finally {
        isHydrating = false;
      }

      if (hasPendingHydrationChange) {
        hasPendingHydrationChange = false;
        await persistSnapshot(options.select(model));
      }
    };

    const applyRemoteMessage = async (message: PersistedSyncMessage) => {
      if (message.key !== options.key || message.source === syncSource) {
        return;
      }

      emitPersistedEvent(options.events, { ...eventBase(), type: "sync:receive", metadata: { source: message.source, revision: message.revision } });

      if (comparePersistedSyncMessages(message, lastAcceptedMessage) <= 0) {
        emitPersistedEvent(options.events, { ...eventBase(), type: "sync:reject", metadata: { reason: "stale", source: message.source, revision: message.revision } });
        return;
      }

      try {
        const remotePayload =
          message.version === undefined
            ? message.payload
            : { __kamod: "signals" as const, v: message.version, data: message.payload };
        const parsed = await deserializePersistedValueAsync(
          JSON.stringify(remotePayload),
          options,
          (raw) => JSON.parse(raw) as TSnapshot,
        );
        lastAcceptedMessage = { revision: message.revision, source: message.source };
        revision = Math.max(revision, message.revision);
        isApplyingRemoteSnapshot = true;
        await applySnapshot(parsed.value);
      } catch (syncError) {
        error.value = syncError;
        emitPersistedEvent(options.events, { ...eventBase(), type: "sync:reject", error: syncError, metadata: { source: message.source, revision: message.revision } });
      } finally {
        isApplyingRemoteSnapshot = false;
      }
    };

    const flush = async () => {
      await persistSnapshot(options.select(model));
    };

    const reset = async () => {
      persistenceBlocked = false;
      emitPersistedEvent(options.events, { ...eventBase(), type: "reset" });
      await applySnapshot(initialSnapshot);
      await flush();
    };

    const dispose = () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      emitPersistedEvent(options.events, { ...eventBase(), type: "dispose" });
      stopSync();
      stopTransport();
      syncTransport?.dispose();
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

    if (syncTransport) {
      stopTransport = syncTransport.subscribe((message) => {
        void applyRemoteMessage(message);
      });
    }

    if (options.sync !== false && options.sync !== "tabs" && typeof options.sync !== "object" && driver.subscribe) {
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
