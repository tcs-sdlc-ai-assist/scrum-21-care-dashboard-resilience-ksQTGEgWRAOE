import {
  CIRCUIT_STATES,
  MAX_RECORDS,
  PROFILE_SOURCES,
  RECOVERY_STATUSES,
  SEVERITIES,
} from '../domain/constants.js';
import {
  ALERT_CHANNELS,
  INCIDENT_TYPES,
  createAlert,
  createIncidentEvent,
  createTimelineEvent,
  isBoundedId,
  isDependencyId,
  isProfileId,
} from '../domain/model.js';
import {
  appendBounded,
  upsertBounded,
} from '../utils/collections.js';
import { sanitizeDiagnosticSummary } from '../utils/privacy.js';

const DEFAULT_ALERT_CHANNEL = ALERT_CHANNELS.MOCK_PAGERDUTY;

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {Record<string, unknown>}
 */
function requireObject(value, field) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${field} must be an object`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  if (!isBoundedId(value)) {
    throw new TypeError(
      `${field} must be a non-empty privacy-safe identifier`,
    );
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireDependencyId(value, field = 'dependencyId') {
  if (!isDependencyId(value)) {
    throw new TypeError(`${field} must be a supported dependency`);
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
    throw new TypeError(`${field} must match MOCK-####`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireCircuitState(value, field = 'circuit') {
  if (!Object.values(CIRCUIT_STATES).includes(value)) {
    throw new TypeError(`${field} must be a supported circuit state`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireDataSource(value, field = 'dataSource') {
  if (!Object.values(PROFILE_SOURCES).includes(value)) {
    throw new TypeError(`${field} must be a supported profile source`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireSeverity(value, field = 'severity') {
  if (!Object.values(SEVERITIES).includes(value)) {
    throw new TypeError(`${field} must be a supported severity`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireAlertChannel(value, field = 'channel') {
  if (!Object.values(ALERT_CHANNELS).includes(value)) {
    throw new TypeError(`${field} must be a supported mock alert channel`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {boolean}
 */
function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${field} must be a boolean`);
  }

  return value;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {string}
 */
function resolveDiagnosticSummary(input) {
  const profileId = requireProfileId(input.profileId);
  return sanitizeDiagnosticSummary(profileId);
}

/**
 * Creates a validated failover incident without retaining profile data.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createIncidentEvent>}
 */
export function createFailoverIncident(input) {
  const value = requireObject(input, 'failover incident');

  return createIncidentEvent({
    eventId: requireId(value.eventId, 'eventId'),
    type: INCIDENT_TYPES.FAILOVER,
    dependencyId: requireDependencyId(value.dependencyId),
    severity: requireSeverity(value.severity ?? SEVERITIES.HIGH),
    condition: 'Mock primary dependency failover activated',
    circuit: requireCircuitState(
      value.circuit ?? CIRCUIT_STATES.OPEN,
    ),
    dataSource: requireDataSource(
      value.dataSource ?? PROFILE_SOURCES.SECONDARY,
    ),
    occurredAt: requireTimestamp(value.occurredAt, 'occurredAt'),
    recoveryStatus: RECOVERY_STATUSES.ACTIVE,
    diagnosticSummary: resolveDiagnosticSummary(value),
  });
}

/**
 * Creates a validated browser-local fallback activation incident.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createIncidentEvent>}
 */
export function createFallbackActivationIncident(input) {
  const value = requireObject(input, 'fallback incident');

  return createIncidentEvent({
    eventId: requireId(value.eventId, 'eventId'),
    type: INCIDENT_TYPES.FALLBACK_ACTIVATED,
    dependencyId: requireDependencyId(value.dependencyId),
    severity: requireSeverity(value.severity ?? SEVERITIES.CRITICAL),
    condition: 'Browser local synthetic fallback activated',
    circuit: requireCircuitState(
      value.circuit ?? CIRCUIT_STATES.OPEN,
    ),
    dataSource: PROFILE_SOURCES.FALLBACK,
    occurredAt: requireTimestamp(value.occurredAt, 'occurredAt'),
    recoveryStatus: RECOVERY_STATUSES.ACTIVE,
    diagnosticSummary: resolveDiagnosticSummary(value),
  });
}

export const createFallbackIncident = createFallbackActivationIncident;

/**
 * Creates one validated recovery timeline event.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createTimelineEvent>}
 */
export function createRecoveryEvent(input) {
  const value = requireObject(input, 'recovery event');
  const circuit = requireCircuitState(value.circuit);

  if (
    circuit !== CIRCUIT_STATES.HALF_OPEN &&
    circuit !== CIRCUIT_STATES.CLOSED
  ) {
    throw new TypeError(
      'recovery circuit must be HALF_OPEN or CLOSED',
    );
  }

  return createTimelineEvent({
    eventId: requireId(value.eventId, 'eventId'),
    type: INCIDENT_TYPES.RECOVERY,
    dependencyId: requireDependencyId(value.dependencyId),
    severity: requireSeverity(value.severity ?? SEVERITIES.HIGH),
    condition:
      circuit === CIRCUIT_STATES.HALF_OPEN
        ? 'Mock recovery probe succeeded'
        : 'Mock dependency recovery completed',
    circuit,
    dataSource: requireDataSource(
      value.dataSource ?? PROFILE_SOURCES.PRIMARY,
    ),
    occurredAt: requireTimestamp(value.occurredAt, 'occurredAt'),
    recoveryStatus: RECOVERY_STATUSES.RECOVERED,
    diagnosticSummary: resolveDiagnosticSummary(value),
  });
}

/**
 * Creates the ordered HALF_OPEN then CLOSED recovery lifecycle events.
 *
 * @param {unknown} input
 * @returns {ReadonlyArray<ReturnType<typeof createTimelineEvent>>}
 */
export function createOrderedRecoveryEvents(input) {
  const value = requireObject(input, 'recovery events');

  return Object.freeze([
    createRecoveryEvent({
      eventId: requireId(value.halfOpenEventId, 'halfOpenEventId'),
      dependencyId: value.dependencyId,
      severity: value.severity,
      dataSource: value.dataSource,
      occurredAt: value.occurredAt,
      profileId: value.profileId,
      circuit: CIRCUIT_STATES.HALF_OPEN,
    }),
    createRecoveryEvent({
      eventId: requireId(value.closedEventId, 'closedEventId'),
      dependencyId: value.dependencyId,
      severity: value.severity,
      dataSource: value.dataSource,
      occurredAt: value.occurredAt,
      profileId: value.profileId,
      circuit: CIRCUIT_STATES.CLOSED,
    }),
  ]);
}

/**
 * Creates a validated fallback expiry timeline event.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createTimelineEvent>}
 */
export function createFallbackExpiryEvent(input) {
  const value = requireObject(input, 'fallback expiry event');

  return createTimelineEvent({
    eventId: requireId(value.eventId, 'eventId'),
    type: INCIDENT_TYPES.EXPIRY,
    dependencyId: requireDependencyId(value.dependencyId),
    severity: requireSeverity(value.severity ?? SEVERITIES.MEDIUM),
    condition: 'Browser local synthetic fallback expired',
    circuit: requireCircuitState(
      value.circuit ?? CIRCUIT_STATES.OPEN,
    ),
    dataSource: PROFILE_SOURCES.NONE,
    occurredAt: requireTimestamp(value.occurredAt, 'occurredAt'),
    recoveryStatus: RECOVERY_STATUSES.ACTIVE,
    diagnosticSummary: resolveDiagnosticSummary(value),
  });
}

export const createExpiryEvent = createFallbackExpiryEvent;

/**
 * Creates a validated local-only mock alert.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createAlert>}
 */
export function createIncidentAlert(input) {
  const value = requireObject(input, 'incident alert');

  return createAlert({
    id: requireId(value.id, 'id'),
    incidentId: requireId(value.incidentId, 'incidentId'),
    channel: requireAlertChannel(
      value.channel ?? DEFAULT_ALERT_CHANNEL,
    ),
    severity: requireSeverity(value.severity),
    title: value.title,
    createdAt: requireTimestamp(value.createdAt, 'createdAt'),
    acknowledged:
      value.acknowledged === undefined
        ? false
        : requireBoolean(value.acknowledged, 'acknowledged'),
  });
}

export const createMockAlert = createIncidentAlert;

/**
 * Memory-only bounded repository for validated incidents, alerts, and ordered
 * timeline events. No record is serialized or sent to an external service.
 */
export class IncidentRepository {
  constructor() {
    this.incidents = Object.freeze([]);
    this.alerts = Object.freeze([]);
    this.timeline = Object.freeze([]);
    this.eventIds = new Set();
  }

  /**
   * Appends an incident and its corresponding timeline entry. An event with an
   * existing eventId is treated as an idempotent duplicate.
   *
   * @param {unknown} incident
   * @returns {ReturnType<typeof createIncidentEvent>}
   */
  appendIncident(incident) {
    const record = createIncidentEvent(incident);

    if (this.eventIds.has(record.eventId)) {
      return this.incidents.find(
        (item) => item.eventId === record.eventId,
      ) ?? record;
    }

    this.incidents = appendBounded(
      this.incidents,
      record,
      MAX_RECORDS,
    );
    this.timeline = appendBounded(
      this.timeline,
      createTimelineEvent(record),
      MAX_RECORDS,
    );
    this.eventIds.add(record.eventId);
    this.pruneEventIds();

    return record;
  }

  /**
   * Alias for appending a validated incident.
   *
   * @param {unknown} incident
   * @returns {ReturnType<typeof createIncidentEvent>}
   */
  recordIncident(incident) {
    return this.appendIncident(incident);
  }

  /**
   * Appends a timeline-only lifecycle event with eventId deduplication.
   *
   * @param {unknown} event
   * @returns {ReturnType<typeof createTimelineEvent>}
   */
  appendTimeline(event) {
    const record = createTimelineEvent(event);

    if (this.eventIds.has(record.eventId)) {
      return this.timeline.find(
        (item) => item.eventId === record.eventId,
      ) ?? record;
    }

    this.timeline = appendBounded(
      this.timeline,
      record,
      MAX_RECORDS,
    );
    this.eventIds.add(record.eventId);
    this.pruneEventIds();

    return record;
  }

  /**
   * Appends a validated mock alert unless its identifier already exists.
   *
   * @param {unknown} alert
   * @returns {ReturnType<typeof createAlert>}
   */
  appendAlert(alert) {
    const record = createAlert(alert);
    const existing = this.alerts.find((item) => item.id === record.id);

    if (existing !== undefined) {
      return existing;
    }

    this.alerts = appendBounded(this.alerts, record, MAX_RECORDS);
    return record;
  }

  /**
   * Alias for appending a validated alert.
   *
   * @param {unknown} alert
   * @returns {ReturnType<typeof createAlert>}
   */
  recordAlert(alert) {
    return this.appendAlert(alert);
  }

  /**
   * Records a failover incident and one local mock alert.
   *
   * @param {unknown} input
   * @returns {Readonly<{
   *   incident: ReturnType<typeof createIncidentEvent>,
   *   alert: ReturnType<typeof createAlert>
   * }>}
   */
  recordFailover(input) {
    const value = requireObject(input, 'failover');
    const incident = createFailoverIncident(value);
    const duplicate = this.eventIds.has(incident.eventId);
    const storedIncident = this.appendIncident(incident);
    const alert = duplicate
      ? this.alerts.find(
          (item) => item.incidentId === incident.eventId,
        ) ?? null
      : this.appendAlert(
          createIncidentAlert({
            id: requireId(value.alertId, 'alertId'),
            incidentId: incident.eventId,
            channel: value.channel ?? DEFAULT_ALERT_CHANNEL,
            severity: incident.severity,
            title: 'Mock dependency failover',
            createdAt: incident.occurredAt,
          }),
        );

    return Object.freeze({
      incident: storedIncident,
      alert,
    });
  }

  /**
   * Records a fallback activation incident and one local mock alert.
   *
   * @param {unknown} input
   * @returns {Readonly<{
   *   incident: ReturnType<typeof createIncidentEvent>,
   *   alert: ReturnType<typeof createAlert>
   * }>}
   */
  recordFallbackActivation(input) {
    const value = requireObject(input, 'fallback activation');
    const incident = createFallbackActivationIncident(value);
    const duplicate = this.eventIds.has(incident.eventId);
    const storedIncident = this.appendIncident(incident);
    const alert = duplicate
      ? this.alerts.find(
          (item) => item.incidentId === incident.eventId,
        ) ?? null
      : this.appendAlert(
          createIncidentAlert({
            id: requireId(value.alertId, 'alertId'),
            incidentId: incident.eventId,
            channel: value.channel ?? DEFAULT_ALERT_CHANNEL,
            severity: incident.severity,
            title: 'Mock synthetic fallback activated',
            createdAt: incident.occurredAt,
          }),
        );

    return Object.freeze({
      incident: storedIncident,
      alert,
    });
  }

  /**
   * Alias for recording a fallback activation.
   *
   * @param {unknown} input
   * @returns {ReturnType<IncidentRepository['recordFallbackActivation']>}
   */
  recordFallback(input) {
    return this.recordFallbackActivation(input);
  }

  /**
   * Appends HALF_OPEN and CLOSED recovery events in lifecycle order.
   *
   * @param {unknown} input
   * @returns {ReadonlyArray<ReturnType<typeof createTimelineEvent>>}
   */
  recordRecovery(input) {
    const events = createOrderedRecoveryEvents(input);
    return Object.freeze(events.map((event) => this.appendTimeline(event)));
  }

  /**
   * Records fallback expiry in the timeline.
   *
   * @param {unknown} input
   * @returns {ReturnType<typeof createTimelineEvent>}
   */
  recordFallbackExpiry(input) {
    return this.appendTimeline(createFallbackExpiryEvent(input));
  }

  /**
   * Marks an existing alert as acknowledged without changing its ordering.
   *
   * @param {string} alertId
   * @returns {ReturnType<typeof createAlert>|null}
   */
  acknowledgeAlert(alertId) {
    const validAlertId = requireId(alertId, 'alertId');
    const existing = this.alerts.find(
      (alert) => alert.id === validAlertId,
    );

    if (existing === undefined) {
      return null;
    }

    if (existing.acknowledged) {
      return existing;
    }

    const acknowledgedAlert = createAlert({
      ...existing,
      acknowledged: true,
    });

    this.alerts = upsertBounded(
      this.alerts,
      acknowledgedAlert,
      (alert) => alert.id,
      MAX_RECORDS,
    );

    return acknowledgedAlert;
  }

  /**
   * Returns incidents in oldest-to-newest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createIncidentEvent>>}
   */
  getIncidents() {
    return this.incidents;
  }

  /**
   * Returns alerts in oldest-to-newest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createAlert>>}
   */
  getAlerts() {
    return this.alerts;
  }

  /**
   * Returns timeline events in oldest-to-newest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createTimelineEvent>>}
   */
  getTimeline() {
    return this.timeline;
  }

  /**
   * Returns incidents in newest-to-oldest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createIncidentEvent>>}
   */
  getRecentIncidents() {
    return Object.freeze([...this.incidents].reverse());
  }

  /**
   * Returns alerts in newest-to-oldest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createAlert>>}
   */
  getRecentAlerts() {
    return Object.freeze([...this.alerts].reverse());
  }

  /**
   * Returns timeline events in newest-to-oldest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createTimelineEvent>>}
   */
  getRecentTimeline() {
    return Object.freeze([...this.timeline].reverse());
  }

  /**
   * Returns an alert by its identifier.
   *
   * @param {string} alertId
   * @returns {ReturnType<typeof createAlert>|null}
   */
  getAlertById(alertId) {
    const validAlertId = requireId(alertId, 'alertId');

    return (
      this.alerts.find((alert) => alert.id === validAlertId) ?? null
    );
  }

  /**
   * Returns an incident by event identifier.
   *
   * @param {string} eventId
   * @returns {ReturnType<typeof createIncidentEvent>|null}
   */
  getIncidentById(eventId) {
    const validEventId = requireId(eventId, 'eventId');

    return (
      this.incidents.find(
        (incident) => incident.eventId === validEventId,
      ) ?? null
    );
  }

  /**
   * Removes all observability records and deduplication state.
   *
   * @returns {void}
   */
  clear() {
    this.incidents = Object.freeze([]);
    this.alerts = Object.freeze([]);
    this.timeline = Object.freeze([]);
    this.eventIds.clear();
  }

  /**
   * Alias for clearing all browser-local observability records.
   *
   * @returns {void}
   */
  reset() {
    this.clear();
  }

  /**
   * Retains deduplication identifiers only while their bounded records remain.
   *
   * @returns {void}
   */
  pruneEventIds() {
    this.eventIds = new Set([
      ...this.incidents.map((incident) => incident.eventId),
      ...this.timeline.map((event) => event.eventId),
    ]);
  }
}

export default IncidentRepository;