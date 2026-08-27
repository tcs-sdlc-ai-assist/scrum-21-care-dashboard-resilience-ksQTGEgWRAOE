import {
  DEPENDENCY_IDS,
  HEALTH_STATES,
} from '../domain/constants.js';
import {
  isBoundedId,
  isDependencyId,
  isProfileId,
  isSnapshot,
} from '../domain/model.js';

export const LIFECYCLE_COMMAND_TYPES = Object.freeze({
  SIMULATE_HEALTH: 'SIMULATE_HEALTH',
  SIMULATE_RECOVERY: 'SIMULATE_RECOVERY',
  REQUEST_PROFILE: 'REQUEST_PROFILE',
  ACKNOWLEDGE_ALERT: 'ACKNOWLEDGE_ALERT',
  RESET_DEMO: 'RESET_DEMO',
});

export const LIFECYCLE_HEALTH_OUTCOMES = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  TIMEOUT: 'timeout',
  INVALID_PAYLOAD: 'invalid-payload',
  FAILED: 'failed',
});

export const SUPPORTED_LIFECYCLE_COMMAND_TYPES = Object.freeze(
  Object.values(LIFECYCLE_COMMAND_TYPES),
);

export const SUPPORTED_LIFECYCLE_HEALTH_OUTCOMES = Object.freeze(
  Object.values(LIFECYCLE_HEALTH_OUTCOMES),
);

const HEALTH_STATUS_BY_OUTCOME = Object.freeze({
  [LIFECYCLE_HEALTH_OUTCOMES.HEALTHY]: HEALTH_STATES.HEALTHY,
  [LIFECYCLE_HEALTH_OUTCOMES.DEGRADED]: HEALTH_STATES.DEGRADED,
  [LIFECYCLE_HEALTH_OUTCOMES.TIMEOUT]: HEALTH_STATES.TIMEOUT,
  [LIFECYCLE_HEALTH_OUTCOMES.INVALID_PAYLOAD]:
    HEALTH_STATES.INVALID_PAYLOAD,
  [LIFECYCLE_HEALTH_OUTCOMES.FAILED]: HEALTH_STATES.FAILED,
});

const COMMAND_FIELDS = Object.freeze({
  [LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH]: Object.freeze([
    'type',
    'dependencyId',
    'outcome',
  ]),
  [LIFECYCLE_COMMAND_TYPES.SIMULATE_RECOVERY]: Object.freeze([
    'type',
    'dependencyId',
    'profileId',
  ]),
  [LIFECYCLE_COMMAND_TYPES.REQUEST_PROFILE]: Object.freeze([
    'type',
    'profileId',
  ]),
  [LIFECYCLE_COMMAND_TYPES.ACKNOWLEDGE_ALERT]: Object.freeze([
    'type',
    'alertId',
  ]),
  [LIFECYCLE_COMMAND_TYPES.RESET_DEMO]: Object.freeze(['type']),
});

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
 * @param {string} field
 * @param {string} message
 * @returns {TypeError}
 */
function createContractError(field, message) {
  const error = new TypeError(message);
  error.field = field;
  return error;
}

/**
 * @param {Record<string, unknown>} command
 * @param {ReadonlyArray<string>} permittedFields
 * @returns {void}
 */
