import {
  CIRCUIT_STATES,
  DEPENDENCIES,
  DEPENDENCY_IDS,
  DOMAIN_ACTIONS,
  HEALTH_STATES,
  MAX_ID_LENGTH,
  MAX_RECORDS,
  PROFILE_SOURCES,
  RECOVERY_STATUSES,
  REFERENCE_DATE,
  SEVERITIES,
} from './constants.js';

export const INCIDENT_TYPES = Object.freeze({
  FAILOVER: 'FAILOVER',
  FALLBACK_ACTIVATED: 'FALLBACK_ACTIVATED',
  RECOVERY: 'RECOVERY',
  EXPIRY: 'EXPIRY',
});

export const ALERT_CHANNELS = Object.freeze({
  MOCK_PAGERDUTY: 'MOCK_PAGERDUTY',
  MOCK_SLACK: 'MOCK_SLACK',
});

export const MODEL_VERSION = 1;

const DEPENDENCY_ID_VALUES = Object.freeze(Object.values(DEPENDENCY_IDS));
const HEALTH_STATE_VALUES = Object.freeze(Object.values(HEALTH_STATES));
const CIRCUIT_STATE_VALUES = Object.freeze(Object.values(CIRCUIT_STATES));
const PROFILE_SOURCE_VALUES = Object.freeze(Object.values(PROFILE_SOURCES));
const SEVERITY_VALUES = Object.freeze(Object.values(SEVERITIES));
const RECOVERY_STATUS_VALUES = Object.freeze(Object.values(RECOVERY_STATUSES));
const INCIDENT_TYPE_VALUES = Object.freeze(Object.values(INCIDENT_TYPES));
const ALERT_CHANNEL_VALUES = Object.freeze(Object.values(ALERT_CHANNELS));
const DOMAIN_ACTION_VALUES = Object.freeze(Object.values(DOMAIN_ACTIONS));

const PROFILE_ID_PATTERN = /^MOCK-[0-9]{4}$/;
const MASKED_ACCOUNT_PATTERN = /^\*{4}[0-9]{4}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const SAFE_DIAGNOSTIC_PATTERN = /^mock-record-MOCK-[0-9]{4}$/;
const SAFE_TEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ,.'():/_-]*$/;
const MAX_TEXT_LENGTH = 160;

/**
 * @typedef {'profile-primary'|'profile-secondary'|'context-eligibility'} DependencyId
 * @typedef {'HEALTHY'|'DEGRADED'|'TIMEOUT'|'INVALID_PAYLOAD'|'FAILED'} HealthStatus
 * @typedef {'CLOSED'|'OPEN'|'HALF_OPEN'} CircuitState
 * @typedef {'PRIMARY'|'SECONDARY'|'FALLBACK'|'NONE'} DataSource
 * @typedef {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} Severity
 * @typedef {'ACTIVE'|'RECOVERED'} RecoveryStatus
 * @typedef {'FAILOVER'|'FALLBACK_ACTIVATED'|'RECOVERY'|'EXPIRY'} IncidentType
 * @typedef {'MOCK_PAGERDUTY'|'MOCK_SLACK'} AlertChannel
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isBoundedId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    SAFE_ID_PATTERN.test(value)
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isProfileId(value) {
  return typeof value === 'string' && PROFILE_ID_PATTERN.test(value);
}

/**
 * @param {unknown} value
 * @returns {value is DependencyId}
 */
export function isDependencyId(value) {
  return DEPENDENCY_ID_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is HealthStatus}
 */
export function isHealthStatus(value) {
  return HEALTH_STATE_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is CircuitState}
 */
export function isCircuitState(value) {
  return CIRCUIT_STATE_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is DataSource}
 */
export function isDataSource(value) {
  return PROFILE_SOURCE_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is Severity}
 */
export function isSeverity(value) {
  return SEVERITY_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is RecoveryStatus}
 */
export function isRecoveryStatus(value) {
  return RECOVERY_STATUS_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is IncidentType}
 */
export function isIncidentType(value) {
  return INCIDENT_TYPE_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is AlertChannel}
 */
export function isAlertChannel(value) {
  return ALERT_CHANNEL_VALUES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isSafeText(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_TEXT_LENGTH &&
    SAFE_TEXT_PATTERN.test(value)
  );
}

