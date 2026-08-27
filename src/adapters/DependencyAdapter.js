import {
  DEPENDENCY_IDS,
  HEALTH_STATES,
  RESPONSE_CONDITIONS,
} from '../domain/constants.js';
import {
  UnsupportedConditionError,
  UnsupportedDependencyError,
} from '../domain/errors.js';
import { isDependencyId, isHealthStatus } from '../domain/model.js';

export const DEPENDENCY_RESPONSE_PROFILES = Object.freeze({
  [RESPONSE_CONDITIONS.NORMAL]: Object.freeze({
    status: HEALTH_STATES.HEALTHY,
    latencyMs: 120,
    payloadValid: true,
  }),
  [RESPONSE_CONDITIONS.DEGRADED]: Object.freeze({
    status: HEALTH_STATES.DEGRADED,
    latencyMs: 800,
    payloadValid: true,
  }),
  [RESPONSE_CONDITIONS.TIMEOUT]: Object.freeze({
    status: HEALTH_STATES.TIMEOUT,
    latencyMs: 1_200,
    payloadValid: false,
  }),
  [RESPONSE_CONDITIONS.INVALID_PAYLOAD]: Object.freeze({
    status: HEALTH_STATES.INVALID_PAYLOAD,
    latencyMs: 120,
    payloadValid: false,
  }),
  [RESPONSE_CONDITIONS.FAILURE]: Object.freeze({
    status: HEALTH_STATES.FAILED,
    latencyMs: 0,
    payloadValid: false,
  }),
});

const HEALTH_RESPONSE_PROFILES = Object.freeze({
  [HEALTH_STATES.HEALTHY]:
    DEPENDENCY_RESPONSE_PROFILES[RESPONSE_CONDITIONS.NORMAL],
  [HEALTH_STATES.DEGRADED]:
    DEPENDENCY_RESPONSE_PROFILES[RESPONSE_CONDITIONS.DEGRADED],
  [HEALTH_STATES.TIMEOUT]:
    DEPENDENCY_RESPONSE_PROFILES[RESPONSE_CONDITIONS.TIMEOUT],
  [HEALTH_STATES.INVALID_PAYLOAD]:
    DEPENDENCY_RESPONSE_PROFILES[RESPONSE_CONDITIONS.INVALID_PAYLOAD],
  [HEALTH_STATES.FAILED]:
    DEPENDENCY_RESPONSE_PROFILES[RESPONSE_CONDITIONS.FAILURE],
});

/**
 * Resolves a supported response condition or direct health override to an
 * immutable local result.
 *
 * @param {unknown} condition
 * @returns {Readonly<{
 *   status: string,
 *   latencyMs: number,
 *   payloadValid: boolean
 * }>}
 */
function resolveResponse(condition) {
  if (
    typeof condition === 'string' &&
    Object.prototype.hasOwnProperty.call(
      DEPENDENCY_RESPONSE_PROFILES,
      condition,
    )
  ) {
    return DEPENDENCY_RESPONSE_PROFILES[condition];
  }

  if (isHealthStatus(condition)) {
    return HEALTH_RESPONSE_PROFILES[condition];
  }

  throw new UnsupportedConditionError();
}

/**
 * Stateless browser-local adapter for one fixed mock dependency.
 */
export class DependencyAdapter {
  /**
   * @param {unknown} dependencyId
   */
  constructor(dependencyId) {
    if (!isDependencyId(dependencyId)) {
      throw new UnsupportedDependencyError();
    }

    this.id = dependencyId;
    this.dependencyId = dependencyId;
    Object.freeze(this);
  }

  /**
   * Performs a deterministic local health check without network or other I/O.
   *
   * @param {unknown} [statusOverride]
   * @returns {Readonly<{
   *   status: string,
   *   latencyMs: number,
   *   payloadValid: boolean
   * }>}
   */
  check(statusOverride = RESPONSE_CONDITIONS.NORMAL) {
    return resolveResponse(statusOverride);
  }

  /**
   * Applies a supported local response condition without mutating the adapter.
   *
   * @param {unknown} [condition]
   * @returns {Readonly<{
   *   status: string,
   *   latencyMs: number,
   *   payloadValid: boolean
   * }>}
   */
  simulateHealth(condition = RESPONSE_CONDITIONS.NORMAL) {
    return this.check(condition);
  }
}

/**
 * Creates a validated stateless adapter for a fixed mock dependency.
 *
 * @param {unknown} dependencyId
 * @returns {DependencyAdapter}
 */
export function createDependencyAdapter(dependencyId) {
  return new DependencyAdapter(dependencyId);
}

export const PROFILE_PRIMARY_ADAPTER = createDependencyAdapter(
  DEPENDENCY_IDS.PROFILE_PRIMARY,
);

export const PROFILE_SECONDARY_ADAPTER = createDependencyAdapter(
  DEPENDENCY_IDS.PROFILE_SECONDARY,
);

export const CONTEXT_ELIGIBILITY_ADAPTER = createDependencyAdapter(
  DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
);

export const DEPENDENCY_ADAPTERS = Object.freeze([
  PROFILE_PRIMARY_ADAPTER,
  PROFILE_SECONDARY_ADAPTER,
  CONTEXT_ELIGIBILITY_ADAPTER,
]);

export const DEPENDENCY_ADAPTERS_BY_ID = Object.freeze({
  [DEPENDENCY_IDS.PROFILE_PRIMARY]: PROFILE_PRIMARY_ADAPTER,
  [DEPENDENCY_IDS.PROFILE_SECONDARY]: PROFILE_SECONDARY_ADAPTER,
  [DEPENDENCY_IDS.CONTEXT_ELIGIBILITY]: CONTEXT_ELIGIBILITY_ADAPTER,
});

/**
 * Creates a fresh immutable collection containing exactly the three fixed
 * browser-local dependency adapters.
 *
 * @returns {ReadonlyArray<DependencyAdapter>}
 */
export function createDependencyAdapters() {
  return Object.freeze([
    createDependencyAdapter(DEPENDENCY_IDS.PROFILE_PRIMARY),
    createDependencyAdapter(DEPENDENCY_IDS.PROFILE_SECONDARY),
    createDependencyAdapter(DEPENDENCY_IDS.CONTEXT_ELIGIBILITY),
  ]);
}

/**
 * Returns the adapter for one fixed dependency.
 *
 * @param {unknown} dependencyId
 * @returns {DependencyAdapter}
 */
export function getDependencyAdapter(dependencyId) {
  if (!isDependencyId(dependencyId)) {
    throw new UnsupportedDependencyError();
  }

  return DEPENDENCY_ADAPTERS_BY_ID[dependencyId];
}

/**
 * Runs a deterministic local health simulation for a fixed dependency.
 *
 * @param {unknown} input
 * @param {unknown} [condition]
 * @returns {Readonly<{
 *   status: string,
 *   latencyMs: number,
 *   payloadValid: boolean
 * }>}
 */
export function simulateHealth(input, condition) {
  if (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input)
  ) {
    const selectedCondition =
      input.condition ?? input.status ?? RESPONSE_CONDITIONS.NORMAL;

    return getDependencyAdapter(input.dependencyId).simulateHealth(
      selectedCondition,
    );
  }

  return getDependencyAdapter(input).simulateHealth(
    condition ?? RESPONSE_CONDITIONS.NORMAL,
  );
}

export default DependencyAdapter;