function requireExactFields(command, permittedFields) {
  const keys = Object.keys(command);

  if (
    keys.length !== permittedFields.length ||
    !keys.every((key) => permittedFields.includes(key))
  ) {
    throw createContractError(
      'command',
      'command contains missing or unsupported fields',
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireDependencyId(value, field = 'dependencyId') {
  if (!isDependencyId(value)) {
    throw createContractError(
      field,
      'dependencyId must be a supported mock dependency',
    );
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
    throw createContractError(field, `${field} must match MOCK-####`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireHealthOutcome(value) {
  if (!SUPPORTED_LIFECYCLE_HEALTH_OUTCOMES.includes(value)) {
    throw createContractError(
      'outcome',
      'outcome must be a supported mock response outcome',
    );
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireAlertId(value) {
  if (!isBoundedId(value)) {
    throw createContractError(
      'alertId',
      'alertId must be a bounded privacy-safe identifier',
    );
  }

  return value;
}

/**
 * Creates an immutable, validated lifecycle command. Command fields are
 * allowlisted so credentials, profiles, and diagnostic payloads cannot cross
 * this UI boundary accidentally.
 *
 * @param {unknown} input
 * @returns {Readonly<Record<string, string>>}
 */
export function createLifecycleCommand(input) {
  if (!isPlainObject(input)) {
    throw createContractError('command', 'command must be an object');
  }

  if (!SUPPORTED_LIFECYCLE_COMMAND_TYPES.includes(input.type)) {
    throw createContractError(
      'type',
      'type must be a supported lifecycle command',
    );
  }

  const permittedFields = COMMAND_FIELDS[input.type];
  requireExactFields(input, permittedFields);

  switch (input.type) {
    case LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH:
      return Object.freeze({
        type: input.type,
        dependencyId: requireDependencyId(input.dependencyId),
        outcome: requireHealthOutcome(input.outcome),
      });

    case LIFECYCLE_COMMAND_TYPES.SIMULATE_RECOVERY: {
      const dependencyId = requireDependencyId(input.dependencyId);

      if (dependencyId !== DEPENDENCY_IDS.PROFILE_PRIMARY) {
        throw createContractError(
          'dependencyId',
          'recovery is supported only for the primary profile dependency',
        );
      }

      return Object.freeze({
        type: input.type,
        dependencyId,
        profileId: requireProfileId(input.profileId),
      });
    }

    case LIFECYCLE_COMMAND_TYPES.REQUEST_PROFILE:
      return Object.freeze({
        type: input.type,
        profileId: requireProfileId(input.profileId),
      });

    case LIFECYCLE_COMMAND_TYPES.ACKNOWLEDGE_ALERT:
      return Object.freeze({
        type: input.type,
        alertId: requireAlertId(input.alertId),
      });

    case LIFECYCLE_COMMAND_TYPES.RESET_DEMO:
      return Object.freeze({
        type: input.type,
      });

    default:
      throw createContractError(
        'type',
        'type must be a supported lifecycle command',
      );
  }
}

/**
 * Throws when a value is not a supported lifecycle command.
 *
 * @param {unknown} input
 * @returns {Readonly<Record<string, string>>}
 */
export function assertLifecycleCommand(input) {
  return createLifecycleCommand(input);
}

/**
 * @param {unknown} input
 * @returns {boolean}
 */
export function isLifecycleCommand(input) {
  try {
    createLifecycleCommand(input);
    return true;
  } catch {
    return false;
  }
}

export const validateLifecycleCommand = isLifecycleCommand;

/**
 * Maps a public health outcome to the domain health state used by the local
 * resilience engine.
 *
 * @param {unknown} outcome
 * @returns {string}
 */
export function getHealthStatusForOutcome(outcome) {
  const validOutcome = requireHealthOutcome(outcome);
  return HEALTH_STATUS_BY_OUTCOME[validOutcome];
}

/**
 * Verifies the structural lifecycle interface without invoking it.
 *
 * @param {unknown} contract
 * @returns {{
 *   subscribe: Function,
 *   getSnapshot: Function,
 *   dispatch: Function
 * }}
 */
export function assertResilienceLifecycleContract(contract) {
  if (!isPlainObject(contract)) {
    throw new TypeError('lifecycle contract must be an object');
  }

  if (typeof contract.subscribe !== 'function') {
    throw createContractError(
      'subscribe',
      'lifecycle contract must provide subscribe(listener)',
    );
  }

  if (typeof contract.getSnapshot !== 'function') {
    throw createContractError(
      'getSnapshot',
      'lifecycle contract must provide getSnapshot()',
    );
  }

  if (typeof contract.dispatch !== 'function') {
    throw createContractError(
      'dispatch',
      'lifecycle contract must provide dispatch(command)',
    );
  }

  return contract;
}

/**
 * @param {unknown} contract
 * @returns {boolean}
 */
export function isResilienceLifecycleContract(contract) {
  try {
    assertResilienceLifecycleContract(contract);
    return true;
  } catch {
    return false;
  }
}

export const validateResilienceLifecycleContract =
  isResilienceLifecycleContract;

/**
 * Runtime-validating facade for the dashboard-to-engine lifecycle boundary.
 */
export class ResilienceLifecycleContract {
  /**
   * @param {unknown} implementation
   */
  constructor(implementation) {
    this.implementation =
      assertResilienceLifecycleContract(implementation);
    Object.freeze(this);
  }

  /**
   * Subscribes to validated immutable resilience snapshots.
   *
   * @param {(snapshot: object) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw createContractError(
        'listener',
        'listener must be a function',
      );
    }

    const unsubscribe = this.implementation.subscribe((snapshot) => {
      if (!isSnapshot(snapshot)) {
        throw new TypeError(
          'lifecycle subscription emitted an invalid snapshot',
        );
      }

      listener(snapshot);
    });

    if (typeof unsubscribe !== 'function') {
      throw new TypeError(
        'subscribe(listener) must return an unsubscribe function',
      );
    }

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      unsubscribe();
    };
  }

  /**
   * Returns the current validated immutable resilience snapshot.
   *
   * @returns {object}
   */
  getSnapshot() {
    const snapshot = this.implementation.getSnapshot();

    if (!isSnapshot(snapshot)) {
      throw new TypeError(
        'getSnapshot() must return a valid resilience snapshot',
      );
    }

    return snapshot;
  }

  /**
   * Dispatches one validated browser-local lifecycle command.
   *
   * @param {unknown} command
   * @returns {unknown}
   */
  dispatch(command) {
    return this.implementation.dispatch(
      createLifecycleCommand(command),
    );
  }
}

/**
 * Creates a runtime-validating lifecycle facade.
 *
 * @param {unknown} implementation
 * @returns {ResilienceLifecycleContract}
 */
export function createResilienceLifecycleContract(implementation) {
  return new ResilienceLifecycleContract(implementation);
}

export default ResilienceLifecycleContract;