/**
 * @param {boolean} condition
 * @param {string} message
 * @param {string} [field]
 * @returns {void}
 */
function assert(condition, message, field) {
  if (!condition) {
    const error = new TypeError(message);
    if (field) {
      error.field = field;
    }
    throw error;
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {Record<string, unknown>}
 */
function requireObject(value, field) {
  assert(isObject(value), `${field} must be an object`, field);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  assert(
    isBoundedId(value),
    `${field} must be a privacy-safe non-empty identifier no longer than ${MAX_ID_LENGTH} characters`,
    field,
  );
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireTimestamp(value, field) {
  assert(isTimestamp(value), `${field} must be a non-negative timestamp`, field);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireNonNegativeInteger(value, field) {
  assert(
    isNonNegativeInteger(value),
    `${field} must be a non-negative integer`,
    field,
  );
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireSafeText(value, field) {
  assert(
    isSafeText(value),
    `${field} must contain bounded privacy-safe text`,
    field,
  );
  return value;
}

/**
 * @param {unknown[]} records
 * @returns {ReadonlyArray<unknown>}
 */
function boundRecords(records) {
  return Object.freeze(records.slice(-MAX_RECORDS));
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   id: string,
 *   displayName: string,
 *   patientIdentifier: string,
 *   accountNumber: string,
 *   source: DataSource,
 *   generatedAt: number
 * }>}
 */
export function createMockProfile(input) {
  const value = requireObject(input, 'profile');
  const id = requireId(value.id, 'id');

  assert(
    isSafeText(value.displayName),
    'displayName must contain bounded synthetic text',
    'displayName',
  );
  assert(
    isProfileId(value.patientIdentifier),
    'patientIdentifier must match MOCK-####',
    'patientIdentifier',
  );
  assert(
    typeof value.accountNumber === 'string' &&
      MASKED_ACCOUNT_PATTERN.test(value.accountNumber),
    'accountNumber must be masked as ****####',
    'accountNumber',
  );
  assert(
    isDataSource(value.source) && value.source !== PROFILE_SOURCES.NONE,
    'source must be PRIMARY, SECONDARY, or FALLBACK',
    'source',
  );

  return Object.freeze({
    id,
    displayName: value.displayName,
    patientIdentifier: value.patientIdentifier,
    accountNumber: value.accountNumber,
    source: value.source,
    generatedAt: requireTimestamp(value.generatedAt, 'generatedAt'),
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   dependencyId: DependencyId,
 *   status: HealthStatus,
 *   latencyMs: number,
 *   failureCount: number,
 *   circuit: CircuitState,
 *   lastCheckedAt: number,
 *   consecutiveFailureCount: number,
 *   probeDueAt: number|null
 * }>}
 */
export function createDependencyState(input) {
  const value = requireObject(input, 'dependency');
  assert(
    isDependencyId(value.dependencyId),
    `dependencyId must be one of ${DEPENDENCY_ID_VALUES.join(', ')}`,
    'dependencyId',
  );
  assert(
    isHealthStatus(value.status),
    `status must be one of ${HEALTH_STATE_VALUES.join(', ')}`,
    'status',
  );
  assert(
    isCircuitState(value.circuit),
    `circuit must be one of ${CIRCUIT_STATE_VALUES.join(', ')}`,
    'circuit',
  );

  const probeDueAt =
    value.probeDueAt === null || value.probeDueAt === undefined
      ? null
      : requireTimestamp(value.probeDueAt, 'probeDueAt');

  return Object.freeze({
    dependencyId: value.dependencyId,
    status: value.status,
    latencyMs: requireNonNegativeInteger(value.latencyMs, 'latencyMs'),
    failureCount: requireNonNegativeInteger(
      value.failureCount,
      'failureCount',
    ),
    circuit: value.circuit,
    lastCheckedAt: requireTimestamp(value.lastCheckedAt, 'lastCheckedAt'),
    consecutiveFailureCount: requireNonNegativeInteger(
      value.consecutiveFailureCount,
      'consecutiveFailureCount',
    ),
    probeDueAt,
  });
}

/**
 * @param {DependencyId} dependencyId
 * @param {number} now
 * @returns {ReturnType<typeof createDependencyState>}
 */
export function createInitialDependencyState(dependencyId, now) {
  assert(
    isDependencyId(dependencyId),
    `dependencyId must be one of ${DEPENDENCY_ID_VALUES.join(', ')}`,
    'dependencyId',
  );

  return createDependencyState({
    dependencyId,
    status: HEALTH_STATES.HEALTHY,
    latencyMs: 0,
    failureCount: 0,
    circuit: CIRCUIT_STATES.CLOSED,
    lastCheckedAt: now,
    consecutiveFailureCount: 0,
    probeDueAt: null,
  });
}

/**
 * @param {number} now
 * @returns {ReadonlyArray<ReturnType<typeof createDependencyState>>}
 */
export function createInitialDependencies(now) {
  requireTimestamp(now, 'now');

  return Object.freeze(
    DEPENDENCIES.map((dependency) =>
      createInitialDependencyState(dependency.id, now),
    ),
  );
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   id: string,
 *   profileId: string,
 *   data: ReturnType<typeof createMockProfile>,
 *   createdAt: number,
 *   expiresAt: number,
 *   timerRevision: number
 * }>}
 */
export function createFallbackState(input) {
  const value = requireObject(input, 'fallback');
  const profileId = value.profileId;

  assert(isProfileId(profileId), 'profileId must match MOCK-####', 'profileId');

  const createdAt = requireTimestamp(value.createdAt, 'createdAt');
  const expiresAt = requireTimestamp(value.expiresAt, 'expiresAt');
  assert(expiresAt > createdAt, 'expiresAt must be after createdAt', 'expiresAt');

  const profile = createMockProfile(value.data);
  assert(
    profile.patientIdentifier === profileId,
    'fallback profile must belong to profileId',
    'data.patientIdentifier',
  );
  assert(
    profile.source === PROFILE_SOURCES.FALLBACK,
    'fallback profile source must be FALLBACK',
    'data.source',
  );

  return Object.freeze({
    id: requireId(value.id, 'id'),
    profileId,
    data: profile,
    createdAt,
    expiresAt,
    timerRevision: requireNonNegativeInteger(
      value.timerRevision,
      'timerRevision',
    ),
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   eventId: string,
 *   type: IncidentType,
 *   dependencyId: DependencyId,
 *   severity: Severity,
 *   condition: string,
 *   circuit: CircuitState,
 *   dataSource: DataSource,
 *   occurredAt: number,
 *   recoveryStatus: RecoveryStatus,
 *   diagnosticSummary: string
 * }>}
 */
export function createIncidentEvent(input) {
  const value = requireObject(input, 'incident');

  assert(
    isIncidentType(value.type),
    `type must be one of ${INCIDENT_TYPE_VALUES.join(', ')}`,
    'type',
  );
  assert(
    isDependencyId(value.dependencyId),
    `dependencyId must be one of ${DEPENDENCY_ID_VALUES.join(', ')}`,
    'dependencyId',
  );
  assert(
    isSeverity(value.severity),
    `severity must be one of ${SEVERITY_VALUES.join(', ')}`,
    'severity',
  );
  assert(
    isCircuitState(value.circuit),
    `circuit must be one of ${CIRCUIT_STATE_VALUES.join(', ')}`,
    'circuit',
  );
  assert(
    isDataSource(value.dataSource),
    `dataSource must be one of ${PROFILE_SOURCE_VALUES.join(', ')}`,
    'dataSource',
  );
  assert(
    isRecoveryStatus(value.recoveryStatus),
    `recoveryStatus must be one of ${RECOVERY_STATUS_VALUES.join(', ')}`,
    'recoveryStatus',
  );
  assert(
    typeof value.diagnosticSummary === 'string' &&
      SAFE_DIAGNOSTIC_PATTERN.test(value.diagnosticSummary),
    'diagnosticSummary must use mock-record-MOCK-####',
    'diagnosticSummary',
  );

  return Object.freeze({
    eventId: requireId(value.eventId, 'eventId'),
    type: value.type,
    dependencyId: value.dependencyId,
    severity: value.severity,
    condition: requireSafeText(value.condition, 'condition'),
    circuit: value.circuit,
    dataSource: value.dataSource,
    occurredAt: requireTimestamp(value.occurredAt, 'occurredAt'),
    recoveryStatus: value.recoveryStatus,
    diagnosticSummary: value.diagnosticSummary,
  });
}

/**
 * Timeline records share the privacy-safe incident event contract.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createIncidentEvent>}
 */
export function createTimelineEvent(input) {
  return createIncidentEvent(input);
}

/**
 * @param {string} profileId
 * @returns {string}
 */
export function createDiagnosticSummary(profileId) {
  assert(isProfileId(profileId), 'profileId must match MOCK-####', 'profileId');
  return `mock-record-${profileId}`;
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   id: string,
 *   incidentId: string,
 *   channel: AlertChannel,
 *   severity: Severity,
 *   title: string,
 *   createdAt: number,
 *   acknowledged: boolean
 * }>}
 */
export function createAlert(input) {
  const value = requireObject(input, 'alert');

  assert(
    isAlertChannel(value.channel),
    `channel must be one of ${ALERT_CHANNEL_VALUES.join(', ')}`,
    'channel',
  );
  assert(
    isSeverity(value.severity),
    `severity must be one of ${SEVERITY_VALUES.join(', ')}`,
    'severity',
  );
  assert(
    typeof value.acknowledged === 'boolean',
    'acknowledged must be a boolean',
    'acknowledged',
  );

  return Object.freeze({
    id: requireId(value.id, 'id'),
    incidentId: requireId(value.incidentId, 'incidentId'),
    channel: value.channel,
    severity: value.severity,
    title: requireSafeText(value.title, 'title'),
    createdAt: requireTimestamp(value.createdAt, 'createdAt'),
    acknowledged: value.acknowledged,
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   timestamp: number,
 *   dependencyId: DependencyId,
 *   status: HealthStatus,
 *   responseTimeMs: number,
 *   failureCount: number,
 *   circuit: CircuitState,
 *   dataSource: DataSource,
 *   incidentActivity: number
 * }>}
 */
export function createTelemetrySample(input) {
  const value = requireObject(input, 'telemetry');

  assert(
    isDependencyId(value.dependencyId),
    `dependencyId must be one of ${DEPENDENCY_ID_VALUES.join(', ')}`,
    'dependencyId',
  );
  assert(
    isHealthStatus(value.status),
    `status must be one of ${HEALTH_STATE_VALUES.join(', ')}`,
    'status',
  );
  assert(
    isCircuitState(value.circuit),
    `circuit must be one of ${CIRCUIT_STATE_VALUES.join(', ')}`,
    'circuit',
  );
  assert(
    isDataSource(value.dataSource),
    `dataSource must be one of ${PROFILE_SOURCE_VALUES.join(', ')}`,
    'dataSource',
  );

  return Object.freeze({
    timestamp: requireTimestamp(value.timestamp, 'timestamp'),
    dependencyId: value.dependencyId,
    status: value.status,
    responseTimeMs: requireNonNegativeInteger(
      value.responseTimeMs,
      'responseTimeMs',
    ),
    failureCount: requireNonNegativeInteger(
      value.failureCount,
      'failureCount',
    ),
    circuit: value.circuit,
    dataSource: value.dataSource,
    incidentActivity: requireNonNegativeInteger(
      value.incidentActivity,
      'incidentActivity',
    ),
  });
}

/**
 * @param {unknown} dependencies
 * @returns {ReadonlyArray<ReturnType<typeof createDependencyState>>}
 */
function createSnapshotDependencies(dependencies) {
  assert(
    Array.isArray(dependencies),
    'dependencies must be an array',
    'dependencies',
  );
  assert(
    dependencies.length === DEPENDENCY_ID_VALUES.length,
    `dependencies must contain exactly ${DEPENDENCY_ID_VALUES.length} records`,
    'dependencies',
  );

  const records = dependencies.map(createDependencyState);
  const ids = new Set(records.map((dependency) => dependency.dependencyId));

  assert(
    ids.size === DEPENDENCY_ID_VALUES.length &&
      DEPENDENCY_ID_VALUES.every((dependencyId) => ids.has(dependencyId)),
    'dependencies must contain each fixed dependency exactly once',
    'dependencies',
  );

  return Object.freeze(
    DEPENDENCY_ID_VALUES.map((dependencyId) =>
      records.find((dependency) => dependency.dependencyId === dependencyId),
    ),
  );
}

/**
 * @param {unknown} records
 * @param {(record: unknown) => unknown} factory
 * @param {string} field
 * @returns {ReadonlyArray<unknown>}
 */
function createRecordList(records, factory, field) {
  assert(Array.isArray(records), `${field} must be an array`, field);
  return boundRecords(records.map(factory));
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   version: 1,
 *   referenceDate: string,
 *   now: number,
 *   dependencies: ReadonlyArray<ReturnType<typeof createDependencyState>>,
 *   profileSource: DataSource,
 *   fallback: ReturnType<typeof createFallbackState>|null,
 *   alerts: ReadonlyArray<ReturnType<typeof createAlert>>,
 *   incidents: ReadonlyArray<ReturnType<typeof createIncidentEvent>>,
 *   telemetry: ReadonlyArray<ReturnType<typeof createTelemetrySample>>,
 *   lastEventId: string|null
 * }>}
 */
export function createSnapshot(input) {
  const value = requireObject(input, 'snapshot');

  assert(
    value.version === MODEL_VERSION,
    `version must be ${MODEL_VERSION}`,
    'version',
  );
  assert(
    value.referenceDate === REFERENCE_DATE,
    `referenceDate must be ${REFERENCE_DATE}`,
    'referenceDate',
  );
  assert(
    isDataSource(value.profileSource),
    `profileSource must be one of ${PROFILE_SOURCE_VALUES.join(', ')}`,
    'profileSource',
  );

  const fallback =
    value.fallback === null || value.fallback === undefined
      ? null
      : createFallbackState(value.fallback);
  const lastEventId =
    value.lastEventId === null || value.lastEventId === undefined
      ? null
      : requireId(value.lastEventId, 'lastEventId');

  return Object.freeze({
    version: MODEL_VERSION,
    referenceDate: REFERENCE_DATE,
    now: requireTimestamp(value.now, 'now'),
    dependencies: createSnapshotDependencies(value.dependencies),
    profileSource: value.profileSource,
    fallback,
    alerts: createRecordList(value.alerts, createAlert, 'alerts'),
    incidents: createRecordList(
      value.incidents,
      createIncidentEvent,
      'incidents',
    ),
    telemetry: createRecordList(
      value.telemetry,
      createTelemetrySample,
      'telemetry',
    ),
    lastEventId,
  });
}

/**
 * @param {number} now
 * @returns {ReturnType<typeof createSnapshot>}
 */
export function createInitialSnapshot(now) {
  return createSnapshot({
    version: MODEL_VERSION,
    referenceDate: REFERENCE_DATE,
    now,
    dependencies: createInitialDependencies(now),
    profileSource: PROFILE_SOURCES.NONE,
    fallback: null,
    alerts: [],
    incidents: [],
    telemetry: [],
    lastEventId: null,
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   eventId: string,
 *   dependencyId: DependencyId,
 *   status: HealthStatus,
 *   now: number,
 *   profileId: string,
 *   probe: boolean
 * }>}
 */
export function createTransitionInput(input) {
  const value = requireObject(input, 'transition');

  assert(
    isDependencyId(value.dependencyId),
    `dependencyId must be one of ${DEPENDENCY_ID_VALUES.join(', ')}`,
    'dependencyId',
  );
  assert(
    isHealthStatus(value.status),
    `status must be one of ${HEALTH_STATE_VALUES.join(', ')}`,
    'status',
  );
  assert(isProfileId(value.profileId), 'profileId must match MOCK-####', 'profileId');
  assert(typeof value.probe === 'boolean', 'probe must be a boolean', 'probe');

  return Object.freeze({
    eventId: requireId(value.eventId, 'eventId'),
    dependencyId: value.dependencyId,
    status: value.status,
    now: requireTimestamp(value.now, 'now'),
    profileId: value.profileId,
    probe: value.probe,
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   action: string,
 *   eventId: string,
 *   occurredAt: number,
 *   payload: Readonly<Record<string, string|number|boolean|null>>
 * }>}
 */
export function createCommand(input) {
  const value = requireObject(input, 'command');

  assert(
    DOMAIN_ACTION_VALUES.includes(value.action),
    `action must be one of ${DOMAIN_ACTION_VALUES.join(', ')}`,
    'action',
  );

  const payloadValue =
    value.payload === undefined ? {} : requireObject(value.payload, 'payload');
  const payload = {};

  Object.entries(payloadValue).forEach(([key, item]) => {
    assert(
      isBoundedId(key),
      'payload keys must be bounded privacy-safe identifiers',
      'payload',
    );
    assert(
      item === null ||
        typeof item === 'boolean' ||
        (typeof item === 'number' && Number.isFinite(item)) ||
        (typeof item === 'string' &&
          item.length <= MAX_ID_LENGTH &&
          SAFE_TEXT_PATTERN.test(item)),
      'payload values must be bounded privacy-safe primitives',
      `payload.${key}`,
    );
    payload[key] = item;
  });

  return Object.freeze({
    action: value.action,
    eventId: requireId(value.eventId, 'eventId'),
    occurredAt: requireTimestamp(value.occurredAt, 'occurredAt'),
    payload: Object.freeze(payload),
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   ok: true,
 *   eventId: string,
 *   snapshot: ReturnType<typeof createSnapshot>
 * }>}
 */
export function createCommandSuccess(input) {
  const value = requireObject(input, 'command result');

  return Object.freeze({
    ok: true,
    eventId: requireId(value.eventId, 'eventId'),
    snapshot: createSnapshot(value.snapshot),
  });
}

/**
 * @param {unknown} details
 * @returns {Readonly<Record<string, string|number|boolean|null>>|undefined}
 */
function createErrorDetails(details) {
  if (details === undefined) {
    return undefined;
  }

  const value = requireObject(details, 'details');
  const result = {};

  Object.entries(value).forEach(([key, item]) => {
    assert(
      isBoundedId(key),
      'detail keys must be bounded privacy-safe identifiers',
      'details',
    );
    assert(
      item === null ||
        typeof item === 'boolean' ||
        (typeof item === 'number' && Number.isFinite(item)) ||
        (typeof item === 'string' &&
          item.length <= MAX_TEXT_LENGTH &&
          SAFE_TEXT_PATTERN.test(item)),
      'detail values must be bounded privacy-safe primitives',
      `details.${key}`,
    );
    result[key] = item;
  });

  return Object.freeze(result);
}

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   ok: false,
 *   error: Readonly<{
 *     code: string,
 *     message: string,
 *     details?: Readonly<Record<string, string|number|boolean|null>>
 *   }>,
 *   snapshot: ReturnType<typeof createSnapshot>
 * }>}
 */
export function createCommandError(input) {
  const value = requireObject(input, 'command result');
  const errorValue = requireObject(value.error, 'error');

  assert(
    typeof errorValue.code === 'string' &&
      errorValue.code.length <= MAX_ID_LENGTH &&
      SAFE_CODE_PATTERN.test(errorValue.code),
    'error code must be an uppercase privacy-safe identifier',
    'error.code',
  );

  const details = createErrorDetails(errorValue.details);
  const error = {
    code: errorValue.code,
    message: requireSafeText(errorValue.message, 'error.message'),
  };

  if (details !== undefined) {
    error.details = details;
  }

  return Object.freeze({
    ok: false,
    error: Object.freeze(error),
    snapshot: createSnapshot(value.snapshot),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDependencyState(value) {
  try {
    createDependencyState(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFallbackState(value) {
  try {
    createFallbackState(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAlert(value) {
  try {
    createAlert(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIncidentEvent(value) {
  try {
    createIncidentEvent(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTelemetrySample(value) {
  try {
    createTelemetrySample(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSnapshot(value) {
  try {
    createSnapshot(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommandResult(value) {
  if (!isObject(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  try {
    if (value.ok) {
      createCommandSuccess(value);
    } else {
      createCommandError(value);
    }
    return true;
  } catch {
    return false;
  }
}