import { useEffect, useMemo } from "preact/hooks";
import { createPersistedSignal } from "./persistedSignal";
import { resolveStorageType } from "./shared";
import type { PersistedSignal, PersistedSignalOptions } from "./types";

const cookieDependencyKey = (options: PersistedSignalOptions<unknown>) => {
  const cookie = options.cookie;
  if (!cookie) {
    return "";
  }

  return JSON.stringify([
    cookie.expires instanceof Date ? cookie.expires.toUTCString() : cookie.expires,
    cookie.path,
    cookie.domain,
    cookie.secure,
    cookie.sameSite,
  ]);
};

export const usePersistedSignal = <T>(
  key: string,
  initialValue: T,
  options: PersistedSignalOptions<T> = {},
): PersistedSignal<T> => {
  const controller = useMemo(
    () => createPersistedSignal(key, initialValue, options),
    [
      key,
      initialValue,
      resolveStorageType(options.storage),
      options.sync,
      options.serialize,
      options.deserialize,
      options.removeOnUndefined,
      options.cookieContext,
      cookieDependencyKey(options as PersistedSignalOptions<unknown>),
    ],
  );

  useEffect(() => () => controller.dispose(), [controller]);

  return controller.signal;
};
