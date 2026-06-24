import type { PersistedSignal, PersistedSignalOptions, PersistedStorage } from "./types";

export interface StorageDriver {
  readonly type: PersistedStorage;
  readonly async?: boolean;
  isAvailable(options?: PersistedSignalOptions<unknown>): boolean;
  get(key: string, options?: PersistedSignalOptions<unknown>): string | null | Promise<string | null>;
  set(key: string, value: string, options?: PersistedSignalOptions<unknown>): void | Promise<void>;
  remove(key: string, options?: PersistedSignalOptions<unknown>): void | Promise<void>;
  subscribe?(key: string, callback: () => void, options?: PersistedSignalOptions<unknown>): () => void;
}

export interface PersistedSignalController<T> {
  signal: PersistedSignal<T>;
  dispose: () => void;
}

export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export const defaultSerialize = <T>(value: T) => JSON.stringify(value);
export const defaultDeserialize = <T>(raw: string) => JSON.parse(raw) as T;

export const resolveStorageType = (storage?: PersistedStorage): PersistedStorage => storage ?? "local";

export const registryKey = (storage: PersistedStorage, key: string) => `${storage}:${key}`;
