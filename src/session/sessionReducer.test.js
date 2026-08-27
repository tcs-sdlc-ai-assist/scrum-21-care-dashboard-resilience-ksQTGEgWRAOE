import {
  INITIAL_SESSION_STATE,
  SESSION_ACTIONS,
  clearSession,
  createSession,
  sessionReducer,
  signUp,
  useDemoAccount,
  validateSessionInput,
} from './sessionReducer.js';

const VALID_CLINICAL_INPUT = Object.freeze({
  email: 'clinical.staff@demo.example',
  password: 'not-a-real-password',
  role: 'clinical',
});

const VALID_SRE_INPUT = Object.freeze({
  email: 'sre@demo.example',
  password: 'not-a-real-password',
  role: 'sre',
});

describe('sessionReducer', () => {
  describe('session input validation', () => {
    it('accepts valid mock login input without returning credential values', () => {
      const errors = validateSessionInput(VALID_CLINICAL_INPUT);

      expect(errors).toEqual({});
      expect(Object.isFrozen(errors)).toBe(true);
      expect(errors).not.toHaveProperty('email');
      expect(errors).not.toHaveProperty('password');
    });

    it('returns field-associated errors for missing login values', () => {
      const errors = validateSessionInput({
        email: '',
        password: '',
        role: '',
      });

      expect(errors).toEqual({
        email: 'Enter an email address.',
        password: 'Enter a password.',
        role: 'Choose a demo role.',
      });
    });

    it.each([
      {
        name: 'malformed email',
        input: {
          email: 'not-an-email',
          password: 'not-a-real-password',
          role: 'clinical',
        },
        field: 'email',
        message: 'Enter an email address in a valid format.',
      },
      {
        name: 'email longer than 254 characters',
        input: {
          email: `${'a'.repeat(243)}@example.com`,
          password: 'not-a-real-password',
          role: 'clinical',
        },
        field: 'email',
        message: 'Email must be 254 characters or fewer.',
      },
      {
        name: 'password shorter than eight characters',
        input: {
          email: 'clinical.staff@demo.example',
          password: 'short',
          role: 'clinical',
        },
        field: 'password',
        message: 'Password must contain at least 8 characters.',
      },
      {
        name: 'password longer than 128 characters',
        input: {
          email: 'clinical.staff@demo.example',
          password: 'x'.repeat(129),
          role: 'clinical',
        },
        field: 'password',
        message: 'Password must contain no more than 128 characters.',
      },
      {
        name: 'unsupported role',
        input: {
          email: 'clinical.staff@demo.example',
          password: 'not-a-real-password',
          role: 'administrator',
        },
        field: 'role',
        message: 'Choose a supported demo role.',
      },
    ])('rejects $name with a safe field error', ({
      input,
      field,
      message,
    }) => {
      const errors = validateSessionInput(input);

      expect(errors).toHaveProperty(field, message);
      expect(JSON.stringify(errors)).not.toContain(input.password);
    });

    it('rejects non-object input without throwing or retaining input data', () => {
      expect(validateSessionInput(null)).toEqual({
        email: 'Enter an email address.',
        password: 'Enter a password.',
        role: 'Choose a demo role.',
      });
      expect(validateSessionInput('credentials')).toEqual({
        email: 'Enter an email address.',
        password: 'Enter a password.',
        role: 'Choose a demo role.',
      });
    });
  });

  describe('login and signup', () => {
    it('creates a minimal clinical mock session with a masked email label', () => {
      const action = createSession(VALID_CLINICAL_INPUT, {
        sessionId: 'SESSION-DEMO-TEST-1',
        createdAt: '2026-08-27T10:30:00.000Z',
      });

      const state = sessionReducer(INITIAL_SESSION_STATE, action);

      expect(state).toEqual({
        session: {
          sessionId: 'SESSION-DEMO-TEST-1',
          role: 'clinical',
          emailLabel: 'c***@d***.example',
          createdAt: '2026-08-27T10:30:00.000Z',
        },
        error: null,
        fieldErrors: {},
      });
      expect(Object.isFrozen(state)).toBe(true);
      expect(Object.isFrozen(state.session)).toBe(true);
    });

    it('creates an SRE mock signup session with deterministic metadata', () => {
      const action = signUp(VALID_SRE_INPUT, {
        sessionId: 'SESSION-DEMO-TEST-2',
        createdAt: Date.parse('2026-08-27T12:00:00.000Z'),
      });

      const state = sessionReducer(INITIAL_SESSION_STATE, action);

      expect(action.type).toBe(SESSION_ACTIONS.SIGN_UP);
      expect(state.session).toEqual({
        sessionId: 'SESSION-DEMO-TEST-2',
        role: 'sre',
        emailLabel: 's**@d***.example',
        createdAt: '2026-08-27T12:00:00.000Z',
      });
      expect(state.error).toBeNull();
      expect(state.fieldErrors).toEqual({});
    });

    it('normalizes supported uppercase role labels for mock view selection', () => {
      const clinicalState = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession({
          ...VALID_CLINICAL_INPUT,
          role: 'CARE_TEAM',
        }),
      );
      const sreState = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession({
          ...VALID_SRE_INPUT,
          role: 'SRE',
        }),
      );

      expect(clinicalState.session.role).toBe('clinical');
      expect(sreState.session.role).toBe('sre');
    });

    it('returns validation errors and does not create a session for invalid signup input', () => {
      const state = sessionReducer(
        INITIAL_SESSION_STATE,
        signUp({
          email: 'invalid',
          password: 'short',
          role: 'administrator',
        }),
      );

      expect(state.session).toBeNull();
      expect(state.error).toEqual({
        code: 'VALIDATION_ERROR',
        message:
          'Check the highlighted fields and correct the demo input.',
      });
      expect(state.fieldErrors).toEqual({
        email: 'Enter an email address in a valid format.',
        password: 'Password must contain at least 8 characters.',
        role: 'Choose a supported demo role.',
      });
    });

    it('never retains a password or raw email in returned session state', () => {
      const rawEmail = 'clinical.staff@demo.example';
      const rawPassword = 'not-a-real-password';
      const state = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession({
          email: rawEmail,
          password: rawPassword,
          role: 'clinical',
        }),
      );
      const serializedState = JSON.stringify(state);

      expect(state.session).not.toHaveProperty('password');
      expect(state.session).not.toHaveProperty('email');
      expect(serializedState).not.toContain(rawPassword);
      expect(serializedState).not.toContain(rawEmail);
      expect(state.session.emailLabel).toBe('c***@d***.example');
    });

    it('preserves the current mock session when a later login attempt is invalid', () => {
      const activeState = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession(VALID_CLINICAL_INPUT),
      );
      const invalidState = sessionReducer(
        activeState,
        createSession({
          email: 'invalid',
          password: '',
          role: '',
        }),
      );

      expect(invalidState.session).toBe(activeState.session);
      expect(invalidState.error?.code).toBe('VALIDATION_ERROR');
      expect(invalidState.fieldErrors).toEqual({
        email: 'Enter an email address in a valid format.',
        password: 'Enter a password.',
        role: 'Choose a demo role.',
      });
    });
  });

  describe('fixed demo accounts and mock boundary', () => {
    it.each([
      ['clinical', 'clinical', 'c***@d***.example'],
      ['sre', 'sre', 's**@d***.example'],
      ['CARE_TEAM', 'clinical', 'c***@d***.example'],
      ['SRE', 'sre', 's**@d***.example'],
    ])(
      'creates a browser-memory-only session for the %s demo account',
      (requestedRole, expectedRole, expectedEmailLabel) => {
        const state = sessionReducer(
          INITIAL_SESSION_STATE,
          useDemoAccount(requestedRole, {
            createdAt: '2026-08-27T00:00:00.000Z',
          }),
        );

        expect(state.session).toEqual({
          sessionId:
            expectedRole === 'clinical'
              ? 'SESSION-DEMO-CARE-TEAM'
              : 'SESSION-DEMO-SRE',
          role: expectedRole,
          emailLabel: expectedEmailLabel,
          createdAt: '2026-08-27T00:00:00.000Z',
        });
        expect(state.error).toBeNull();
      },
    );

    it('rejects an unsupported demo account role without creating a session', () => {
      const state = sessionReducer(
        INITIAL_SESSION_STATE,
        useDemoAccount('administrator'),
      );

      expect(state.session).toBeNull();
      expect(state.error?.code).toBe('VALIDATION_ERROR');
      expect(state.fieldErrors).toEqual({
        role: 'Choose a supported demo role.',
      });
    });

    it('stores role selection as presentation metadata without security claims', () => {
      const state = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession(VALID_CLINICAL_INPUT),
      );

      expect(Object.keys(state.session)).toEqual([
        'sessionId',
        'role',
        'emailLabel',
        'createdAt',
      ]);
      expect(state.session).not.toHaveProperty('token');
      expect(state.session).not.toHaveProperty('authenticated');
      expect(state.session).not.toHaveProperty('authorized');
      expect(state.session).not.toHaveProperty('permissions');
      expect(state.session).not.toHaveProperty('claims');
    });
  });

  describe('logout and reducer safety', () => {
    it('clears the entire in-memory mock session on logout', () => {
      const activeState = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession(VALID_SRE_INPUT),
      );
      const clearedState = sessionReducer(
        activeState,
        clearSession(),
      );

      expect(clearedState).toBe(INITIAL_SESSION_STATE);
      expect(clearedState).toEqual({
        session: null,
        error: null,
        fieldErrors: {},
      });
    });

    it('ignores unknown or malformed actions without changing state', () => {
      const activeState = sessionReducer(
        INITIAL_SESSION_STATE,
        createSession(VALID_CLINICAL_INPUT),
      );

      expect(
        sessionReducer(activeState, {
          type: 'GRANT_ADMIN_ACCESS',
        }),
      ).toBe(activeState);
      expect(sessionReducer(activeState, null)).toBe(activeState);
    });
  });
});