export type MaybePromise<T> = T | Promise<T>;

export type MigrationErrorStrategy = "preserve" | "reset" | "throw";

export interface PersistedVersioningOptions<T> {
  version?: number;
  migrate?: (snapshot: unknown, fromVersion: number) => MaybePromise<T>;
  validate?: (snapshot: unknown) => snapshot is T;
  migrationErrorStrategy?: MigrationErrorStrategy;
  legacyVersion?: number;
}

export type PersistedEnvelope<T> = {
  __kamod: "signals";
  v: number;
  data: T;
};

export class FuturePersistedVersionError extends Error {
  constructor(
    readonly persistedVersion: number,
    readonly supportedVersion: number,
  ) {
    super(`Persisted payload version ${persistedVersion} is newer than supported version ${supportedVersion}`);
    this.name = "FuturePersistedVersionError";
  }
}

export class PersistedValidationError extends Error {
  constructor() {
    super("Persisted payload validation failed");
    this.name = "PersistedValidationError";
  }
}

export const isPersistedEnvelope = (value: unknown): value is PersistedEnvelope<unknown> =>
  typeof value === "object" &&
  value !== null &&
  (value as { __kamod?: unknown }).__kamod === "signals" &&
  typeof (value as { v?: unknown }).v === "number" &&
  "data" in value;

export const serializePersistedValue = <T>(
  value: T,
  options: PersistedVersioningOptions<T>,
  serialize: (value: T) => string,
): string => {
  if (options.version === undefined) {
    return serialize(value);
  }

  return JSON.stringify({ __kamod: "signals", v: options.version, data: value } satisfies PersistedEnvelope<T>);
};

const validateSnapshot = <T>(snapshot: unknown, options: PersistedVersioningOptions<T>): T => {
  if (options.validate && !options.validate(snapshot)) {
    throw new PersistedValidationError();
  }

  return snapshot as T;
};

export const deserializePersistedValue = <T>(
  raw: string,
  options: PersistedVersioningOptions<T>,
  deserialize: (raw: string) => T,
): { value: T; migrated: boolean } => {
  if (options.version === undefined) {
    const value = deserialize(raw);
    return { value: validateSnapshot(value, options), migrated: false };
  }

  const parsed = JSON.parse(raw) as unknown;
  const currentVersion = options.version;
  const legacyVersion = options.legacyVersion ?? 0;
  const fromVersion = isPersistedEnvelope(parsed) ? parsed.v : legacyVersion;
  const snapshot = isPersistedEnvelope(parsed) ? parsed.data : deserialize(raw);

  if (fromVersion > currentVersion) {
    throw new FuturePersistedVersionError(fromVersion, currentVersion);
  }

  if (fromVersion === currentVersion) {
    return { value: validateSnapshot(snapshot, options), migrated: false };
  }

  if (!options.migrate) {
    return { value: validateSnapshot(snapshot, options), migrated: false };
  }

  const migrated = options.migrate(snapshot, fromVersion);
  if (migrated && typeof migrated === "object" && "then" in migrated) {
    throw new TypeError("Asynchronous migrations require an asynchronous persistence pipeline");
  }

  return { value: validateSnapshot(migrated, options), migrated: true };
};

export const deserializePersistedValueAsync = async <T>(
  raw: string,
  options: PersistedVersioningOptions<T>,
  deserialize: (raw: string) => T,
): Promise<{ value: T; migrated: boolean }> => {
  if (options.version === undefined) {
    const value = deserialize(raw);
    return { value: validateSnapshot(value, options), migrated: false };
  }

  const parsed = JSON.parse(raw) as unknown;
  const currentVersion = options.version;
  const legacyVersion = options.legacyVersion ?? 0;
  const fromVersion = isPersistedEnvelope(parsed) ? parsed.v : legacyVersion;
  const snapshot = isPersistedEnvelope(parsed) ? parsed.data : deserialize(raw);

  if (fromVersion > currentVersion) {
    throw new FuturePersistedVersionError(fromVersion, currentVersion);
  }

  if (fromVersion === currentVersion) {
    return { value: validateSnapshot(snapshot, options), migrated: false };
  }

  if (!options.migrate) {
    return { value: validateSnapshot(snapshot, options), migrated: false };
  }

  const migrated = await options.migrate(snapshot, fromVersion);
  return { value: validateSnapshot(migrated, options), migrated: true };
};
