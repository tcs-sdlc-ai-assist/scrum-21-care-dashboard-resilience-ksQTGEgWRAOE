import {
  selectClinicalModel,
  selectSreModel,
} from './ViewModelSelectors.js';
import {
  maskAccountNumber,
  maskPatientIdentifier,
  sanitizeDiagnosticSummary,
  validateSyntheticRecord,
} from '../utils/privacy.js';

/**
 * Projects a validated synthetic profile to the minimum fields permitted for
 * clinical presentation. Internal repository identifiers are intentionally
 * omitted.
 *
 * @param {unknown} profile
 * @returns {Readonly<{
 *   displayName: string,
 *   patientIdentifier: string,
 *   accountNumber: string,
 *   source: string,
 *   generatedAt: number
 * }>|null}
 */
export function selectPrivacySafeProfile(profile) {
  if (profile === null || profile === undefined) {
    return null;
  }

  if (!validateSyntheticRecord(profile)) {
    throw new TypeError('profile must be a valid synthetic record');
  }

  return Object.freeze({
    displayName: profile.displayName,
    patientIdentifier: maskPatientIdentifier(
      profile.patientIdentifier,
    ),
    accountNumber: maskAccountNumber(profile.accountNumber),
    source: profile.source,
    generatedAt: profile.generatedAt,
  });
}

/**
 * Projects the clinical view model without exposing repository identifiers or
 * unmasked profile fields.
 *
 * @param {unknown} state
 * @returns {Readonly<{
 *   profile: ReturnType<typeof selectPrivacySafeProfile>,
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
export function selectPrivacySafeClinicalModel(state) {
  const model = selectClinicalModel(state);

  return Object.freeze({
    profile: selectPrivacySafeProfile(model.profile),
    profileSource: model.profileSource,
    available: model.available,
    fallbackActive: model.fallbackActive,
    fallbackExpiresAt: model.fallbackExpiresAt,
    contextEligibility: Object.freeze({
      dependencyId: model.contextEligibility.dependencyId,
      displayName: model.contextEligibility.displayName,
      status: model.contextEligibility.status,
      available: model.contextEligibility.available,
      lastCheckedAt: model.contextEligibility.lastCheckedAt,
    }),
  });
}

/**
 * @param {Readonly<Record<string, unknown>>} dependency
 * @returns {Readonly<Record<string, unknown>>}
 */
function projectDependency(dependency) {
  return Object.freeze({
    dependencyId: dependency.dependencyId,
    displayName: dependency.displayName,
    status: dependency.status,
    latencyMs: dependency.latencyMs,
    failureCount: dependency.failureCount,
    consecutiveFailureCount: dependency.consecutiveFailureCount,
    circuit: dependency.circuit,
    lastCheckedAt: dependency.lastCheckedAt,
    probeDueAt: dependency.probeDueAt,
    isUsable: dependency.isUsable,
  });
}

/**
 * @param {Readonly<Record<string, unknown>>} sample
 * @returns {Readonly<Record<string, unknown>>}
 */
function projectTelemetry(sample) {
  return Object.freeze({
    timestamp: sample.timestamp,
    dependencyId: sample.dependencyId,
    displayName: sample.displayName,
    status: sample.status,
    responseTimeMs: sample.responseTimeMs,
    failureCount: sample.failureCount,
    circuit: sample.circuit,
    dataSource: sample.dataSource,
    incidentActivity: sample.incidentActivity,
  });
}

/**
 * @param {Readonly<Record<string, unknown>>} alert
 * @returns {Readonly<Record<string, unknown>>}
 */
function projectAlert(alert) {
  return Object.freeze({
    id: alert.id,
    incidentId: alert.incidentId,
    channel: alert.channel,
    severity: alert.severity,
    title: alert.title,
    createdAt: alert.createdAt,
    acknowledged: alert.acknowledged,
  });
}

/**
 * Projects an incident to allowlisted operational fields and normalizes its
 * diagnostic value to the fixed mock-record format.
 *
 * @param {Readonly<Record<string, unknown>>} incident
 * @returns {Readonly<Record<string, unknown>>}
 */
export function selectSanitizedIncident(incident) {
  if (
    typeof incident !== 'object' ||
    incident === null ||
    Array.isArray(incident)
  ) {
    throw new TypeError('incident must be an object');
  }

  return Object.freeze({
    eventId: incident.eventId,
    type: incident.type,
    dependencyId: incident.dependencyId,
    severity: incident.severity,
    condition: incident.condition,
    circuit: incident.circuit,
    dataSource: incident.dataSource,
    occurredAt: incident.occurredAt,
    recoveryStatus: incident.recoveryStatus,
    diagnosticSummary: sanitizeDiagnosticSummary(
      incident.diagnosticSummary,
    ),
  });
}

/**
 * Projects the SRE view model to allowlisted operational fields. Profile and
 * fallback payloads are never included.
 *
 * @param {unknown} state
 * @returns {Readonly<{
 *   dependencies: ReadonlyArray<Readonly<Record<string, unknown>>>,
 *   telemetry: ReadonlyArray<Readonly<Record<string, unknown>>>,
 *   alerts: ReadonlyArray<Readonly<Record<string, unknown>>>,
 *   incidents: ReadonlyArray<Readonly<Record<string, unknown>>>
 * }>}
 */
export function selectPrivacySafeSreModel(state) {
  const model = selectSreModel(state);

  return Object.freeze({
    dependencies: Object.freeze(
      model.dependencies.map(projectDependency),
    ),
    telemetry: Object.freeze(model.telemetry.map(projectTelemetry)),
    alerts: Object.freeze(model.alerts.map(projectAlert)),
    incidents: Object.freeze(
      model.incidents.map(selectSanitizedIncident),
    ),
  });
}

export const selectClinicalPrivacyModel =
  selectPrivacySafeClinicalModel;
export const selectSrePrivacyModel = selectPrivacySafeSreModel;

const PrivacySelectors = Object.freeze({
  selectPrivacySafeProfile,
  selectPrivacySafeClinicalModel,
  selectPrivacySafeSreModel,
  selectSanitizedIncident,
});

export default PrivacySelectors;