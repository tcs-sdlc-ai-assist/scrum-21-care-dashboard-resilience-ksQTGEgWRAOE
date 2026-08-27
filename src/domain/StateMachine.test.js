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
  applyOrderedRecovery,
  isDependencyUsable,
  isFailureStatus,
  selectProfileSource,
  transition,
  transitionDependency,
} from './StateMachine.js';
import {
  createDependencyState,
  createFallbackState,
  createInitialDependencies,
  createInitialDependencyState,
  createInitialSnapshot,
} from './model.js';
import {
  ACTIVE_PROFILE_ID,
  getProfileFixture,
} from '../fixtures/profiles.js';
import { REFERENCE_TIMESTAMP } from '../utils/clock.js';

const STATUS_EXPECTATIONS = Object.freeze([
  Object.freeze({
    status: HEALTH_STATES.HEALTHY,
    latencyMs: 120,
    failureCount: 0,
    consecutiveFailureCount: 0,
    failed: false,
  }),
  Object.freeze({
    status: HEALTH_STATES.DEGRADED,
    latencyMs: 800,
    failureCount: 0,
    consecutiveFailureCount: 0,
    failed: false,
  }),
  Object.freeze({
    status: HEALTH_STATES.TIMEOUT,
    latencyMs: 1_200,
    failureCount: 1,
    consecutiveFailureCount: 1,
    failed: true,
  }),
  Object.freeze({
    status: HEALTH_STATES.INVALID_PAYLOAD,
    latencyMs: 120,
    failureCount: 1,
    consecutiveFailureCount: 1,
    failed: true,
  }),
  Object.freeze({
    status: HEALTH_STATES.FAILED,
    latencyMs: 0,
    failureCount: 1,
    consecutiveFailureCount: 1,
    failed: true,
  }),
]);

/**
 * @param {object} state
 * @param {string} status
 * @param {number} sequence
 * @param {string} [dependencyId]
 * @param {boolean} [probe]
 * @returns {ReturnType<typeof createInitialSnapshot>}
 */
function applyStatus(
  state,
  status,
  sequence,
  dependencyId = DEPENDENCY_IDS.PROFILE_PRIMARY,
  probe = false,
) {
  return transition(state, {
    eventId: `evt-${sequence}`,
    dependencyId,
    status,
    now: state.now + 1,
    profileId: ACTIVE_PROFILE_ID,
    probe,
  });
}

/**
 * @param {{
 *   primaryStatus?: string,
 *   primaryCircuit?: string,
 *   secondaryStatus?: string,
 *   secondaryCircuit?: string
 * }} [overrides]
 * @returns {ReadonlyArray<ReturnType<typeof createDependencyState>>}
 */
function createRoutingDependencies(overrides = {}) {
  const {
    primaryStatus = HEALTH_STATES.HEALTHY,
    primaryCircuit = CIRCUIT_STATES.CLOSED,
    secondaryStatus = HEALTH_STATES.HEALTHY,
    secondaryCircuit = CIRCUIT_STATES.CLOSED,
  } = overrides;

  return Object.freeze(
    createInitialDependencies(REFERENCE_TIMESTAMP).map((dependency) => {
      if (
        dependency.dependencyId ===
        DEPENDENCY_IDS.PROFILE_PRIMARY
      ) {
        return createDependencyState({
          ...dependency,
          status: primaryStatus,
          circuit: primaryCircuit,
        });
      }

      if (
        dependency.dependencyId ===
        DEPENDENCY_IDS.PROFILE_SECONDARY
      ) {
        return createDependencyState({
          ...dependency,
          status: secondaryStatus,
          circuit: secondaryCircuit,
        });
      }

      return dependency;
    }),
  );
}

/**
 * @param {number} now
 * @param {number} expiresAt
 * @returns {ReturnType<typeof createFallbackState>}
 */
function createFallback(now, expiresAt) {
  const profile = getProfileFixture(
    ACTIVE_PROFILE_ID,
    PROFILE_SOURCES.FALLBACK,
    now,
  );

  if (profile === null) {
    throw new Error('Expected the active synthetic profile fixture');
  }

  return createFallbackState({
    id: 'fallback-state-machine-test',
    profileId: ACTIVE_PROFILE_ID,
    data: profile,
    createdAt: now,
    expiresAt,
    timerRevision: 1,
  });
}

