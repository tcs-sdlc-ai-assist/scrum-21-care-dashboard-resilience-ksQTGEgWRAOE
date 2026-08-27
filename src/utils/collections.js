import { MAX_RECORDS } from '../domain/constants.js';

/**
 * @param {unknown} collection
 * @returns {unknown[]}
 */
function requireCollection(collection) {
  if (!Array.isArray(collection)) {
    throw new TypeError('collection must be an array');
  }

  return collection;
}

/**
 * @param {unknown} limit
 * @returns {number}
 */
function requireLimit(limit) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new TypeError('limit must be a non-negative safe integer');
  }

  return limit;
}

/**
 * Returns a frozen copy containing at most the newest `limit` items.
 *
 * @template T
 * @param {ReadonlyArray<T>} collection
 * @param {number} [limit]
 * @returns {ReadonlyArray<T>}
 */
export function capCollection(collection, limit = MAX_RECORDS) {
  const records = requireCollection(collection);
  const maximumSize = requireLimit(limit);

  if (maximumSize === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(records.slice(-maximumSize));
}

/**
 * Appends an item without mutating the source collection and evicts the oldest
 * items when the configured limit is exceeded.
 *
 * @template T
 * @param {ReadonlyArray<T>} collection
 * @param {T} item
 * @param {number} [limit]
 * @returns {ReadonlyArray<T>}
 */
export function appendBounded(collection, item, limit = MAX_RECORDS) {
  const records = requireCollection(collection);
  const maximumSize = requireLimit(limit);

  if (maximumSize === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([...records, item].slice(-maximumSize));
}

export const appendAndCap = appendBounded;

/**
 * Appends multiple items in order without mutating either source array and
 * evicts the oldest items when the configured limit is exceeded.
 *
 * @template T
 * @param {ReadonlyArray<T>} collection
 * @param {ReadonlyArray<T>} items
 * @param {number} [limit]
 * @returns {ReadonlyArray<T>}
 */
export function appendManyBounded(
  collection,
  items,
  limit = MAX_RECORDS,
) {
  const records = requireCollection(collection);
  const additions = requireCollection(items);
  const maximumSize = requireLimit(limit);

  if (maximumSize === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([...records, ...additions].slice(-maximumSize));
}

/**
 * Replaces a matching item by appending the new value as the newest record.
 * If no item has the same selected key, the value is appended normally.
 *
 * @template T
 * @template K
 * @param {ReadonlyArray<T>} collection
 * @param {T} item
 * @param {(item: T) => K} keySelector
 * @param {number} [limit]
 * @returns {ReadonlyArray<T>}
 */
export function upsertBounded(
  collection,
  item,
  keySelector,
  limit = MAX_RECORDS,
) {
  const records = requireCollection(collection);

  if (typeof keySelector !== 'function') {
    throw new TypeError('keySelector must be a function');
  }

  const itemKey = keySelector(item);
  const retainedRecords = records.filter(
    (record) => !Object.is(keySelector(record), itemKey),
  );

  return appendBounded(retainedRecords, item, limit);
}