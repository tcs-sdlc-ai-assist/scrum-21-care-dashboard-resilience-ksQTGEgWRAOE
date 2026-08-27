import {
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_PROBE_DELAY_MS,
  CIRCUIT_STATES,
  DEPENDENCY_IDS,
  HEALTH_STATES,
  PROFILE_SOURCES,
} from './constants.js';
import { StaleTransitionError } from './errors.js';
import {
  createDependencyState,
  createSnapshot,
  createTransitionInput,
} from './model.js';

const FAILURE_STATUSES = Object.freeze([
  HEALTH_STATES.TIMEOUT,
  HEALTH_STATES.INVALID_PAYLOAD,
  HEALTH_STATES.FAILED,
]);

const STATUS_LATENCIES = Object.freeze({
  [HEALTH_STATES.HEALTHY]: 120,
  [HEALTH_STATES.DEGRADED]: 800,
  [HEALTH_STATES.TIMEOUT]: 1_200,
  [HEALTH_STATES.INVALID_PAYLOAD]: 120,
  [HEALTH_STATES.FAILED]: 0,
});

/**
 * @param {number} timestamp
 * @param {number} delay
 * @returns {number}
 */
function addDelay(timestamp, delay) {
  const result = timestamp + delay;

  if (!Number.isSafeInteger(result)) {
    throw new RangeError('probe due timestamp exceeds the safe integer range');
  }

  return result;
}

/**
 * @param {unknown} status
 * @returns {boolean}
 */
export function isFailureStatus(status) {
  return FAILURE_STATUSES.includes(status);
}

/**
 * @param {ReturnType<typeof createDependencyState>} dependency
 * @returns {boolean}
 */
export function isDependencyUsable(dependency) {
  return (
    dependency.status === HEALTH_STATES.HEALTHY &&
    dependency.circuit === CIRCUIT_STATES.CLOSED
  );
}

/**
 * Resolves profile routing using primary, secondary, fallback, then
 * unavailable precedence.
 *
 * @param {ReadonlyArray<ReturnType<typeof createDependencyState>>} dependencies
 * @param {ReturnType<import('./model.js').createFallbackState>|null} fallback
 * @param {number} now
 * @returns {'PRIMARY'|'SECONDARY'|'FALLBACK'|'NONE'}
 */
export function selectProfileSource(dependencies, fallback, now) {
  if (!Array.isArray(dependencies)) {
    throw new TypeError('dependencies must be an array');
  }

  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError('now must be a non-negative safe integer');
  }

  const primary = dependencies.find(
    (dependency) =>
      dependency.dependencyId === DEPENDENCY_IDS.PROFILE_PRIMARY,
  );
  const secondary = dependencies.find(
    (dependency) =>
      dependency.dependencyId === DEPENDENCY_IDS.PROFILE_SECONDARY,
  );

  if (primary === undefined || secondary === undefined) {
    throw new TypeError(
      'dependencies must contain the primary and secondary profile dependencies',
    );
  }

  if (isDependencyUsable(primary)) {
    return PROFILE_SOURCES.PRIMARY;
  }

  if (isDependencyUsable(secondary)) {
    return PROFILE_SOURCES.SECONDARY;
  }

  if (fallback !== null && fallback !== undefined && now < fallback.expiresAt) {
    return PROFILE_SOURCES.FALLBACK;
  }

  return PROFILE_SOURCES.NONE;
}

/**
 * @param {ReturnType<typeof createDependencyState>} dependency
 * @param {ReturnType<typeof createTransitionInput>} input
 * @returns {{
 *   circuit: 'CLOSED'|'OPEN'|'HALF_OPEN',
 *   probeDueAt: number|null
 * }}
 */
function resolveCircuitTransition(dependency, input) {
  const failed = isFailureStatus(input.status);
  const isPrimary =
    dependency.dependencyId === DEPENDENCY_IDS.PROFILE_PRIMARY;

  if (dependency.circuit === CIRCUIT_STATES.OPEN) {
    if (input.status === HEALTH_STATES.HEALTHY && input.probe) {
      return {
        circuit: CIRCUIT_STATES.HALF_OPEN,
        probeDueAt: null,
      };
    }

    return {
      circuit: CIRCUIT_STATES.OPEN,
      probeDueAt: dependency.probeDueAt,
    };
  }

  if (dependency.circuit === CIRCUIT_STATES.HALF_OPEN) {
    if (failed) {
      return {
        circuit: CIRCUIT_STATES.OPEN,
        probeDueAt: addDelay(input.now, CIRCUIT_PROBE_DELAY_MS),
      };
    }

    if (input.status === HEALTH_STATES.HEALTHY) {
      return {
        circuit: CIRCUIT_STATES.CLOSED,
        probeDueAt: null,
      };
    }

    return {
      circuit: CIRCUIT_STATES.HALF_OPEN,
      probeDueAt: null,
    };
  }

  const consecutiveFailureCount = failed
    ? dependency.consecutiveFailureCount + 1
    : 0;

  if (
    isPrimary &&
    consecutiveFailureCount >= CIRCUIT_FAILURE_THRESHOLD
  ) {
    return {
      circuit: CIRCUIT_STATES.OPEN,
      probeDueAt: addDelay(input.now, CIRCUIT_PROBE_DELAY_MS),
    };
  }

  return {
    circuit: CIRCUIT_STATES.CLOSED,
    probeDueAt: null,
  };
}

