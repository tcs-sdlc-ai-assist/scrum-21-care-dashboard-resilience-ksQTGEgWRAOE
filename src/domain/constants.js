export const REFERENCE_DATE = '2026-08-27';

export const DEPENDENCY_IDS = Object.freeze({
  PROFILE_PRIMARY: 'profile-primary',
  PROFILE_SECONDARY: 'profile-secondary',
  CONTEXT_ELIGIBILITY: 'context-eligibility',
});

export const DEPENDENCIES = Object.freeze([
  Object.freeze({
    id: DEPENDENCY_IDS.PROFILE_PRIMARY,
    displayName: 'Primary profile service',
  }),
  Object.freeze({
    id: DEPENDENCY_IDS.PROFILE_SECONDARY,
    displayName: 'Secondary profile service',
  }),
  Object.freeze({
    id: DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
    displayName: 'Context eligibility service',
  }),
]);

export const RESPONSE_CONDITIONS = Object.freeze({
  NORMAL: 'NORMAL',
  DEGRADED: 'DEGRADED',
  TIMEOUT: 'TIMEOUT',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  FAILURE: 'FAILURE',
});

export const HEALTH_STATES = Object.freeze({
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  TIMEOUT: 'TIMEOUT',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  FAILED: 'FAILED',
});

export const CIRCUIT_STATES = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

export const PROFILE_SOURCES = Object.freeze({
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
  FALLBACK: 'FALLBACK',
  NONE: 'NONE',
});

export const ROLES = Object.freeze({
  CARE_TEAM: 'CARE_TEAM',
  SRE: 'SRE',
});

export const SEVERITIES = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const RECOVERY_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  RECOVERED: 'RECOVERED',
});

export const MAX_RECORDS = 50;
export const MAX_PROFILES = 100;
export const MAX_ID_LENGTH = 128;
export const CIRCUIT_FAILURE_THRESHOLD = 3;

export const POLL_INTERVAL_MS = 30_000;
export const CIRCUIT_PROBE_DELAY_MS = 300_000;
export const FALLBACK_TTL_MS = 14_400_000;
export const FALLBACK_READ_TARGET_MS = 500;
export const SUBSCRIBER_NOTIFICATION_TARGET_MS = 3_000;

export const LIMITS = Object.freeze({
  MAX_RECORDS,
  MAX_PROFILES,
  MAX_ID_LENGTH,
  CIRCUIT_FAILURE_THRESHOLD,
});

export const TIMING = Object.freeze({
  POLL_INTERVAL_MS,
  CIRCUIT_PROBE_DELAY_MS,
  FALLBACK_TTL_MS,
  FALLBACK_READ_TARGET_MS,
  SUBSCRIBER_NOTIFICATION_TARGET_MS,
});

export const DOMAIN_ACTIONS = Object.freeze({
  SIMULATE_HEALTH: 'simulateHealth',
  REQUEST_PROFILE: 'requestProfile',
  SIMULATE_RECOVERY: 'simulateRecovery',
  ACKNOWLEDGE_ALERT: 'acknowledgeAlert',
  RESET_DEMO: 'resetDemo',
  EXPIRE_FALLBACK: 'expireFallback',
});