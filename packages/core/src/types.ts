import type { Signal } from "@preact/signals";

export type PersistedStorage = "local" | "session" | "cookie" | "memory" | "indexeddb";

export interface CookieOptions {
  expires?: number | Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

export interface CookieContext {
  get(key: string): string | null;
  set(key: string, value: string, options?: CookieOptions): void;
  remove(key: string, options?: CookieOptions): void;
  subscribe?(key: string, callback: () => void): () => void;
  toSetCookieHeaders?(): string[];
}

export interface IndexedDBOptions {
  database?: string;
  store?: string;
  version?: number;
}

export interface PersistedSignalOptions<T> {
  storage?: PersistedStorage;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  sync?: boolean;
  removeOnUndefined?: boolean;
  cookie?: CookieOptions;
  cookieContext?: CookieContext;
  indexedDB?: IndexedDBOptions;
}

export interface PersistedSignal<T> extends Signal<T> {
  clear(): void;
  reset(): void;
}
