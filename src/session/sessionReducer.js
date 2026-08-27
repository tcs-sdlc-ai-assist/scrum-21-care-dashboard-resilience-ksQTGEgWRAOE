import {
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from '../constants/messages.js';
import { getDemoAccountInput } from '../fixtures/demoAccounts.js';
import { REFERENCE_TIMESTAMP } from '../utils/clock.js';
import { maskEmail } from '../utils/privacy.js';

export const SESSION_ACTIONS = Object.freeze({
  CREATE_SESSION: 'CREATE_SESSION',
  SIGN_UP: 'SIGN_UP',
  USE_DEMO_ACCOUNT: 'USE_DEMO_ACCOUNT',
  CLEAR_SESSION: 'CLEAR_SESSION',
});

export const SESSION_ACTION_TYPES = SESSION_ACTIONS;

const EMPTY_FIELD_ERRORS = Object.freeze({});

export const INITIAL_SESSION_STATE = Object.freeze({
  session: null,
  error: null,
  fieldErrors: EMPTY_FIELD_ERRORS,
});

export const initialSessionState = INITIAL_SESSION_STATE;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

const SUPPORTED_ROLES = Object.freeze({
  clinical: 'clinical',
  CARE_TEAM: 'clinical',
  sre: 'sre',
  SRE: 'sre',
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} role
 * @returns {'clinical'|'sre'|null}
 */
function normalizeRole(role) {
  if (typeof role !== 'string') {
    return null;
  }

  return SUPPORTED_ROLES[role] ?? null;
}

/**
 * Validates mock sign-in input without returning credential values.
 *
 * @param {unknown} input
 * @returns {Readonly<Record<string, string>>}
 */
export function validateSessionInput(input) {
  const value = isPlainObject(input) ? input : {};
  const errors = {};
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const password =
    typeof value.password === 'string' ? value.password : '';

  if (email.length === 0) {
    errors.email = VALIDATION_MESSAGES.emailRequired;
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.email = VALIDATION_MESSAGES.emailTooLong;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = VALIDATION_MESSAGES.emailInvalid;
  }

  if (password.length === 0) {
    errors.password = VALIDATION_MESSAGES.passwordRequired;
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = VALIDATION_MESSAGES.passwordTooShort;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = VALIDATION_MESSAGES.passwordTooLong;
  }

  if (
    value.role === undefined ||
    value.role === null ||
    value.role === ''
  ) {
    errors.role = VALIDATION_MESSAGES.roleRequired;
  } else if (normalizeRole(value.role) === null) {
    errors.role = VALIDATION_MESSAGES.invalidRole;
  }

  return Object.freeze(errors);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function resolveCreatedAt(value) {
  if (Number.isSafeInteger(value) && value >= 0) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp) && timestamp >= 0) {
      return new Date(timestamp).toISOString();
    }
  }

  return new Date(REFERENCE_TIMESTAMP).toISOString();
}

/**
 * @param {unknown} value
 * @param {'clinical'|'sre'} role
 * @returns {string}
 */
function resolveSessionId(value, role) {
  if (typeof value === 'string' && SESSION_ID_PATTERN.test(value)) {
    return value;
  }

  return `SESSION-DEMO-${role === 'clinical' ? 'CARE-TEAM' : 'SRE'}`;
}

/**
 * @param {unknown} input
 * @param {unknown} metadata
 * @returns {Readonly<{
 *   sessionId: string,
 *   role: 'clinical'|'sre',
 *   emailLabel: string,
 *   createdAt: string
 * }>|null}
 */
function buildSession(input, metadata) {
  if (!isPlainObject(input)) {
    return null;
  }

  const role = normalizeRole(input.role);

  if (role === null || typeof input.email !== 'string') {
    return null;
  }

  const options = isPlainObject(metadata) ? metadata : {};

  return Object.freeze({
    sessionId: resolveSessionId(options.sessionId, role),
    role,
    emailLabel: maskEmail(input.email.trim()),
    createdAt: resolveCreatedAt(options.createdAt),
  });
}

/**
 * @param {Readonly<Record<string, string>>} fieldErrors
 * @param {Readonly<{session: object|null}>} state
 * @returns {Readonly<{
 *   session: object|null,
 *   error: Readonly<{code: string, message: string}>,
 *   fieldErrors: Readonly<Record<string, string>>
 * }>}
 */
function createValidationState(fieldErrors, state) {
  return Object.freeze({
    session: state.session ?? null,
    error: Object.freeze({
      code: 'VALIDATION_ERROR',
      message: ERROR_MESSAGES.VALIDATION_ERROR,
    }),
    fieldErrors,
  });
}

/**
 * @param {unknown} input
 * @param {unknown} metadata
 * @param {Readonly<{session: object|null}>} state
 * @returns {Readonly<{
 *   session: object|null,
 *   error: Readonly<{code: string, message: string}>|null,
 *   fieldErrors: Readonly<Record<string, string>>
 * }>}
 */