describe('StateMachine', () => {
  describe('dependency health transitions', () => {
    it.each(STATUS_EXPECTATIONS)(
      'applies the $status response with deterministic latency and failure accounting',
      ({
        status,
        latencyMs,
        failureCount,
        consecutiveFailureCount,
        failed,
      }) => {
        const initialDependency = createInitialDependencyState(
          DEPENDENCY_IDS.PROFILE_PRIMARY,
          REFERENCE_TIMESTAMP,
        );

        const result = transitionDependency(initialDependency, {
          eventId: `evt-${status.toLowerCase()}`,
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status,
          now: REFERENCE_TIMESTAMP + 1,
          profileId: ACTIVE_PROFILE_ID,
          probe: false,
        });

        expect(result).toEqual({
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status,
          latencyMs,
          failureCount,
          circuit: CIRCUIT_STATES.CLOSED,
          lastCheckedAt: REFERENCE_TIMESTAMP + 1,
          consecutiveFailureCount,
          probeDueAt: null,
        });
        expect(isFailureStatus(status)).toBe(failed);
        expect(Object.isFrozen(result)).toBe(true);
        expect(initialDependency).toEqual({
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status: HEALTH_STATES.HEALTHY,
          latencyMs: 0,
          failureCount: 0,
          circuit: CIRCUIT_STATES.CLOSED,
          lastCheckedAt: REFERENCE_TIMESTAMP,
          consecutiveFailureCount: 0,
          probeDueAt: null,
        });
      },
    );

    it('counts consecutive primary failures and opens the circuit on the third failure', () => {
      const initialState = createInitialSnapshot(REFERENCE_TIMESTAMP);
      const firstFailure = applyStatus(
        initialState,
        HEALTH_STATES.TIMEOUT,
        1,
      );
      const secondFailure = applyStatus(
        firstFailure,
        HEALTH_STATES.INVALID_PAYLOAD,
        2,
      );
      const thirdFailure = applyStatus(
        secondFailure,
        HEALTH_STATES.FAILED,
        3,
      );

      const firstPrimary = firstFailure.dependencies[0];
      const secondPrimary = secondFailure.dependencies[0];
      const thirdPrimary = thirdFailure.dependencies[0];

      expect(CIRCUIT_FAILURE_THRESHOLD).toBe(3);
      expect(firstPrimary.consecutiveFailureCount).toBe(1);
      expect(firstPrimary.failureCount).toBe(1);
      expect(firstPrimary.circuit).toBe(CIRCUIT_STATES.CLOSED);

      expect(secondPrimary.consecutiveFailureCount).toBe(2);
      expect(secondPrimary.failureCount).toBe(2);
      expect(secondPrimary.circuit).toBe(CIRCUIT_STATES.CLOSED);

      expect(thirdPrimary.consecutiveFailureCount).toBe(3);
      expect(thirdPrimary.failureCount).toBe(3);
      expect(thirdPrimary.circuit).toBe(CIRCUIT_STATES.OPEN);
      expect(thirdPrimary.probeDueAt).toBe(
        thirdFailure.now + CIRCUIT_PROBE_DELAY_MS,
      );
      expect(thirdFailure.profileSource).toBe(
        PROFILE_SOURCES.SECONDARY,
      );
      expect(initialState.dependencies[0].failureCount).toBe(0);
    });

    it('resets the consecutive count after a non-failure while retaining the cumulative failure count', () => {
      const initialState = createInitialSnapshot(REFERENCE_TIMESTAMP);
      const firstFailure = applyStatus(
        initialState,
        HEALTH_STATES.FAILED,
        1,
      );
      const degraded = applyStatus(
        firstFailure,
        HEALTH_STATES.DEGRADED,
        2,
      );
      const nextFailure = applyStatus(
        degraded,
        HEALTH_STATES.TIMEOUT,
        3,
      );

      const degradedPrimary = degraded.dependencies[0];
      const failedPrimary = nextFailure.dependencies[0];

      expect(degradedPrimary.failureCount).toBe(1);
      expect(degradedPrimary.consecutiveFailureCount).toBe(0);
      expect(degradedPrimary.circuit).toBe(CIRCUIT_STATES.CLOSED);
      expect(failedPrimary.failureCount).toBe(2);
      expect(failedPrimary.consecutiveFailureCount).toBe(1);
      expect(failedPrimary.circuit).toBe(CIRCUIT_STATES.CLOSED);
    });

    it('does not open the secondary dependency circuit after three failures', () => {
      const initialState = createInitialSnapshot(REFERENCE_TIMESTAMP);
      const firstFailure = applyStatus(
        initialState,
        HEALTH_STATES.FAILED,
        1,
        DEPENDENCY_IDS.PROFILE_SECONDARY,
      );
      const secondFailure = applyStatus(
        firstFailure,
        HEALTH_STATES.TIMEOUT,
        2,
        DEPENDENCY_IDS.PROFILE_SECONDARY,
      );
      const thirdFailure = applyStatus(
        secondFailure,
        HEALTH_STATES.INVALID_PAYLOAD,
        3,
        DEPENDENCY_IDS.PROFILE_SECONDARY,
      );
      const secondary = thirdFailure.dependencies.find(
        (dependency) =>
          dependency.dependencyId ===
          DEPENDENCY_IDS.PROFILE_SECONDARY,
      );

      expect(secondary).toMatchObject({
        failureCount: 3,
        consecutiveFailureCount: 3,
        circuit: CIRCUIT_STATES.CLOSED,
        probeDueAt: null,
      });
      expect(thirdFailure.profileSource).toBe(
        PROFILE_SOURCES.PRIMARY,
      );
    });

    it('keeps an open primary circuit open until a successful probe is applied', () => {
      let state = createInitialSnapshot(REFERENCE_TIMESTAMP);

      for (
        let sequence = 1;
        sequence <= CIRCUIT_FAILURE_THRESHOLD;
        sequence += 1
      ) {
        state = applyStatus(
          state,
          HEALTH_STATES.FAILED,
          sequence,
        );
      }

      const healthyWithoutProbe = applyStatus(
        state,
        HEALTH_STATES.HEALTHY,
        4,
      );
      const primary = healthyWithoutProbe.dependencies[0];

      expect(primary.status).toBe(HEALTH_STATES.HEALTHY);
      expect(primary.consecutiveFailureCount).toBe(0);
      expect(primary.circuit).toBe(CIRCUIT_STATES.OPEN);
      expect(primary.probeDueAt).toBe(
        state.dependencies[0].probeDueAt,
      );
      expect(isDependencyUsable(primary)).toBe(false);
      expect(healthyWithoutProbe.profileSource).toBe(
        PROFILE_SOURCES.SECONDARY,
      );
    });
  });

  describe('deterministic profile source routing', () => {
    it('selects primary before secondary and fallback when primary is usable', () => {
      const now = REFERENCE_TIMESTAMP;
      const dependencies = createRoutingDependencies();
      const fallback = createFallback(now, now + 1_000);

      expect(
        selectProfileSource(dependencies, fallback, now),
      ).toBe(PROFILE_SOURCES.PRIMARY);
      expect(isDependencyUsable(dependencies[0])).toBe(true);
    });

    it('selects secondary when primary is unhealthy or its circuit is open', () => {
      const unhealthyPrimary = createRoutingDependencies({
        primaryStatus: HEALTH_STATES.FAILED,
      });
      const openPrimary = createRoutingDependencies({
        primaryStatus: HEALTH_STATES.HEALTHY,
        primaryCircuit: CIRCUIT_STATES.OPEN,
      });

      expect(
        selectProfileSource(
          unhealthyPrimary,
          null,
          REFERENCE_TIMESTAMP,
        ),
      ).toBe(PROFILE_SOURCES.SECONDARY);
      expect(
        selectProfileSource(
          openPrimary,
          null,
          REFERENCE_TIMESTAMP,
        ),
      ).toBe(PROFILE_SOURCES.SECONDARY);
    });

    it('selects an unexpired fallback only after both profile dependencies are unusable', () => {
      const now = REFERENCE_TIMESTAMP;
      const dependencies = createRoutingDependencies({
        primaryStatus: HEALTH_STATES.FAILED,
        primaryCircuit: CIRCUIT_STATES.OPEN,
        secondaryStatus: HEALTH_STATES.FAILED,
      });
      const fallback = createFallback(now, now + 1_000);

      expect(
        selectProfileSource(dependencies, fallback, now + 999),
      ).toBe(PROFILE_SOURCES.FALLBACK);
    });

    it('returns unavailable when both profile dependencies are unusable and no valid fallback exists', () => {
      const now = REFERENCE_TIMESTAMP;
      const dependencies = createRoutingDependencies({
        primaryStatus: HEALTH_STATES.FAILED,
        primaryCircuit: CIRCUIT_STATES.OPEN,
        secondaryStatus: HEALTH_STATES.TIMEOUT,
      });
      const fallback = createFallback(now, now + 1_000);

      expect(
        selectProfileSource(dependencies, null, now),
      ).toBe(PROFILE_SOURCES.NONE);
      expect(
        selectProfileSource(dependencies, fallback, now + 1_000),
      ).toBe(PROFILE_SOURCES.NONE);
    });

    it('rejects routing input that omits a required profile dependency', () => {
      const dependencies = createInitialDependencies(
        REFERENCE_TIMESTAMP,
      ).filter(
        (dependency) =>
          dependency.dependencyId !==
          DEPENDENCY_IDS.PROFILE_SECONDARY,
      );

      expect(() =>
        selectProfileSource(
          dependencies,
          null,
          REFERENCE_TIMESTAMP,
        ),
      ).toThrow(
        'dependencies must contain the primary and secondary profile dependencies',
      );
    });
  });

  describe('stale transition protection', () => {
    it('rejects a duplicate event identifier without changing the current snapshot', () => {
      const initialState = createInitialSnapshot(REFERENCE_TIMESTAMP);
      const currentState = applyStatus(
        initialState,
        HEALTH_STATES.FAILED,
        1,
      );

      expect(() =>
        transition(currentState, {
          eventId: 'evt-1',
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status: HEALTH_STATES.FAILED,
          now: currentState.now + 1,
          profileId: ACTIVE_PROFILE_ID,
          probe: false,
        }),
      ).toThrow(StaleTransitionError);

      expect(currentState.dependencies[0].failureCount).toBe(1);
      expect(currentState.lastEventId).toBe('evt-1');
    });

    it('rejects a chronologically stale snapshot action', () => {
      const initialState = createInitialSnapshot(REFERENCE_TIMESTAMP);
      const currentState = applyStatus(
        initialState,
        HEALTH_STATES.FAILED,
        1,
      );

      expect(() =>
        transition(currentState, {
          eventId: 'evt-stale',
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status: HEALTH_STATES.HEALTHY,
          now: REFERENCE_TIMESTAMP,
          profileId: ACTIVE_PROFILE_ID,
          probe: false,
        }),
      ).toThrow(StaleTransitionError);
    });

    it('rejects a dependency transition older than its last health check', () => {
      const dependency = createInitialDependencyState(
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        REFERENCE_TIMESTAMP + 10,
      );

      expect(() =>
        transitionDependency(dependency, {
          eventId: 'evt-old-check',
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status: HEALTH_STATES.HEALTHY,
          now: REFERENCE_TIMESTAMP + 9,
          profileId: ACTIVE_PROFILE_ID,
          probe: false,
        }),
      ).toThrow(StaleTransitionError);
    });

    it('rejects a transition targeting a different dependency record', () => {
      const dependency = createInitialDependencyState(
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        REFERENCE_TIMESTAMP,
      );

      expect(() =>
        transitionDependency(dependency, {
          eventId: 'evt-wrong-dependency',
          dependencyId: DEPENDENCY_IDS.PROFILE_SECONDARY,
          status: HEALTH_STATES.FAILED,
          now: REFERENCE_TIMESTAMP + 1,
          profileId: ACTIVE_PROFILE_ID,
          probe: false,
        }),
      ).toThrow(StaleTransitionError);
    });
  });

  describe('ordered recovery', () => {
    it('applies the primary OPEN to HALF_OPEN to CLOSED recovery sequence in order', () => {
      let openState = createInitialSnapshot(REFERENCE_TIMESTAMP);

      for (
        let sequence = 1;
        sequence <= CIRCUIT_FAILURE_THRESHOLD;
        sequence += 1
      ) {
        openState = applyStatus(
          openState,
          HEALTH_STATES.FAILED,
          sequence,
        );
      }

      const recoveryTime = openState.now + 1;
      const result = applyOrderedRecovery(openState, {
        halfOpenEventId: 'evt-recovery-half-open',
        closedEventId: 'evt-recovery-closed',
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        profileId: ACTIVE_PROFILE_ID,
        now: recoveryTime,
      });
      const halfOpenPrimary =
        result.halfOpenSnapshot.dependencies[0];
      const recoveredPrimary = result.snapshot.dependencies[0];

      expect(openState.dependencies[0].circuit).toBe(
        CIRCUIT_STATES.OPEN,
      );
      expect(halfOpenPrimary).toMatchObject({
        status: HEALTH_STATES.HEALTHY,
        circuit: CIRCUIT_STATES.HALF_OPEN,
        consecutiveFailureCount: 0,
        probeDueAt: null,
      });
      expect(result.halfOpenSnapshot.lastEventId).toBe(
        'evt-recovery-half-open',
      );
      expect(result.halfOpenSnapshot.profileSource).toBe(
        PROFILE_SOURCES.SECONDARY,
      );

      expect(recoveredPrimary).toMatchObject({
        status: HEALTH_STATES.HEALTHY,
        circuit: CIRCUIT_STATES.CLOSED,
        consecutiveFailureCount: 0,
        probeDueAt: null,
      });
      expect(recoveredPrimary.failureCount).toBe(
        CIRCUIT_FAILURE_THRESHOLD,
      );
      expect(result.snapshot.lastEventId).toBe(
        'evt-recovery-closed',
      );
      expect(result.snapshot.profileSource).toBe(
        PROFILE_SOURCES.PRIMARY,
      );
      expect(isDependencyUsable(recoveredPrimary)).toBe(true);
    });

    it('reopens a half-open circuit when its next probe fails', () => {
      let openState = createInitialSnapshot(REFERENCE_TIMESTAMP);

      for (
        let sequence = 1;
        sequence <= CIRCUIT_FAILURE_THRESHOLD;
        sequence += 1
      ) {
        openState = applyStatus(
          openState,
          HEALTH_STATES.FAILED,
          sequence,
        );
      }

      const halfOpenState = applyStatus(
        openState,
        HEALTH_STATES.HEALTHY,
        4,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        true,
      );
      const failedProbeState = applyStatus(
        halfOpenState,
        HEALTH_STATES.TIMEOUT,
        5,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        true,
      );
      const primary = failedProbeState.dependencies[0];

      expect(halfOpenState.dependencies[0].circuit).toBe(
        CIRCUIT_STATES.HALF_OPEN,
      );
      expect(primary.circuit).toBe(CIRCUIT_STATES.OPEN);
      expect(primary.consecutiveFailureCount).toBe(1);
      expect(primary.failureCount).toBe(
        CIRCUIT_FAILURE_THRESHOLD + 1,
      );
      expect(primary.probeDueAt).toBe(
        failedProbeState.now + CIRCUIT_PROBE_DELAY_MS,
      );
    });

    it('rejects ordered recovery when the primary circuit is not open', () => {
      const initialState = createInitialSnapshot(REFERENCE_TIMESTAMP);

      expect(() =>
        applyOrderedRecovery(initialState, {
          halfOpenEventId: 'evt-invalid-half-open',
          closedEventId: 'evt-invalid-closed',
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          profileId: ACTIVE_PROFILE_ID,
          now: REFERENCE_TIMESTAMP + 1,
        }),
      ).toThrow(StaleTransitionError);
    });
  });
});