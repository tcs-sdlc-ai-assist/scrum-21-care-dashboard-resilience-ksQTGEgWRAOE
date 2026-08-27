import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  APP_MESSAGES,
  AUTH_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
  VALIDATION_MESSAGES,
} from '../../constants/messages.js';
import RoleSelector from './RoleSelector.jsx';

const EMPTY_VALUES = Object.freeze({
  email: '',
  password: '',
  role: '',
});

const EMPTY_FIELD_ERRORS = Object.freeze({});

/**
 * Renders a controlled browser-local login or signup form. Submission is
 * intercepted and passed to the supplied callback without native navigation
 * or network activity.
 *
 * When `values` is omitted, the component controls its own transient input
 * values. Credentials are never logged or persisted by this component.
 *
 * @param {{
 *   mode?: 'login'|'signup',
 *   values?: {
 *     email?: string,
 *     password?: string,
 *     role?: ''|'clinical'|'sre'
 *   },
 *   initialValues?: {
 *     email?: string,
 *     password?: string,
 *     role?: ''|'clinical'|'sre'
 *   },
 *   onChange?: (values: {
 *     email: string,
 *     password: string,
 *     role: ''|'clinical'|'sre'
 *   }) => void,
 *   onSubmit: (values: {
 *     email: string,
 *     password: string,
 *     role: ''|'clinical'|'sre'
 *   }) => void,
 *   onUseDemoAccount: (role: 'clinical'|'sre') => void,
 *   fieldErrors?: {
 *     email?: string,
 *     password?: string,
 *     role?: string
 *   },
 *   error?: string,
 *   disabled?: boolean,
 *   loading?: boolean,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function MockAuthForm({
  mode = 'login',
  values = undefined,
  initialValues = EMPTY_VALUES,
  onChange = undefined,
  onSubmit,
  onUseDemoAccount,
  fieldErrors = EMPTY_FIELD_ERRORS,
  error = '',
  disabled = false,
  loading = false,
  className = '',
}) {
  const generatedId = useId();
  const errorSummaryRef = useRef(null);
  const submittedRef = useRef(false);
  const [localValues, setLocalValues] = useState(() => ({
    email: initialValues.email ?? '',
    password: initialValues.password ?? '',
    role: initialValues.role ?? '',
  }));

  const currentValues = values === undefined
    ? localValues
    : {
        email: values.email ?? '',
        password: values.password ?? '',
        role: values.role ?? '',
      };

  const emailId = `${generatedId}-email`;
  const emailHintId = `${generatedId}-email-hint`;
  const emailErrorId = `${generatedId}-email-error`;
  const passwordId = `${generatedId}-password`;
  const passwordHintId = `${generatedId}-password-hint`;
  const passwordErrorId = `${generatedId}-password-error`;
  const summaryId = `${generatedId}-error-summary`;

  const emailError = fieldErrors.email ?? '';
  const passwordError = fieldErrors.password ?? '';
  const roleError = fieldErrors.role ?? '';
  const hasErrors =
    error.length > 0 ||
    emailError.length > 0 ||
    passwordError.length > 0 ||
    roleError.length > 0;
  const controlsDisabled = disabled || loading;

  useEffect(() => {
    if (!submittedRef.current || !hasErrors) {
      return;
    }

    submittedRef.current = false;
    errorSummaryRef.current?.focus();
  }, [error, emailError, hasErrors, passwordError, roleError]);

  /**
   * @param {'email'|'password'|'role'} field
   * @param {string} value
   * @returns {void}
   */
  function updateField(field, value) {
    const nextValues = {
      ...currentValues,
      [field]: value,
    };

    if (values === undefined) {
      setLocalValues(nextValues);
    }

    onChange?.(nextValues);
  }

  /**
   * @param {import('react').FormEvent<HTMLFormElement>} event
   * @returns {void}
   */
  function handleSubmit(event) {
    event.preventDefault();

    if (controlsDisabled) {
      return;
    }

    submittedRef.current = true;
    onSubmit({
      email: currentValues.email,
      password: currentValues.password,
      role: currentValues.role,
    });
  }

  /**
   * @param {'clinical'|'sre'} role
   * @returns {void}
   */
  function handleDemoAccount(role) {
    if (!controlsDisabled) {
      onUseDemoAccount(role);
    }
  }

  return (
    <form
      aria-describedby={`${generatedId}-boundary`}
      className={[
        'space-y-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      noValidate
      onSubmit={handleSubmit}
    >
      <div
        className="rounded-lg border border-care-300 bg-care-50 p-4 text-sm text-content dark:border-care-700 dark:bg-care-950 dark:text-care-100"
        id={`${generatedId}-boundary`}
        role="note"
      >
        <p className="font-semibold">
          {MOCK_BOUNDARY_MESSAGES.badge}
        </p>
        <p className="mt-1">
          {MOCK_BOUNDARY_MESSAGES.authentication}
        </p>
      </div>

      {hasErrors ? (
        <div
          aria-labelledby={`${summaryId}-title`}
          className="rounded-lg border border-status-critical-border bg-status-critical-surface p-4 text-status-critical"
          id={summaryId}
          ref={errorSummaryRef}
          role="alert"
          tabIndex="-1"
        >
          <h2
            className="font-semibold"
            id={`${summaryId}-title`}
          >
            {VALIDATION_MESSAGES.summaryTitle}
          </h2>

          {error.length > 0 ? (
            <p className="mt-2 text-sm">{error}</p>
          ) : null}

          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {emailError.length > 0 ? (
              <li>
                <a
                  className="underline decoration-2 underline-offset-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
                  href={`#${emailId}`}
                >
                  {emailError}
                </a>
              </li>
            ) : null}
            {passwordError.length > 0 ? (
              <li>
                <a
                  className="underline decoration-2 underline-offset-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
                  href={`#${passwordId}`}
                >
                  {passwordError}
                </a>
              </li>
            ) : null}
            {roleError.length > 0 ? <li>{roleError}</li> : null}
          </ul>
        </div>
      ) : null}

      <div>
        <label
          className="block text-sm font-semibold text-content dark:text-content-inverse"
          htmlFor={emailId}
        >
          {AUTH_MESSAGES.emailLabel}
          <span
            aria-hidden="true"
            className="ml-1 text-status-critical"
          >
            *
          </span>
        </label>
        <p
          className="mt-1 text-sm text-content-muted dark:text-slate-200"
          id={emailHintId}
        >
          {AUTH_MESSAGES.emailHint}
        </p>
        <input
          aria-describedby={[
            emailHintId,
            emailError.length > 0 ? emailErrorId : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={emailError.length > 0 ? 'true' : undefined}
          autoCapitalize="none"
          autoComplete="email"
          className={[
            'mt-2 min-h-touch w-full rounded-lg border bg-surface px-3 py-2 text-content shadow-sm',
            'focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'dark:bg-surface-inverse dark:text-content-inverse',
            emailError.length > 0
              ? 'border-status-critical-border'
              : 'border-slate-300 dark:border-slate-600',
          ].join(' ')}
          disabled={controlsDisabled}
          id={emailId}
          inputMode="email"
          maxLength="254"
          name="email"
          onChange={(event) =>
            updateField('email', event.target.value)
          }
          required
          type="email"
          value={currentValues.email}
        />
        {emailError.length > 0 ? (
          <p
            className="mt-2 text-sm font-semibold text-status-critical"
            id={emailErrorId}
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label
          className="block text-sm font-semibold text-content dark:text-content-inverse"
          htmlFor={passwordId}
        >
          {AUTH_MESSAGES.passwordLabel}
          <span
            aria-hidden="true"
            className="ml-1 text-status-critical"
          >
            *
          </span>
        </label>
        <p
          className="mt-1 text-sm text-content-muted dark:text-slate-200"
          id={passwordHintId}
        >
          {AUTH_MESSAGES.passwordHint}
        </p>
        <input
          aria-describedby={[
            passwordHintId,
            passwordError.length > 0 ? passwordErrorId : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={
            passwordError.length > 0 ? 'true' : undefined
          }
          autoComplete={
            mode === 'signup' ? 'new-password' : 'current-password'
          }
          className={[
            'mt-2 min-h-touch w-full rounded-lg border bg-surface px-3 py-2 text-content shadow-sm',
            'focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'dark:bg-surface-inverse dark:text-content-inverse',
            passwordError.length > 0
              ? 'border-status-critical-border'
              : 'border-slate-300 dark:border-slate-600',
          ].join(' ')}
          disabled={controlsDisabled}
          id={passwordId}
          maxLength="128"
          minLength="8"
          name="password"
          onChange={(event) =>
            updateField('password', event.target.value)
          }
          required
          type="password"
          value={currentValues.password}
        />
        {passwordError.length > 0 ? (
          <p
            className="mt-2 text-sm font-semibold text-status-critical"
            id={passwordErrorId}
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <RoleSelector
        disabled={controlsDisabled}
        error={roleError}
        name="role"
        onChange={(role) => updateField('role', role)}
        value={currentValues.role}
      />

      <button
        className="min-h-touch w-full rounded-lg bg-care-700 px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-care-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-care-200 dark:text-care-950 dark:hover:bg-care-100"
        disabled={controlsDisabled}
        type="submit"
      >
        {loading
          ? APP_MESSAGES.loading
          : mode === 'signup'
            ? AUTH_MESSAGES.signupAction
            : AUTH_MESSAGES.loginAction}
      </button>

      <fieldset
        className="rounded-panel border border-slate-300 p-4 dark:border-slate-600"
        disabled={controlsDisabled}
      >
        <legend className="px-2 text-sm font-semibold text-content dark:text-content-inverse">
          Synthetic demo accounts
        </legend>
        <p className="text-sm text-content-muted dark:text-slate-200">
          Choose a fixed fake account. No credentials are transmitted or
          stored.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            className="min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2.5 text-sm font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
            onClick={() => handleDemoAccount('clinical')}
            type="button"
          >
            {AUTH_MESSAGES.useCareTeamAccount}
          </button>
          <button
            className="min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2.5 text-sm font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
            onClick={() => handleDemoAccount('sre')}
            type="button"
          >
            {AUTH_MESSAGES.useSreAccount}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

MockAuthForm.propTypes = {
  mode: PropTypes.oneOf(['login', 'signup']),
  values: PropTypes.shape({
    email: PropTypes.string,
    password: PropTypes.string,
    role: PropTypes.oneOf(['', 'clinical', 'sre']),
  }),
  initialValues: PropTypes.shape({
    email: PropTypes.string,
    password: PropTypes.string,
    role: PropTypes.oneOf(['', 'clinical', 'sre']),
  }),
  onChange: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  onUseDemoAccount: PropTypes.func.isRequired,
  fieldErrors: PropTypes.shape({
    email: PropTypes.string,
    password: PropTypes.string,
    role: PropTypes.string,
  }),
  error: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
};

export default MockAuthForm;