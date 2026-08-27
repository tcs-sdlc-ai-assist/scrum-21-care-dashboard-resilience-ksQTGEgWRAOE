import {
  assertSafeForLogging,
} from '../utils/privacy.js';
import {
  isBoundedId,
  isDependencyId,
} from '../domain/model.js';

const EVENT_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
const SYNTHETIC_PROFILE_ID_PATTERN = /^MOCK-[0-9]{4}$/;

const ALLOWED_METADATA_FIELDS = Object.freeze([
  'eventId',
  'mockEventId',
  'dependencyId',
  'role',
  'timestamp',
]);

const SUPPORTED_ROLES = Object.freeze([
  'clinical',
  'sre',
  'CARE_TEAM',
  'SRE',
]);

const BUILD_IS_DEVELOPMENT = import.meta.env.DEV === true;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} eventCode
 * @returns {string}
 */
function requireEventCode(eventCode) {
  if (
    typeof eventCode !== 'string' ||
    !EVENT_CODE_PATTERN.test(eventCode)
  ) {
    throw new TypeError(
      'eventCode must be an uppercase privacy-safe event code',
    );
  }

  return eventCode;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireEventId(value, field) {
  if (
    !isBoundedId(value) ||
    SYNTHETIC_PROFILE_ID_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${field} must be a non-profile privacy-safe event identifier`,
    );
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function requireTimestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      'timestamp must be a non-negative safe integer',
    );
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireRole(value) {
  if (!SUPPORTED_ROLES.includes(value)) {
    throw new TypeError('role must be a supported demo role');
  }

  return value;
}

/**
 * Creates a flat, immutable diagnostic record. Only operational identifiers
 * are accepted; payloads and arbitrary metadata are rejected.
 *
 * @param {unknown} eventCode
 * @param {unknown} [metadata]
 * @returns {Readonly<{
 *   eventCode: string,
 *   eventId?: string,
 *   mockEventId?: string,
 *   dependencyId?: string,
 *   role?: string,
 *   timestamp?: number
 * }>}
 */
export function createPrivacyLogRecord(eventCode, metadata = {}) {
  const validEventCode = requireEventCode(eventCode);

  if (!isPlainObject(metadata)) {
    throw new TypeError('metadata must be an object');
  }

  const keys = Object.keys(metadata);

  if (
    keys.some((key) => !ALLOWED_METADATA_FIELDS.includes(key))
  ) {
    throw new TypeError(
      'metadata contains payload or unsupported diagnostic fields',
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(metadata, 'eventId') &&
    Object.prototype.hasOwnProperty.call(metadata, 'mockEventId')
  ) {
    throw new TypeError(
      'metadata must provide either eventId or mockEventId, not both',
    );
  }

  const record = {
    eventCode: validEventCode,
  };

  if (Object.prototype.hasOwnProperty.call(metadata, 'eventId')) {
    record.eventId = requireEventId(metadata.eventId, 'eventId');
  }

  if (
    Object.prototype.hasOwnProperty.call(metadata, 'mockEventId')
  ) {
    record.mockEventId = requireEventId(
      metadata.mockEventId,
      'mockEventId',
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(metadata, 'dependencyId')
  ) {
    if (!isDependencyId(metadata.dependencyId)) {
      throw new TypeError(
        'dependencyId must be a supported mock dependency',
      );
    }

    record.dependencyId = metadata.dependencyId;
  }

  if (Object.prototype.hasOwnProperty.call(metadata, 'role')) {
    record.role = requireRole(metadata.role);
  }

  if (
    Object.prototype.hasOwnProperty.call(metadata, 'timestamp')
  ) {
    record.timestamp = requireTimestamp(metadata.timestamp);
  }

  assertSafeForLogging(record);
  return Object.freeze(record);
}

/**
 * @param {Readonly<Record<string, unknown>>} record
 * @returns {void}
 */
function writeToDevelopmentConsole(record) {
  const browserConsole = globalThis.console;

  if (
    browserConsole !== undefined &&
    typeof browserConsole.info === 'function'
  ) {
    browserConsole.info(record);
  }
}

/**
 * @param {unknown} value
 * @returns {(record: Readonly<Record<string, unknown>>) => void}
 */
function requireWriter(value) {
  if (value === undefined) {
    return writeToDevelopmentConsole;
  }

  if (typeof value === 'function') {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.info === 'function'
  ) {
    return value.info.bind(value);
  }

  throw new TypeError(
    'writer must be a function or provide an info method',
  );
}

/**
 * Development-only structured logger for allowlisted browser-local events.
 */
export class PrivacyLogger {
  /**
   * @param {{
   *   enabled?: boolean,
   *   isDevelopment?: boolean,
   *   writer?: Function,
   *   sink?: Function|{info: Function}
   * }} [options]
   */
  constructor(options = {}) {
    if (!isPlainObject(options)) {
      throw new TypeError('options must be an object');
    }

    const requestedEnabled =
      options.enabled ?? options.isDevelopment ?? true;

    if (typeof requestedEnabled !== 'boolean') {
      throw new TypeError('enabled must be a boolean');
    }

    if (
      options.writer !== undefined &&
      options.sink !== undefined
    ) {
      throw new TypeError(
        'options must provide either writer or sink, not both',
      );
    }

    this.enabled =
      BUILD_IS_DEVELOPMENT && requestedEnabled;
    this.writer = requireWriter(options.writer ?? options.sink);

    Object.freeze(this);
  }

  /**
   * Validates an event in every build and writes it only during development.
   *
   * @param {unknown} eventCode
   * @param {unknown} [metadata]
   * @returns {boolean}
   */
  log(eventCode, metadata = {}) {
    const record = createPrivacyLogRecord(eventCode, metadata);

    if (!this.enabled) {
      return false;
    }

    try {
      this.writer(record);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

/**
 * @param {{
 *   enabled?: boolean,
 *   isDevelopment?: boolean,
 *   writer?: Function,
 *   sink?: Function|{info: Function}
 * }} [options]
 * @returns {PrivacyLogger}
 */
export function createPrivacyLogger(options) {
  return new PrivacyLogger(options);
}

export const privacyLogger = createPrivacyLogger();

/**
 * @param {unknown} eventCode
 * @param {unknown} [metadata]
 * @returns {boolean}
 */
export function logPrivacyEvent(eventCode, metadata = {}) {
  return privacyLogger.log(eventCode, metadata);
}

export const logDiagnosticEvent = logPrivacyEvent;

export default privacyLogger;