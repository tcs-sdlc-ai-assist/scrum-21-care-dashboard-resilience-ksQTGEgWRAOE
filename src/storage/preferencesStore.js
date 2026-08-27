const STORAGE_NAMESPACE = 'care-dashboard';
const STORAGE_VERSION = 'v1';
const MAX_STORAGE_BYTES = 2_048;

export const PREFERENCES_STORAGE_KEY =
  `${STORAGE_NAMESPACE}.preferences.${STORAGE_VERSION}`;
export const SCENARIO_STORAGE_KEY =
  `${STORAGE_NAMESPACE}.scenario.${STORAGE_VERSION}`;

export const DEFAULT_PREFERENCES = Object.freeze({
  reducedMotion: false,
  density: 'comfortable',
});

export const DEFAULT_SCENARIO = Object.freeze({
  scenarioId: 'baseline',
});

export const SUPPORTED_DENSITIES = Object.freeze([
  'comfortable',
  'compact',
]);

export const SUPPORTED_SCENARIO_IDS = Object.freeze([
  'baseline',
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {Record<string, unknown>} value
 * @param {ReadonlyArray<string>} allowedKeys
 * @returns {boolean}
 */
function hasExactKeys(value, allowedKeys) {
  const keys = Object.keys(value);

  return (
    keys.length === allowedKeys.length &&
    keys.every((key) => allowedKeys.includes(key))
  );
}

/**
 * @param {unknown} value
 * @returns {value is {reducedMotion: boolean, density: string}}
 */
function isValidPreferences(value) {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ['reducedMotion', 'density']) &&
    typeof value.reducedMotion === 'boolean' &&
    SUPPORTED_DENSITIES.includes(value.density)
  );
}

/**
 * @param {unknown} value
 * @returns {value is {scenarioId: string}}
 */
function isValidScenario(value) {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ['scenarioId']) &&
    SUPPORTED_SCENARIO_IDS.includes(value.scenarioId)
  );
}

/**
 * @param {unknown} storage
 * @returns {Storage|null}
 */
function resolveStorage(storage) {
  if (storage !== undefined) {
    return (
      storage !== null &&
      typeof storage === 'object' &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    )
      ? storage
      : null;
  }

  try {
    const browserStorage = globalThis.localStorage;

    return (
      browserStorage &&
      typeof browserStorage.getItem === 'function' &&
      typeof browserStorage.setItem === 'function' &&
      typeof browserStorage.removeItem === 'function'
    )
      ? browserStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isWithinStorageLimit(value) {
  return value.length <= MAX_STORAGE_BYTES;
}

/**
 * @param {Storage|null} storage
 * @param {string} key
 * @returns {void}
 */
function removeInvalidValue(storage, key) {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable because of browser privacy or quota policies.
  }
}

/**
 * @param {unknown} storage
 * @param {string} key
 * @param {(value: unknown) => boolean} validator
 * @param {Readonly<Record<string, unknown>>} fallback
 * @returns {Readonly<Record<string, unknown>>}
 */
function loadValue(storage, key, validator, fallback) {
  const targetStorage = resolveStorage(storage);

  if (targetStorage === null) {
    return fallback;
  }

  let serialized;

  try {
    serialized = targetStorage.getItem(key);
  } catch {
    return fallback;
  }

  if (serialized === null) {
    return fallback;
  }

  if (
    typeof serialized !== 'string' ||
    !isWithinStorageLimit(serialized)
  ) {
    removeInvalidValue(targetStorage, key);
    return fallback;
  }

  try {
    const parsed = JSON.parse(serialized);

    if (!validator(parsed)) {
      removeInvalidValue(targetStorage, key);
      return fallback;
    }

    return Object.freeze({ ...parsed });
  } catch {
    removeInvalidValue(targetStorage, key);
    return fallback;
  }
}

/**
 * @param {unknown} storage
 * @param {string} key
 * @param {unknown} value
 * @param {(value: unknown) => boolean} validator
 * @returns {boolean}
 */
function saveValue(storage, key, value, validator) {
  const targetStorage = resolveStorage(storage);

  if (targetStorage === null) {
    return false;
  }

  if (!validator(value)) {
    removeInvalidValue(targetStorage, key);
    return false;
  }

  const serialized = JSON.stringify(value);

  if (!isWithinStorageLimit(serialized)) {
    removeInvalidValue(targetStorage, key);
    return false;
  }

  try {
    targetStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads validated, non-sensitive UI preferences. Malformed, oversized, or
 * unknown fields are removed and replaced with defaults.
 *
 * @param {Storage} [storage]
 * @returns {Readonly<{reducedMotion: boolean, density: string}>}
 */
export function loadPreferences(storage) {
  return loadValue(
    storage,
    PREFERENCES_STORAGE_KEY,
    isValidPreferences,
    DEFAULT_PREFERENCES,
  );
}

/**
 * Saves only the exact allowlisted UI preference schema.
 *
 * @param {unknown} preferences
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function savePreferences(preferences, storage) {
  return saveValue(
    storage,
    PREFERENCES_STORAGE_KEY,
    preferences,
    isValidPreferences,
  );
}

/**
 * Loads the allowlisted browser-local demo scenario selection.
 *
 * @param {Storage} [storage]
 * @returns {Readonly<{scenarioId: string}>}
 */
export function loadScenario(storage) {
  return loadValue(
    storage,
    SCENARIO_STORAGE_KEY,
    isValidScenario,
    DEFAULT_SCENARIO,
  );
}

/**
 * Saves only the exact allowlisted demo scenario schema.
 *
 * @param {unknown} scenario
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveScenario(scenario, storage) {
  return saveValue(
    storage,
    SCENARIO_STORAGE_KEY,
    scenario,
    isValidScenario,
  );
}

/**
 * Removes both permitted storage records.
 *
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function clearStoredSettings(storage) {
  const targetStorage = resolveStorage(storage);

  if (targetStorage === null) {
    return false;
  }

  try {
    targetStorage.removeItem(PREFERENCES_STORAGE_KEY);
    targetStorage.removeItem(SCENARIO_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}