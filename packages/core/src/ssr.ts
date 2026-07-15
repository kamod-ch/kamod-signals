import type { CookieContext } from "./types";

export type PersistedDehydratedState = Record<string, unknown>;

export interface PersistedScopeOptions {
  cookieContext?: CookieContext;
  initialState?: PersistedDehydratedState;
}

export interface PersistedScope {
  readonly cookieContext: CookieContext | undefined;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  dehydrate(): PersistedDehydratedState;
  dispose(): void;
}

let globalHydrationState = new Map<string, unknown>();

const toMap = (state?: PersistedDehydratedState) => new Map(Object.entries(state ?? {}));

export const createPersistedScope = (options: PersistedScopeOptions = {}): PersistedScope => {
  const snapshots = toMap(options.initialState);
  let disposed = false;

  return {
    cookieContext: options.cookieContext,
    get<T>(key: string) {
      return snapshots.get(key) as T | undefined;
    },
    set<T>(key: string, value: T) {
      if (!disposed) {
        snapshots.set(key, value);
      }
    },
    dehydrate() {
      return disposed ? {} : Object.fromEntries(snapshots.entries());
    },
    dispose() {
      disposed = true;
      snapshots.clear();
    },
  };
};

export const dehydratePersisted = (scope: PersistedScope): PersistedDehydratedState => scope.dehydrate();

export const hydratePersisted = (state: PersistedDehydratedState): void => {
  globalHydrationState = toMap(state);
};

export const consumeHydratedPersistedValue = <T>(key: string): T | undefined => {
  if (!globalHydrationState.has(key)) {
    return undefined;
  }

  const value = globalHydrationState.get(key) as T;
  globalHydrationState.delete(key);
  return value;
};

export const serializePersistedStateForHtml = (state: PersistedDehydratedState): string =>
  JSON.stringify(state)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
