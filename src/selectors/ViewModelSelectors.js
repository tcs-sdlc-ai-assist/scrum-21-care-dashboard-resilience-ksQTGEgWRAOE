import {
  DEPENDENCY_IDS,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import { INCIDENT_TYPES, createSnapshot } from '../domain/model.js';
import {
  selectActiveAlerts,
  selectDependencyCards,
  selectIncidentTimeline,
  selectProfileStatus,
  selectTelemetrySeries,
} from '../domain/selectors.js';
import { CLINICAL_MESSAGES } from '../constants/messages.js';

/**
 * Creates a presentation-safe context eligibility model.
 *
 * @param {ReadonlyArray<Readonly<object>>} dependencies
 * @returns {Readonly<{
 *   dependencyId: string,
 *   displayName: string,
 *   status: string,
 *   available: boolean,
 *   lastCheckedAt: number
 * }>}
 */
function selectContextEligibility(dependencies) {
  const dependency = dependencies.find(
    (item) =>
      item.dependencyId === DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
  );

  if (dependency === undefined) {
    throw new TypeError(
      'context eligibility dependency must be available',
    );
  }

  return Object.freeze({
    dependencyId: dependency.dependencyId,
    displayName: dependency.displayName,
    status: dependency.status,
    available: dependency.isUsable,
    lastCheckedAt: dependency.lastCheckedAt,
  });
}

/**
 * Returns a stable, presentation-safe care team view model.
 *
 * @param {unknown} state
 * @returns {Readonly<{
 *   profile: object|null,
 *   profileSource: string,
 *   available: boolean,
 *   fallbackActive: boolean,
 *   fallbackExpiresAt: number|null,
 *   contextEligibility: Readonly<{
 *     dependencyId: string,
 *     displayName: string,
 *     status: string,
 *     available: boolean,
 *     lastCheckedAt: number
 *   }>
 * }>}
 */
export function selectClinicalModel(state) {
  const profileStatus = selectProfileStatus(state);
  const dependencies = selectDependencyCards(state);

  return Object.freeze({
    profile: profileStatus.profile,
    profileSource: profileStatus.profileSource,
    available: profileStatus.available,
    fallbackActive: profileStatus.fallbackActive,
    fallbackExpiresAt: profileStatus.fallbackExpiresAt,
    contextEligibility: selectContextEligibility(dependencies),
  });
}

/**
 * Returns a stable, presentation-safe SRE view model.
 *
 * @param {unknown} state
 * @returns {Readonly<{
 *   dependencies: ReadonlyArray<Readonly<object>>,
 *   telemetry: ReadonlyArray<Readonly<object>>,
 *   alerts: ReadonlyArray<Readonly<object>>,
 *   incidents: ReadonlyArray<Readonly<object>>
 * }>}
 */
export function selectSreModel(state) {
  return Object.freeze({
    dependencies: selectDependencyCards(state),
    telemetry: selectTelemetrySeries(state),
    alerts: selectActiveAlerts(state),
    incidents: selectIncidentTimeline(state),
  });
}

/**
 * Returns the fallback activation event associated with the current fallback.
 *
 * @param {ReadonlyArray<Readonly<object>>} incidents
 * @param {Readonly<object>} fallback
 * @returns {Readonly<object>|null}
 */
function findFallbackActivation(incidents, fallback) {
  return (
    incidents.find(
      (incident) =>
        incident.type === INCIDENT_TYPES.FALLBACK_ACTIVATED &&
        incident.dataSource === PROFILE_SOURCES.FALLBACK &&
        incident.occurredAt === fallback.createdAt,
    ) ??
    incidents.find(
      (incident) =>
        incident.type === INCIDENT_TYPES.FALLBACK_ACTIVATED &&
        incident.dataSource === PROFILE_SOURCES.FALLBACK,
    ) ??
    null
  );
}

/**
 * Selects an active fallback banner keyed by its activation event. Critical
 * fallback banners cannot be dismissed. A dismissal applies only to the
 * matching non-critical event.
 *
 * @param {unknown} state
 * @param {unknown} [dismissalEventId]
 * @returns {Readonly<{
 *   eventId: string,
 *   title: string,
 *   body: string,
 *   critical: boolean,
 *   dismissible: boolean,
 *   expiresAt: number,
 *   remainingMs: number,
 *   profileSource: string
 * }>|null}
 */
export function selectFallbackBanner(state, dismissalEventId = null) {
  const snapshot = createSnapshot(state);
  const profileStatus = selectProfileStatus(snapshot);

  if (
    !profileStatus.fallbackActive ||
    snapshot.fallback === null
  ) {
    return null;
  }

  const incidents = selectIncidentTimeline(snapshot);
  const activation = findFallbackActivation(
    incidents,
    snapshot.fallback,
  );
  const eventId =
    activation?.eventId ??
    snapshot.lastEventId ??
    snapshot.fallback.id;
  const remainingMs = Math.max(
    0,
    snapshot.fallback.expiresAt - snapshot.now,
  );
  const critical =
    remainingMs <= 0 ||
    snapshot.profileSource === PROFILE_SOURCES.FALLBACK;
  const dismissible = !critical;

  if (dismissible && dismissalEventId === eventId) {
    return null;
  }

  return Object.freeze({
    eventId,
    title: CLINICAL_MESSAGES.fallbackTitle,
    body: CLINICAL_MESSAGES.fallbackBody,
    critical,
    dismissible,
    expiresAt: snapshot.fallback.expiresAt,
    remainingMs,
    profileSource: snapshot.profileSource,
  });
}

const ViewModelSelectors = Object.freeze({
  selectClinicalModel,
  selectSreModel,
  selectFallbackBanner,
});

export default ViewModelSelectors;