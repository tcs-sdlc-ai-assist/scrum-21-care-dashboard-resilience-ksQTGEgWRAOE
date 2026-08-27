import { FALLBACK_TTL_MS } from '../domain/constants.js';
import {
  createFallbackState,
  isBoundedId,
  isProfileId,
} from '../domain/model.js';

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function requireTtl(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('ttlMs must be a positive safe integer');
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireProfileId(value, field = 'profileId') {
  if (!isProfileId(value)) {
    throw new TypeError(`${field} must match MOCK-####`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireFallbackId(value, field = 'fallbackId') {
  if (!isBoundedId(value)) {
    throw new TypeError(
      `${field} must be a non-empty privacy-safe identifier`,
    );
  }

  return value;
}

/**
 * Memory-only repository for synthetic fallback profiles. Records are never
 * persisted and expired records are removed when read or explicitly expired.
 */
export class FallbackRepository {
  constructor() {
    this.records = new Map();
    this.nextFallbackId = 1;
    this.nextTimerRevision = 1;
  }

  /**
   * Creates or replaces the active fallback for a synthetic profile.
   *
   * @param {string} profileId
   * @param {ReturnType<import('../domain/model.js').createMockProfile>} profile
   * @param {number} now
   * @param {number} [ttlMs]
   * @returns {ReturnType<typeof createFallbackState>}
   */
  put(profileId, profile, now, ttlMs = FALLBACK_TTL_MS) {
    const validProfileId = requireProfileId(profileId);
    const createdAt = requireTimestamp(now, 'now');
    const validTtl = requireTtl(ttlMs);
    const expiresAt = createdAt + validTtl;

    if (!Number.isSafeInteger(expiresAt)) {
      throw new RangeError('fallback expiry exceeds the safe timestamp range');
    }

    const fallback = createFallbackState({
      id: `fallback-${this.nextFallbackId}`,
      profileId: validProfileId,
      data: profile,
      createdAt,
      expiresAt,
      timerRevision: this.nextTimerRevision,
    });

    this.nextFallbackId += 1;
    this.nextTimerRevision += 1;
    this.records.set(validProfileId, fallback);

    return fallback;
  }

  /**
   * Returns an unexpired fallback for a profile. Expired records are removed
   * before returning.
   *
   * @param {string} profileId
   * @param {number} now
   * @returns {ReturnType<typeof createFallbackState>|null}
   */
  getValid(profileId, now) {
    const validProfileId = requireProfileId(profileId);
    const currentTimestamp = requireTimestamp(now, 'now');
    const fallback = this.records.get(validProfileId);

    if (fallback === undefined) {
      return null;
    }

    if (currentTimestamp >= fallback.expiresAt) {
      this.records.delete(validProfileId);
      return null;
    }

    return fallback;
  }

  /**
   * Returns a fallback by its repository identifier without applying an
   * expiry check.
   *
   * @param {string} fallbackId
   * @returns {ReturnType<typeof createFallbackState>|null}
   */
  getById(fallbackId) {
    const validFallbackId = requireFallbackId(fallbackId);

    for (const fallback of this.records.values()) {
      if (fallback.id === validFallbackId) {
        return fallback;
      }
    }

    return null;
  }

  /**
   * Removes a fallback by identifier.
   *
   * @param {string} fallbackId
   * @returns {boolean}
   */
  remove(fallbackId) {
    const validFallbackId = requireFallbackId(fallbackId);

    for (const [profileId, fallback] of this.records.entries()) {
      if (fallback.id === validFallbackId) {
        this.records.delete(profileId);
        return true;
      }
    }

    return false;
  }

  /**
   * Removes a fallback only when the identifier and timer revision still
   * identify the current record and its expiry time has been reached.
   *
   * @param {string} fallbackId
   * @param {number} timerRevision
   * @param {number} now
   * @returns {boolean}
   */
  expire(fallbackId, timerRevision, now) {
    const validFallbackId = requireFallbackId(fallbackId);
    const validRevision = requireTimestamp(
      timerRevision,
      'timerRevision',
    );
    const currentTimestamp = requireTimestamp(now, 'now');

    for (const [profileId, fallback] of this.records.entries()) {
      if (fallback.id !== validFallbackId) {
        continue;
      }

      if (
        fallback.timerRevision !== validRevision ||
        currentTimestamp < fallback.expiresAt
      ) {
        return false;
      }

      this.records.delete(profileId);
      return true;
    }

    return false;
  }

  /**
   * Removes every fallback record while preserving monotonic identifiers and
   * revisions so callbacks created before clearing cannot match new records.
   *
   * @returns {void}
   */
  clear() {
    this.records.clear();
  }
}

export default FallbackRepository;