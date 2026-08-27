export const DOMAIN_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNSUPPORTED_DEPENDENCY: 'UNSUPPORTED_DEPENDENCY',
  UNSUPPORTED_CONDITION: 'UNSUPPORTED_CONDITION',
  STALE_TRANSITION: 'STALE_TRANSITION',
  STALE_TIMER: 'STALE_TIMER',
  PROFILE_UNAVAILABLE: 'PROFILE_UNAVAILABLE',
  NOT_FOUND: 'NOT_FOUND',
  ENGINE_STOPPED: 'ENGINE_STOPPED',
});

const SAFE_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

/**
 * @param {unknown} field
 * @returns {Readonly<{field: string}>|undefined}
 */
function createFieldDetails(field) {
  if (typeof field !== 'string' || !SAFE_FIELD_PATTERN.test(field)) {
    return undefined;
  }

  return Object.freeze({ field });
}

/**
 * Base error for expected domain failures. Messages and details are designed
 * for safe inclusion in browser-local command results.
 */
export class DomainError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Readonly<Record<string, string|number|boolean|null>>} [details]
   */
  constructor(code, message, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }
  }
}

/**
 * Raised when a command does not satisfy its public input contract.
 */
export class InvalidCommandError extends DomainError {
  /**
   * @param {unknown} [field]
   */
  constructor(field) {
    super(
      DOMAIN_ERROR_CODES.VALIDATION_ERROR,
      'Command input is invalid',
      createFieldDetails(field),
    );
    this.name = 'InvalidCommandError';
  }
}

/**
 * Raised when a command targets a dependency outside the fixed allow-list.
 */
export class UnsupportedDependencyError extends DomainError {
  constructor() {
    super(
      DOMAIN_ERROR_CODES.UNSUPPORTED_DEPENDENCY,
      'Dependency is not supported',
    );
    this.name = 'UnsupportedDependencyError';
  }
}

/**
 * Raised when a simulation condition is outside the supported allow-list.
 */
export class UnsupportedConditionError extends DomainError {
  constructor() {
    super(
      DOMAIN_ERROR_CODES.UNSUPPORTED_CONDITION,
      'Response condition is not supported',
    );
    this.name = 'UnsupportedConditionError';
  }
}

/**
 * Raised when a transition no longer applies to the current domain state.
 */
export class StaleTransitionError extends DomainError {
  constructor() {
    super(
      DOMAIN_ERROR_CODES.STALE_TRANSITION,
      'Transition is stale and was not applied',
    );
    this.name = 'StaleTransitionError';
  }
}

/**
 * Raised when an expiry callback refers to a replaced or removed fallback.
 */
export class StaleTimerError extends DomainError {
  constructor() {
    super(
      DOMAIN_ERROR_CODES.STALE_TIMER,
      'Fallback expiry timer is stale',
    );
    this.name = 'StaleTimerError';
  }
}

/**
 * Raised when no valid synthetic profile source or fallback is available.
 */
export class FallbackUnavailableError extends DomainError {
  constructor() {
    super(
      DOMAIN_ERROR_CODES.PROFILE_UNAVAILABLE,
      'Synthetic profile data is unavailable',
    );
    this.name = 'FallbackUnavailableError';
  }
}

/**
 * Raised when a requested browser-local record cannot be found.
 */
export class DomainRecordNotFoundError extends DomainError {
  constructor() {
    super(DOMAIN_ERROR_CODES.NOT_FOUND, 'Requested record was not found');
    this.name = 'DomainRecordNotFoundError';
  }
}

/**
 * Raised when a command is submitted after the engine has stopped.
 */
export class EngineStoppedError extends DomainError {
  constructor() {
    super(
      DOMAIN_ERROR_CODES.ENGINE_STOPPED,
      'Resilience engine is stopped',
    );
    this.name = 'EngineStoppedError';
  }
}

/**
 * @param {unknown} value
 * @returns {value is DomainError}
 */
export function isDomainError(value) {
  return value instanceof DomainError;
}