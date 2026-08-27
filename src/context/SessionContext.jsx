import {
  createContext,
  useContext,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import { useMockSession } from '../hooks/useMockSession.js';

export const SessionContext = createContext(undefined);
SessionContext.displayName = 'SessionContext';

/**
 * Provides one browser-memory-only mock session instance to the route tree.
 * Role and session activity values are navigation conveniences only and do
 * not represent authentication, authorization, or a security boundary.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   engine?: {
 *     start: Function,
 *     resetDemo: Function,
 *     stop: Function
 *   }
 * }} props
 * @returns {import('react').ReactElement}
 */
export function SessionProvider({ children, engine = undefined }) {
  const mockSession = useMockSession(engine);

  const value = useMemo(() => {
    const role = mockSession.session?.role ?? null;
    const sessionActive = mockSession.session !== null;

    return Object.freeze({
      ...mockSession,
      role,
      sessionActive,
      hasSession: sessionActive,
    });
  }, [mockSession]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

SessionProvider.propTypes = {
  children: PropTypes.node.isRequired,
  engine: PropTypes.shape({
    start: PropTypes.func.isRequired,
    resetDemo: PropTypes.func.isRequired,
    stop: PropTypes.func.isRequired,
  }),
};

/**
 * Returns the shared browser-local mock session and session actions.
 *
 * @returns {{
 *   session: object|null,
 *   role: 'clinical'|'sre'|null,
 *   sessionActive: boolean,
 *   hasSession: boolean,
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
export function useSession() {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error(
      'useSession must be used within a SessionProvider',
    );
  }

  return context;
}

export default SessionProvider;