/**
 * Applies one health result to a dependency without mutating either input.
 *
 * @param {unknown} dependency
 * @param {unknown} transitionInput
 * @returns {ReturnType<typeof createDependencyState>}
 */
export function transitionDependency(dependency, transitionInput) {
  const currentDependency = createDependencyState(dependency);
  const input = createTransitionInput(transitionInput);

  if (
    currentDependency.dependencyId !== input.dependencyId ||
    input.now < currentDependency.lastCheckedAt
  ) {
    throw new StaleTransitionError();
  }

  const failed = isFailureStatus(input.status);
  const circuitTransition = resolveCircuitTransition(
    currentDependency,
    input,
  );

  return createDependencyState({
    dependencyId: currentDependency.dependencyId,
    status: input.status,
    latencyMs: STATUS_LATENCIES[input.status],
    failureCount:
      currentDependency.failureCount + (failed ? 1 : 0),
    circuit: circuitTransition.circuit,
    lastCheckedAt: input.now,
    consecutiveFailureCount: failed
      ? currentDependency.consecutiveFailureCount + 1
      : 0,
    probeDueAt: circuitTransition.probeDueAt,
  });
}

export const reduceDependencyTransition = transitionDependency;

/**
 * Applies one validated dependency transition to an immutable resilience
 * snapshot. Duplicate or chronologically stale actions are rejected.
 *
 * @param {unknown} state
 * @param {unknown} transitionInput
 * @returns {ReturnType<typeof createSnapshot>}
 */
export function transition(state, transitionInput) {
  const snapshot = createSnapshot(state);
  const input = createTransitionInput(transitionInput);

  if (
    snapshot.lastEventId === input.eventId ||
    input.now < snapshot.now
  ) {
    throw new StaleTransitionError();
  }

  const dependencyIndex = snapshot.dependencies.findIndex(
    (dependency) => dependency.dependencyId === input.dependencyId,
  );

  if (dependencyIndex < 0) {
    throw new StaleTransitionError();
  }

  const dependencies = [...snapshot.dependencies];
  dependencies[dependencyIndex] = transitionDependency(
    dependencies[dependencyIndex],
    input,
  );

  const affectsProfileRouting =
    input.dependencyId === DEPENDENCY_IDS.PROFILE_PRIMARY ||
    input.dependencyId === DEPENDENCY_IDS.PROFILE_SECONDARY;

  const profileSource = affectsProfileRouting
    ? selectProfileSource(dependencies, snapshot.fallback, input.now)
    : snapshot.profileSource;

  return createSnapshot({
    ...snapshot,
    now: input.now,
    dependencies,
    profileSource,
    lastEventId: input.eventId,
  });
}

export const reduceTransition = transition;
export const applyTransition = transition;

/**
 * Applies the ordered OPEN -> HALF_OPEN -> CLOSED recovery sequence.
 *
 * @param {unknown} state
 * @param {unknown} input
 * @returns {Readonly<{
 *   halfOpenSnapshot: ReturnType<typeof createSnapshot>,
 *   snapshot: ReturnType<typeof createSnapshot>
 * }>}
 */
export function applyOrderedRecovery(state, input) {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new TypeError('recovery input must be an object');
  }

  const halfOpenSnapshot = transition(state, {
    eventId: input.halfOpenEventId,
    dependencyId: input.dependencyId,
    status: HEALTH_STATES.HEALTHY,
    now: input.now,
    profileId: input.profileId,
    probe: true,
  });

  const recoveredDependency = halfOpenSnapshot.dependencies.find(
    (dependency) => dependency.dependencyId === input.dependencyId,
  );

  if (
    recoveredDependency === undefined ||
    recoveredDependency.circuit !== CIRCUIT_STATES.HALF_OPEN
  ) {
    throw new StaleTransitionError();
  }

  const snapshot = transition(halfOpenSnapshot, {
    eventId: input.closedEventId,
    dependencyId: input.dependencyId,
    status: HEALTH_STATES.HEALTHY,
    now: input.now,
    profileId: input.profileId,
    probe: true,
  });

  return Object.freeze({
    halfOpenSnapshot,
    snapshot,
  });
}

export const transitionRecovery = applyOrderedRecovery;

export default transition;