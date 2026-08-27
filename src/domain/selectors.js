import {
  CIRCUIT_STATES,
  DEPENDENCIES,
  HEALTH_STATES,
  PROFILE_SOURCES,
} from './constants.js';
import { createSnapshot } from './model.js';

const DEPENDENCY_NAMES = new Map(
  DEPENDENCIES.map((dependency) => [
    dependency.id,
    dependency.displayName,
  ]),
);

/**
 * Returns immutable UI-facing cards for the three fixed dependencies.
 *
 * @param {unknown} state
 * @returns {ReadonlyArray<Readonly<{
 *   dependencyId: string,
 *   displayName: string,
 *   status: string,
 *   latencyMs: number,
 *   failureCount: number,
 *   consecutiveFailureCount: number,
 *   circuit: string,
 *   lastCheckedAt: number,
 *   probeDueAt: number|null,
 *   isUsable: boolean
 * }>>}
 */
export function selectDependencyCards(state) {
  const snapshot = createSnapshot(state);

  return Object.freeze(
    snapshot.dependencies.map((dependency) =>
      Object.freeze({
        ...dependency,
        displayName:
          DEPENDENCY_NAMES.get(dependency.dependencyId) ??
          dependency.dependencyId,
        isUsable:
          dependency.status === HEALTH_STATES.HEALTHY &&
          dependency.circuit === CIRCUIT_STATES.CLOSED,
      }),
    ),
  );
}

/**
 * Returns the current immutable profile availability and fallback view.
 *
 * @param {unknown} state
 * @returns {Readonly<{
 *   profileSource: string,
 *   available: boolean,
 *   fallbackActive: boolean,
 *   fallbackExpiresAt: number|null,
 *   profile: object|null
 * }>}
 */
export function selectProfileStatus(state) {
  const snapshot = createSnapshot(state);
  const fallbackActive =
    snapshot.profileSource === PROFILE_SOURCES.FALLBACK &&
    snapshot.fallback !== null &&
    snapshot.now < snapshot.fallback.expiresAt;

  return Object.freeze({
    profileSource: snapshot.profileSource,
    available:
      snapshot.profileSource !== PROFILE_SOURCES.NONE &&
      (snapshot.profileSource !== PROFILE_SOURCES.FALLBACK ||
        fallbackActive),
    fallbackActive,
    fallbackExpiresAt: fallbackActive
      ? snapshot.fallback.expiresAt
      : null,
    profile: fallbackActive ? snapshot.fallback.data : null,
  });
}

/**
 * Returns unacknowledged alerts in newest-to-oldest order.
 *
 * @param {unknown} state
 * @returns {ReadonlyArray<Readonly<object>>}
 */
export function selectActiveAlerts(state) {
  const snapshot = createSnapshot(state);

  return Object.freeze(
    snapshot.alerts
      .filter((alert) => !alert.acknowledged)
      .reverse(),
  );
}

/**
 * Returns incident lifecycle events in newest-to-oldest order.
 *
 * @param {unknown} state
 * @returns {ReadonlyArray<Readonly<object>>}
 */
export function selectIncidentTimeline(state) {
  const snapshot = createSnapshot(state);
  return Object.freeze([...snapshot.incidents].reverse());
}

/**
 * Returns immutable telemetry points in chronological insertion order,
 * enriched with stable dependency display names.
 *
 * @param {unknown} state
 * @returns {ReadonlyArray<Readonly<{
 *   timestamp: number,
 *   dependencyId: string,
 *   displayName: string,
 *   status: string,
 *   responseTimeMs: number,
 *   failureCount: number,
 *   circuit: string,
 *   dataSource: string,
 *   incidentActivity: number
 * }>>}
 */
export function selectTelemetrySeries(state) {
  const snapshot = createSnapshot(state);

  return Object.freeze(
    snapshot.telemetry.map((sample) =>
      Object.freeze({
        ...sample,
        displayName:
          DEPENDENCY_NAMES.get(sample.dependencyId) ??
          sample.dependencyId,
      }),
    ),
  );
}

const ResilienceSelectors = Object.freeze({
  selectDependencyCards,
  selectProfileStatus,
  selectActiveAlerts,
  selectIncidentTimeline,
  selectTelemetrySeries,
});

export default ResilienceSelectors;