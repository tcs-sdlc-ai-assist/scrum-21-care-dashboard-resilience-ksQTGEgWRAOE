import {
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_STATES,
  DEPENDENCY_IDS,
  FALLBACK_TTL_MS,
  HEALTH_STATES,
  MAX_RECORDS,
  POLL_INTERVAL_MS,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import {
  ALERT_CHANNELS,
  INCIDENT_TYPES,
} from '../domain/model.js';
import { ACTIVE_PROFILE_ID } from '../fixtures/profiles.js';
import {
  FakeClock,
  REFERENCE_TIMESTAMP,
} from '../utils/clock.js';
import {
  ResilienceEngine,
  createResilienceEngine,
} from './ResilienceEngine.js';

/**
 * @param {ResilienceEngine} engine
 * @param {string} dependencyId
 * @param {string} status
 * @returns {object}
 */
function applyHealth(engine, dependencyId, status) {
  const result = engine.simulateHealth({
    dependencyId,
    status,
    profileId: ACTIVE_PROFILE_ID,
  });

  if (!result.ok) {
    throw new Error(
      `Expected health simulation to succeed: ${result.error.code}`,
    );
  }

  return result;
}

/**
 * Opens the primary circuit, makes the secondary profile dependency
 * unavailable, and requests the fixed synthetic fallback.
 *
 * @param {ResilienceEngine} engine
 * @returns {object}
 */
function activateFallback(engine) {
  for (
    let attempt = 0;
    attempt < CIRCUIT_FAILURE_THRESHOLD;
    attempt += 1
  ) {
    applyHealth(
      engine,
      DEPENDENCY_IDS.PROFILE_PRIMARY,
      HEALTH_STATES.FAILED,
    );
  }

  applyHealth(
    engine,
    DEPENDENCY_IDS.PROFILE_SECONDARY,
    HEALTH_STATES.FAILED,
  );

  const result = engine.requestProfile({
    profileId: ACTIVE_PROFILE_ID,
  });

  if (!result.ok) {
    throw new Error(
      `Expected fallback activation to succeed: ${result.error.code}`,
    );
  }

  return result;
}

describe('ResilienceEngine', () => {
  describe('lifecycle and subscription contract', () => {
    it('creates an immutable baseline snapshot and immediately supplies it to subscribers', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const listener = vi.fn();

      const snapshot = engine.getSnapshot();
      const unsubscribe = engine.subscribe(listener);

      expect(engine).toBeInstanceOf(ResilienceEngine);
      expect(snapshot).toMatchObject({
        version: 1,
        referenceDate: '2026-08-27',
        now: REFERENCE_TIMESTAMP,
        profileSource: PROFILE_SOURCES.NONE,
        fallback: null,
        alerts: [],
        incidents: [],
        telemetry: [],
        lastEventId: null,
      });
      expect(snapshot.dependencies).toHaveLength(3);
      expect(snapshot.dependencies.map(
        (dependency) => dependency.dependencyId,
      )).toEqual([
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        DEPENDENCY_IDS.PROFILE_SECONDARY,
        DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
      ]);
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.dependencies)).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(snapshot);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      unsubscribe();

      expect(clock.pendingTimerCount()).toBe(0);
    });

    it('owns one polling interval across subscribers and stops it after the last subscriber leaves', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const firstListener = vi.fn();
      const secondListener = vi.fn();

      const unsubscribeFirst = engine.subscribe(firstListener);
      const unsubscribeSecond = engine.subscribe(secondListener);

      engine.start();
      engine.start();

      expect(clock.pendingTimerCount()).toBe(1);
      expect(firstListener).toHaveBeenCalledTimes(1);
      expect(secondListener).toHaveBeenCalledTimes(1);

      clock.advance(POLL_INTERVAL_MS);

      const snapshot = engine.getSnapshot();

      expect(snapshot.now).toBe(
        REFERENCE_TIMESTAMP + POLL_INTERVAL_MS,
      );
      expect(snapshot.telemetry).toHaveLength(3);
      expect(snapshot.telemetry.map(
        (sample) => sample.dependencyId,
      )).toEqual([
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        DEPENDENCY_IDS.PROFILE_SECONDARY,
        DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
      ]);
      expect(firstListener).toHaveBeenCalledTimes(2);
      expect(secondListener).toHaveBeenCalledTimes(2);

      unsubscribeFirst();
      expect(clock.pendingTimerCount()).toBe(1);

      unsubscribeSecond();
      expect(clock.pendingTimerCount()).toBe(0);

      clock.advance(POLL_INTERVAL_MS);
      expect(engine.getSnapshot().telemetry).toHaveLength(3);
    });

    it('stops commands and polling until the engine is started again', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      expect(clock.pendingTimerCount()).toBe(1);

      engine.stop();

      expect(clock.pendingTimerCount()).toBe(0);

      const stoppedResult = engine.simulateHealth({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.DEGRADED,
      });

      expect(stoppedResult).toMatchObject({
        ok: false,
        error: {
          code: 'ENGINE_STOPPED',
          message: 'Resilience engine is stopped',
        },
      });
      expect(engine.getSnapshot().dependencies[0].status).toBe(
        HEALTH_STATES.HEALTHY,
      );

      engine.start();

      expect(clock.pendingTimerCount()).toBe(1);
      expect(
        engine.simulateHealth({
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status: HEALTH_STATES.DEGRADED,
        }).ok,
      ).toBe(true);

      unsubscribe();
      engine.stop();
    });

    it('isolates subscriber failures so remaining subscribers still receive updates', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const failingListener = vi.fn(() => {
        throw new Error('Synthetic subscriber failure');
      });
      const healthyListener = vi.fn();

      const unsubscribeFailing = engine.subscribe(failingListener);
      const unsubscribeHealthy = engine.subscribe(healthyListener);

      expect(() =>
        applyHealth(
          engine,
          DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
          HEALTH_STATES.DEGRADED,
        ),
      ).not.toThrow();
      expect(failingListener).toHaveBeenCalledTimes(2);
      expect(healthyListener).toHaveBeenCalledTimes(2);
      expect(healthyListener).toHaveBeenLastCalledWith(
        engine.getSnapshot(),
      );

      unsubscribeFailing();
      unsubscribeHealthy();
    });
  });

  describe('health simulation, failover, and telemetry', () => {
    it('applies deterministic health responses and opens the primary circuit after three consecutive failures', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      const firstResult = applyHealth(
        engine,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        HEALTH_STATES.TIMEOUT,
      );
      const secondResult = applyHealth(
        engine,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        HEALTH_STATES.INVALID_PAYLOAD,
      );
      const thirdResult = applyHealth(
        engine,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        HEALTH_STATES.FAILED,
      );

      expect(firstResult.snapshot.dependencies[0]).toMatchObject({
        status: HEALTH_STATES.TIMEOUT,
        latencyMs: 1_200,
        failureCount: 1,
        consecutiveFailureCount: 1,
        circuit: CIRCUIT_STATES.CLOSED,
      });
      expect(secondResult.snapshot.dependencies[0]).toMatchObject({
        status: HEALTH_STATES.INVALID_PAYLOAD,
        latencyMs: 120,
        failureCount: 2,
        consecutiveFailureCount: 2,
        circuit: CIRCUIT_STATES.CLOSED,
      });
      expect(thirdResult.snapshot.dependencies[0]).toMatchObject({
        status: HEALTH_STATES.FAILED,
        latencyMs: 0,
        failureCount: 3,
        consecutiveFailureCount: 3,
        circuit: CIRCUIT_STATES.OPEN,
        probeDueAt:
          REFERENCE_TIMESTAMP + 300_000,
      });
      expect(thirdResult.snapshot.profileSource).toBe(
        PROFILE_SOURCES.SECONDARY,
      );
      expect(thirdResult.snapshot.telemetry).toHaveLength(3);
      expect(thirdResult.snapshot.telemetry.at(-1)).toMatchObject({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.FAILED,
        responseTimeMs: 0,
        failureCount: 3,
        circuit: CIRCUIT_STATES.OPEN,
        dataSource: PROFILE_SOURCES.SECONDARY,
        incidentActivity: 1,
      });
      expect(thirdResult.snapshot.incidents).toHaveLength(1);
      expect(thirdResult.snapshot.incidents[0]).toMatchObject({
        eventId: thirdResult.eventId,
        type: INCIDENT_TYPES.FAILOVER,
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        circuit: CIRCUIT_STATES.OPEN,
        dataSource: PROFILE_SOURCES.SECONDARY,
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
      expect(thirdResult.snapshot.alerts).toHaveLength(1);
      expect(thirdResult.snapshot.alerts[0]).toMatchObject({
        incidentId: thirdResult.eventId,
        channel: ALERT_CHANNELS.MOCK_PAGERDUTY,
        title: 'Mock dependency failover',
        acknowledged: false,
      });
    });

    it('does not create duplicate failover incidents while the primary circuit remains open', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      for (
        let attempt = 0;
        attempt < CIRCUIT_FAILURE_THRESHOLD;
        attempt += 1
      ) {
        applyHealth(
          engine,
          DEPENDENCY_IDS.PROFILE_PRIMARY,
          HEALTH_STATES.FAILED,
        );
      }

      const incidentCount = engine.getSnapshot().incidents.length;
      const alertCount = engine.getSnapshot().alerts.length;

      applyHealth(
        engine,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        HEALTH_STATES.TIMEOUT,
      );
      applyHealth(
        engine,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        HEALTH_STATES.INVALID_PAYLOAD,
      );

      expect(engine.getSnapshot().incidents).toHaveLength(
        incidentCount,
      );
      expect(engine.getSnapshot().alerts).toHaveLength(alertCount);
      expect(engine.getSnapshot().dependencies[0].circuit).toBe(
        CIRCUIT_STATES.OPEN,
      );
    });

    it('serializes nested commands and returns an error without interrupting the active command', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      let nestedResult;
      let engine;

      engine = createResilienceEngine({
        clock,
        onTelemetry: () => {
          nestedResult = engine.resetDemo();
        },
      });

      const outerResult = engine.simulateHealth({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.DEGRADED,
      });

      expect(outerResult.ok).toBe(true);
      expect(nestedResult).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_COMMAND',
          message: 'Command is not available for the current scenario',
        },
      });
      expect(engine.getSnapshot().dependencies[0]).toMatchObject({
        status: HEALTH_STATES.DEGRADED,
        latencyMs: 800,
      });
      expect(engine.getSnapshot().telemetry).toHaveLength(1);
    });
  });

  describe('profile routing and fallback lifecycle', () => {
    it('routes profile requests through primary and then secondary without creating fallback records', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      const primaryResult = engine.requestProfile({
        profileId: ACTIVE_PROFILE_ID,
      });

      expect(primaryResult).toMatchObject({
        ok: true,
        snapshot: {
          profileSource: PROFILE_SOURCES.PRIMARY,
          fallback: null,
          alerts: [],
          incidents: [],
        },
      });

      applyHealth(
        engine,
        DEPENDENCY_IDS.PROFILE_PRIMARY,
        HEALTH_STATES.FAILED,
      );

      const secondaryResult = engine.requestProfile({
        profileId: ACTIVE_PROFILE_ID,
      });

      expect(secondaryResult).toMatchObject({
        ok: true,
        snapshot: {
          profileSource: PROFILE_SOURCES.SECONDARY,
          fallback: null,
        },
      });
      expect(clock.pendingTimerCount()).toBe(0);
    });

    it('activates an expiring memory-only fallback with projected incident and alert records', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      const result = activateFallback(engine);
      const { fallback } = result.snapshot;

      expect(fallback).not.toBeNull();
      expect(fallback).toMatchObject({
        profileId: ACTIVE_PROFILE_ID,
        createdAt: REFERENCE_TIMESTAMP,
        expiresAt: REFERENCE_TIMESTAMP + FALLBACK_TTL_MS,
        timerRevision: 1,
      });
      expect(fallback.data).toMatchObject({
        patientIdentifier: ACTIVE_PROFILE_ID,
        accountNumber: '****0042',
        source: PROFILE_SOURCES.FALLBACK,
      });
      expect(result.snapshot.profileSource).toBe(
        PROFILE_SOURCES.FALLBACK,
      );
      expect(result.snapshot.incidents).toHaveLength(2);
      expect(result.snapshot.incidents.at(-1)).toMatchObject({
        eventId: result.eventId,
        type: INCIDENT_TYPES.FALLBACK_ACTIVATED,
        dataSource: PROFILE_SOURCES.FALLBACK,
        recoveryStatus: 'ACTIVE',
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
      expect(result.snapshot.incidents.at(-1)).not.toHaveProperty(
        'profile',
      );
      expect(result.snapshot.incidents.at(-1)).not.toHaveProperty(
        'fallback',
      );
      expect(result.snapshot.alerts).toHaveLength(2);
      expect(result.snapshot.alerts.at(-1)).toMatchObject({
        incidentId: result.eventId,
        channel: ALERT_CHANNELS.MOCK_PAGERDUTY,
        title: 'Mock synthetic fallback activated',
        acknowledged: false,
      });
      expect(clock.pendingTimerCount()).toBe(1);
    });

    it('expires fallback at the exact four-hour boundary and publishes an expiry event', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      activateFallback(engine);

      clock.advance(FALLBACK_TTL_MS - 1);

      expect(engine.getSnapshot().profileSource).toBe(
        PROFILE_SOURCES.FALLBACK,
      );
      expect(engine.getSnapshot().fallback).not.toBeNull();

      clock.advance(1);

      const snapshot = engine.getSnapshot();

      expect(snapshot.now).toBe(
        REFERENCE_TIMESTAMP + FALLBACK_TTL_MS,
      );
      expect(snapshot.profileSource).toBe(PROFILE_SOURCES.NONE);
      expect(snapshot.fallback).toBeNull();
      expect(snapshot.incidents.at(-1)).toMatchObject({
        type: INCIDENT_TYPES.EXPIRY,
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        dataSource: PROFILE_SOURCES.NONE,
        occurredAt: REFERENCE_TIMESTAMP + FALLBACK_TTL_MS,
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
      expect(clock.pendingTimerCount()).toBe(0);
    });

    it('supports explicit expiry at the boundary and rejects stale fallback identifiers', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      const activation = activateFallback(engine);
      const fallbackId = activation.snapshot.fallback.id;

      const staleResult = engine.expireFallback({
        fallbackId: 'fallback-missing',
      });

      expect(staleResult).toMatchObject({
        ok: false,
        error: {
          code: 'NOT_FOUND',
        },
      });
      expect(engine.getSnapshot().fallback.id).toBe(fallbackId);

      engine.stop();
      clock.advance(FALLBACK_TTL_MS);
      engine.start();

      const expiryResult = engine.expireFallback({
        fallbackId,
      });

      expect(expiryResult.ok).toBe(true);
      expect(expiryResult.snapshot.fallback).toBeNull();
      expect(expiryResult.snapshot.profileSource).toBe(
        PROFILE_SOURCES.NONE,
      );
      expect(expiryResult.snapshot.incidents.at(-1).type).toBe(
        INCIDENT_TYPES.EXPIRY,
      );
      expect(clock.pendingTimerCount()).toBe(0);
    });

    it('returns a profile-unavailable error for a valid but unseeded synthetic identifier', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const before = engine.getSnapshot();

      const result = engine.requestProfile({
        profileId: 'MOCK-9999',
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'PROFILE_UNAVAILABLE',
          message: 'Synthetic profile data is unavailable',
        },
      });
      expect(engine.getSnapshot()).toBe(before);
      expect(engine.getSnapshot().fallback).toBeNull();
    });
  });

  describe('recovery, alert acknowledgement, and reset', () => {
    it('records ordered HALF_OPEN and CLOSED recovery events and removes the active fallback', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      activateFallback(engine);

      const result = engine.simulateRecovery({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        profileId: ACTIVE_PROFILE_ID,
      });

      expect(result.ok).toBe(true);
      expect(result.snapshot.dependencies[0]).toMatchObject({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.HEALTHY,
        circuit: CIRCUIT_STATES.CLOSED,
        consecutiveFailureCount: 0,
        probeDueAt: null,
      });
      expect(result.snapshot.profileSource).toBe(
        PROFILE_SOURCES.PRIMARY,
      );
      expect(result.snapshot.fallback).toBeNull();
      expect(result.snapshot.incidents.slice(-2)).toEqual([
        expect.objectContaining({
          type: INCIDENT_TYPES.RECOVERY,
          circuit: CIRCUIT_STATES.HALF_OPEN,
          recoveryStatus: 'RECOVERED',
          dataSource: PROFILE_SOURCES.PRIMARY,
        }),
        expect.objectContaining({
          eventId: result.eventId,
          type: INCIDENT_TYPES.RECOVERY,
          circuit: CIRCUIT_STATES.CLOSED,
          recoveryStatus: 'RECOVERED',
          dataSource: PROFILE_SOURCES.PRIMARY,
        }),
      ]);
      expect(result.snapshot.telemetry.at(-1)).toMatchObject({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.HEALTHY,
        circuit: CIRCUIT_STATES.CLOSED,
        dataSource: PROFILE_SOURCES.PRIMARY,
      });
      expect(clock.pendingTimerCount()).toBe(0);
    });

    it('rejects recovery when the dependency is unsupported for recovery or the primary circuit is closed', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const baseline = engine.getSnapshot();

      const secondaryResult = engine.simulateRecovery({
        dependencyId: DEPENDENCY_IDS.PROFILE_SECONDARY,
        profileId: ACTIVE_PROFILE_ID,
      });
      const closedPrimaryResult = engine.simulateRecovery({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        profileId: ACTIVE_PROFILE_ID,
      });

      expect(secondaryResult).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_COMMAND',
          details: {
            field: 'dependencyId',
          },
        },
      });
      expect(closedPrimaryResult).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_COMMAND',
          details: {
            field: 'dependencyId',
          },
        },
      });
      expect(engine.getSnapshot()).toBe(baseline);
    });

    it('acknowledges an existing local alert and leaves unknown identifiers unchanged', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      const activation = activateFallback(engine);
      const alertId = activation.snapshot.alerts[0].id;

      const result = engine.acknowledgeAlert({ alertId });

      expect(result.ok).toBe(true);
      expect(
        result.snapshot.alerts.find((alert) => alert.id === alertId),
      ).toMatchObject({
        id: alertId,
        acknowledged: true,
      });

      const beforeUnknown = engine.getSnapshot();
      const unknownResult = engine.acknowledgeAlert({
        alertId: 'alert-missing',
      });

      expect(unknownResult).toMatchObject({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          details: {
            field: 'alertId',
          },
        },
      });
      expect(engine.getSnapshot()).toBe(beforeUnknown);
    });

    it('resets dependencies, fallback, incidents, alerts, telemetry, and timers to the synthetic baseline', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });

      activateFallback(engine);

      const result = engine.resetDemo();

      expect(result.ok).toBe(true);
      expect(result.snapshot).toMatchObject({
        now: REFERENCE_TIMESTAMP,
        profileSource: PROFILE_SOURCES.NONE,
        fallback: null,
        alerts: [],
        incidents: [],
        telemetry: [],
        lastEventId: result.eventId,
      });
      expect(result.snapshot.dependencies).toEqual([
        expect.objectContaining({
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          status: HEALTH_STATES.HEALTHY,
          failureCount: 0,
          consecutiveFailureCount: 0,
          circuit: CIRCUIT_STATES.CLOSED,
        }),
        expect.objectContaining({
          dependencyId: DEPENDENCY_IDS.PROFILE_SECONDARY,
          status: HEALTH_STATES.HEALTHY,
          failureCount: 0,
          consecutiveFailureCount: 0,
          circuit: CIRCUIT_STATES.CLOSED,
        }),
        expect.objectContaining({
          dependencyId: DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
          status: HEALTH_STATES.HEALTHY,
          failureCount: 0,
          consecutiveFailureCount: 0,
          circuit: CIRCUIT_STATES.CLOSED,
        }),
      ]);
      expect(clock.pendingTimerCount()).toBe(0);
    });
  });

  describe('validation, record limits, and local-only operation', () => {
    it('returns validation errors without throwing or changing state', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const baseline = engine.getSnapshot();

      expect(() =>
        engine.simulateHealth({
          dependencyId: 'external-service',
          status: HEALTH_STATES.FAILED,
        }),
      ).not.toThrow();

      const invalidDependency = engine.simulateHealth({
        dependencyId: 'external-service',
        status: HEALTH_STATES.FAILED,
      });
      const invalidStatus = engine.simulateHealth({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: 'UNSUPPORTED',
      });
      const invalidAlert = engine.acknowledgeAlert({
        alertId: 'unsafe alert identifier',
      });

      expect(invalidDependency).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            field: 'dependencyId',
          },
        },
      });
      expect(invalidStatus).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            field: 'status',
          },
        },
      });
      expect(invalidAlert).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            field: 'alertId',
          },
        },
      });
      expect(engine.getSnapshot()).toBe(baseline);
    });

    it('caps telemetry, incident timeline, and alert records at fifty newest entries', () => {
      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const cycleCount = 26;

      for (let cycle = 0; cycle < cycleCount; cycle += 1) {
        activateFallback(engine);

        const recoveryResult = engine.simulateRecovery({
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          profileId: ACTIVE_PROFILE_ID,
        });

        expect(recoveryResult.ok).toBe(true);
      }

      const snapshot = engine.getSnapshot();

      expect(snapshot.telemetry).toHaveLength(MAX_RECORDS);
      expect(snapshot.incidents).toHaveLength(MAX_RECORDS);
      expect(snapshot.alerts).toHaveLength(MAX_RECORDS);
      expect(new Set(
        snapshot.incidents.map((incident) => incident.eventId),
      ).size).toBe(MAX_RECORDS);
      expect(new Set(
        snapshot.alerts.map((alert) => alert.id),
      ).size).toBe(MAX_RECORDS);
      expect(Object.isFrozen(snapshot.telemetry)).toBe(true);
      expect(Object.isFrozen(snapshot.incidents)).toBe(true);
      expect(Object.isFrozen(snapshot.alerts)).toBe(true);
    });

    it('performs the complete failover and recovery scenario without fetch, XMLHttpRequest, or WebSocket access', () => {
      const fetchSpy = vi.fn();
      const xhrSpy = vi.fn(function MockXMLHttpRequest() {});
      const webSocketSpy = vi.fn(function MockWebSocket() {});

      vi.stubGlobal('fetch', fetchSpy);
      vi.stubGlobal('XMLHttpRequest', xhrSpy);
      vi.stubGlobal('WebSocket', webSocketSpy);

      const clock = new FakeClock(REFERENCE_TIMESTAMP);
      const engine = createResilienceEngine({ clock });
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      activateFallback(engine);

      const alertId = engine.getSnapshot().alerts[0].id;
      expect(engine.acknowledgeAlert({ alertId }).ok).toBe(true);

      clock.advance(FALLBACK_TTL_MS);

      expect(
        engine.simulateRecovery({
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          profileId: ACTIVE_PROFILE_ID,
        }).ok,
      ).toBe(true);

      expect(engine.resetDemo().ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSpy).not.toHaveBeenCalled();
      expect(webSocketSpy).not.toHaveBeenCalled();
      expect(listener.mock.calls.length).toBeGreaterThan(1);

      unsubscribe();
      engine.stop();
    });
  });
});