import {
  useCallback,
  useMemo,
  useReducer,
} from 'react';
import {
  INITIAL_SESSION_STATE,
  clearSession as createClearSessionAction,
  createSession as createSessionAction,
  sessionReducer,
  signUp as createSignUpAction,
  useDemoAccount as createUseDemoAccountAction,
} from '../session/sessionReducer.js';
import { onSessionCleared } from '../engine/ResilienceLifecycleHooks.js';

/**
 * @param {unknown} engine
 * @returns {{start: Function, resetDemo: Function, stop: Function}|null}
 */
function resolveEngine(engine) {
  if (engine === undefined || engine === null) {
    return null;
  }

  if (
    typeof engine !== 'object' ||
    typeof engine.start !== 'function' ||
    typeof engine.resetDemo !== 'function' ||
    typeof engine.stop !== 'function'
  ) {
    throw new TypeError(
      'engine must provide start, resetDemo, and stop methods',
    );
  }

  return engine;
}

/**
 * Manages a browser-memory-only mock session. Credential inputs are passed
 * directly to the reducer and are never retained in returned session state.
 * Clearing a session also resets and stops the optional resilience engine.
 *
 * @param {unknown} [engine]
 * @returns {{
 *   session: object|null,
 *   error: object|null,
 *   fieldErrors: Readonly<Record<string, string>>,
 *   createSession: (input: unknown, metadata?: object) => void,
 *   login: (input: unknown, metadata?: object) => void,
 *   signUp: (input: unknown, metadata?: object) => void,
 *   useDemoAccount: (role: unknown, metadata?: object) => void,
 *   clearSession: () => unknown,
 *   logout: () => unknown
 * }}
 */
export function useMockSession(engine) {
  const sessionEngine = resolveEngine(engine);
  const [state, dispatch] = useReducer(
    sessionReducer,
    INITIAL_SESSION_STATE,
  );

  const createSession = useCallback((input, metadata = {}) => {
    dispatch(createSessionAction(input, metadata));
  }, []);

  const signUp = useCallback((input, metadata = {}) => {
    dispatch(createSignUpAction(input, metadata));
  }, []);

  const useDemoAccount = useCallback((role, metadata = {}) => {
    dispatch(createUseDemoAccountAction(role, metadata));
  }, []);

  const clearSession = useCallback(() => {
    let cleanupResult;

    try {
      if (sessionEngine !== null) {
        cleanupResult = onSessionCleared(sessionEngine);
      }
    } finally {
      dispatch(createClearSessionAction());
    }

    return cleanupResult;
  }, [sessionEngine]);

  return useMemo(
    () =>
      Object.freeze({
        session: state.session,
        error: state.error,
        fieldErrors: state.fieldErrors,
        createSession,
        login: createSession,
        signUp,
        useDemoAccount,
        clearSession,
        logout: clearSession,
      }),
    [
      clearSession,
      createSession,
      signUp,
      state.error,
      state.fieldErrors,
      state.session,
      useDemoAccount,
    ],
  );
}

export default useMockSession;