function reduceSessionCreation(input, metadata, state) {
  const fieldErrors = validateSessionInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return createValidationState(fieldErrors, state);
  }

  const session = buildSession(input, metadata);

  if (session === null) {
    return Object.freeze({
      session: state.session ?? null,
      error: Object.freeze({
        code: 'SESSION_UNAVAILABLE',
        message: ERROR_MESSAGES.SESSION_UNAVAILABLE,
      }),
      fieldErrors: EMPTY_FIELD_ERRORS,
    });
  }

  return Object.freeze({
    session,
    error: null,
    fieldErrors: EMPTY_FIELD_ERRORS,
  });
}

/**
 * Pure reducer for browser-local mock session state. Credentials are consumed
 * only from the current action and are never copied into returned state.
 *
 * @param {Readonly<{
 *   session: object|null,
 *   error: object|null,
 *   fieldErrors: Readonly<Record<string, string>>
 * }>|undefined} state
 * @param {unknown} action
 * @returns {Readonly<{
 *   session: object|null,
 *   error: object|null,
 *   fieldErrors: Readonly<Record<string, string>>
 * }>}
 */
export function sessionReducer(state = INITIAL_SESSION_STATE, action) {
  const currentState = isPlainObject(state)
    ? state
    : INITIAL_SESSION_STATE;

  if (!isPlainObject(action) || typeof action.type !== 'string') {
    return currentState;
  }

  switch (action.type) {
    case SESSION_ACTIONS.CREATE_SESSION:
    case SESSION_ACTIONS.SIGN_UP:
      return reduceSessionCreation(
        action.payload,
        action.meta,
        currentState,
      );

    case SESSION_ACTIONS.USE_DEMO_ACCOUNT: {
      const roleValue = isPlainObject(action.payload)
        ? action.payload.role
        : action.payload;
      const account = getDemoAccountInput(roleValue);

      if (account === null) {
        const fieldErrors = Object.freeze({
          role:
            roleValue === undefined || roleValue === null || roleValue === ''
              ? VALIDATION_MESSAGES.roleRequired
              : VALIDATION_MESSAGES.invalidRole,
        });

        return createValidationState(fieldErrors, currentState);
      }

      return reduceSessionCreation(account, action.meta, currentState);
    }

    case SESSION_ACTIONS.CLEAR_SESSION:
      return INITIAL_SESSION_STATE;

    default:
      return currentState;
  }
}

/**
 * @param {unknown} input
 * @param {{sessionId?: string, createdAt?: string|number}} [metadata]
 * @returns {Readonly<{
 *   type: 'CREATE_SESSION',
 *   payload: Readonly<Record<string, unknown>>,
 *   meta: Readonly<Record<string, unknown>>
 * }>}
 */
export function createSession(input, metadata = {}) {
  const value = isPlainObject(input) ? input : {};

  return Object.freeze({
    type: SESSION_ACTIONS.CREATE_SESSION,
    payload: Object.freeze({
      email: value.email,
      password: value.password,
      role: value.role,
    }),
    meta: Object.freeze(isPlainObject(metadata) ? { ...metadata } : {}),
  });
}

/**
 * @param {unknown} input
 * @param {{sessionId?: string, createdAt?: string|number}} [metadata]
 * @returns {Readonly<{
 *   type: 'SIGN_UP',
 *   payload: Readonly<Record<string, unknown>>,
 *   meta: Readonly<Record<string, unknown>>
 * }>}
 */
export function signUp(input, metadata = {}) {
  const value = isPlainObject(input) ? input : {};

  return Object.freeze({
    type: SESSION_ACTIONS.SIGN_UP,
    payload: Object.freeze({
      email: value.email,
      password: value.password,
      role: value.role,
    }),
    meta: Object.freeze(isPlainObject(metadata) ? { ...metadata } : {}),
  });
}

/**
 * @param {unknown} role
 * @param {{sessionId?: string, createdAt?: string|number}} [metadata]
 * @returns {Readonly<{
 *   type: 'USE_DEMO_ACCOUNT',
 *   payload: Readonly<{role: unknown}>,
 *   meta: Readonly<Record<string, unknown>>
 * }>}
 */
export function useDemoAccount(role, metadata = {}) {
  return Object.freeze({
    type: SESSION_ACTIONS.USE_DEMO_ACCOUNT,
    payload: Object.freeze({ role }),
    meta: Object.freeze(isPlainObject(metadata) ? { ...metadata } : {}),
  });
}

/**
 * @returns {Readonly<{type: 'CLEAR_SESSION'}>}
 */
export function clearSession() {
  return Object.freeze({
    type: SESSION_ACTIONS.CLEAR_SESSION,
  });
}

export default sessionReducer;