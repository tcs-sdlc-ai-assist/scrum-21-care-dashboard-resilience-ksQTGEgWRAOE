import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import MockAuthForm from '../components/auth/MockAuthForm.jsx';
import DemoNotice from '../components/shared/DemoNotice.jsx';
import {
  APP_MESSAGES,
  AUTH_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../constants/messages.js';
import { useSession } from '../context/SessionContext.jsx';

const FORM_MODES = Object.freeze(['login', 'signup']);

const EMPTY_VALUES = Object.freeze({
  email: '',
  password: '',
  role: '',
});

/**
 * Resolves the dashboard route for a supported mock session role.
 *
 * @param {unknown} role
 * @returns {string|null}
 */
function getRoleRoute(role) {
  if (role === 'clinical' || role === 'CARE_TEAM') {
    return '/clinical';
  }

  if (role === 'sre' || role === 'SRE') {
    return '/sre';
  }

  return null;
}

/**
 * Browser-local mock login and signup page. Credential values remain in
 * component memory only and are never transmitted, persisted, logged, or
 * placed in a URL.
 *
 * @param {{
 *   initialMode?: 'login'|'signup',
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function AuthView({
  initialMode = 'login',
  className = '',
}) {
  const generatedId = useId();
  const navigate = useNavigate();
  const {
    session,
    error,
    fieldErrors,
    login,
    signUp,
    useDemoAccount,
  } = useSession();
  const tabRefs = useRef({});
  const [mode, setMode] = useState(initialMode);
  const [attemptedMode, setAttemptedMode] = useState(null);
  const [values, setValues] = useState(EMPTY_VALUES);

  const destination = getRoleRoute(session?.role);
  const loginTabId = `${generatedId}-login-tab`;
  const signupTabId = `${generatedId}-signup-tab`;
  const panelId = `${generatedId}-${mode}-panel`;
  const activeTabId =
    mode === 'login' ? loginTabId : signupTabId;
  const showValidation = attemptedMode === mode;
  const visibleError =
    showValidation && typeof error?.message === 'string'
      ? error.message
      : '';
  const visibleFieldErrors = showValidation
    ? fieldErrors
    : undefined;

  useEffect(() => {
    if (destination !== null) {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate]);

  /**
   * @param {'login'|'signup'} nextMode
   * @returns {void}
   */
  function selectMode(nextMode) {
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setAttemptedMode(null);
    setValues((currentValues) => ({
      ...currentValues,
      password: '',
    }));
  }

  /**
   * @param {import('react').KeyboardEvent<HTMLDivElement>} event
   * @returns {void}
   */
  function handleTabKeyDown(event) {
    const currentIndex = FORM_MODES.indexOf(mode);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % FORM_MODES.length;
    } else if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp'
    ) {
      nextIndex =
        (currentIndex - 1 + FORM_MODES.length) %
        FORM_MODES.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = FORM_MODES.length - 1;
    } else {
      return;
    }

    event.preventDefault();

    const nextMode = FORM_MODES[nextIndex];
    selectMode(nextMode);
    tabRefs.current[nextMode]?.focus();
  }

  /**
   * @param {{
   *   email: string,
   *   password: string,
   *   role: ''|'clinical'|'sre'
   * }} nextValues
   * @returns {void}
   */
  function handleValuesChange(nextValues) {
    setValues(nextValues);
  }

  /**
   * @param {{
   *   email: string,
   *   password: string,
   *   role: ''|'clinical'|'sre'
   * }} submittedValues
   * @returns {void}
   */
  function handleSubmit(submittedValues) {
    setAttemptedMode(mode);

    if (mode === 'signup') {
      signUp(submittedValues);
      return;
    }

    login(submittedValues);
  }

  /**
   * @param {'clinical'|'sre'} role
   * @returns {void}
   */
  function handleDemoAccount(role) {
    setAttemptedMode(mode);
    useDemoAccount(role);
  }

  if (destination !== null) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-content dark:bg-canvas-inverse dark:text-content-inverse"
        id="main-content"
      >
        <div
          aria-atomic="true"
          aria-live="polite"
          className="rounded-panel border border-care-300 bg-surface p-6 text-center shadow-panel dark:border-care-700 dark:bg-surface-inverse"
          role="status"
        >
          <p className="font-semibold">{APP_MESSAGES.ready}</p>
          <p className="mt-2 text-sm text-content-muted dark:text-slate-200">
            Opening the selected browser-local dashboard…
          </p>
        </div>
      </main>
    );
  }

  return (
    <div
      className={[
        'min-h-screen bg-canvas text-content dark:bg-canvas-inverse dark:text-content-inverse',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <a
        className="sr-only z-50 rounded-lg bg-care-700 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 dark:bg-care-200 dark:text-care-950"
        href="#main-content"
      >
        {APP_MESSAGES.skipToContent}
      </a>

      <DemoNotice />

      <main
        className="mx-auto flex w-full max-w-dashboard items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
        id="main-content"
        tabIndex="-1"
      >
        <section
          aria-labelledby={`${generatedId}-title`}
          className="w-full max-w-2xl overflow-hidden rounded-panel border border-slate-300 bg-surface shadow-elevated dark:border-slate-700 dark:bg-surface-inverse"
        >
          <header className="border-b border-slate-200 px-4 py-6 text-center dark:border-slate-700 sm:px-8">
            <span
              aria-hidden="true"
              className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-lg bg-care-700 text-2xl font-bold text-white dark:bg-care-200 dark:text-care-950"
            >
              +
            </span>

            <h1
              className="mt-4 text-2xl font-bold text-content dark:text-content-inverse sm:text-3xl"
              id={`${generatedId}-title`}
            >
              {AUTH_MESSAGES.title}
            </h1>

            <p className="mx-auto mt-2 max-w-prose text-content-muted dark:text-slate-200">
              {AUTH_MESSAGES.subtitle}
            </p>
          </header>

          <div className="px-4 py-6 sm:px-8 sm:py-8">
            <div
              aria-label="Choose demo session form"
              className="grid grid-cols-2 rounded-lg border border-slate-300 bg-canvas-muted p-1 dark:border-slate-600 dark:bg-slate-800"
              onKeyDown={handleTabKeyDown}
              role="tablist"
            >
              <button
                aria-controls={`${generatedId}-login-panel`}
                aria-selected={mode === 'login'}
                className={[
                  'min-h-touch rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-fast',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
                  mode === 'login'
                    ? 'bg-surface text-care-800 shadow-sm dark:bg-surface-inverse dark:text-care-100'
                    : 'text-content-muted hover:bg-surface hover:text-content dark:text-slate-200 dark:hover:bg-surface-inverse dark:hover:text-content-inverse',
                ].join(' ')}
                id={loginTabId}
                onClick={() => selectMode('login')}
                ref={(node) => {
                  tabRefs.current.login = node;
                }}
                role="tab"
                tabIndex={mode === 'login' ? 0 : -1}
                type="button"
              >
                {AUTH_MESSAGES.loginTab}
              </button>

              <button
                aria-controls={`${generatedId}-signup-panel`}
                aria-selected={mode === 'signup'}
                className={[
                  'min-h-touch rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-fast',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
                  mode === 'signup'
                    ? 'bg-surface text-care-800 shadow-sm dark:bg-surface-inverse dark:text-care-100'
                    : 'text-content-muted hover:bg-surface hover:text-content dark:text-slate-200 dark:hover:bg-surface-inverse dark:hover:text-content-inverse',
                ].join(' ')}
                id={signupTabId}
                onClick={() => selectMode('signup')}
                ref={(node) => {
                  tabRefs.current.signup = node;
                }}
                role="tab"
                tabIndex={mode === 'signup' ? 0 : -1}
                type="button"
              >
                {AUTH_MESSAGES.signupTab}
              </button>
            </div>

            <div
              aria-labelledby={activeTabId}
              className="mt-6"
              id={panelId}
              role="tabpanel"
              tabIndex="0"
            >
              <MockAuthForm
                error={visibleError}
                fieldErrors={visibleFieldErrors}
                mode={mode}
                onChange={handleValuesChange}
                onSubmit={handleSubmit}
                onUseDemoAccount={handleDemoAccount}
                values={values}
              />
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-canvas-muted px-4 py-4 text-center text-xs text-content-subtle dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:px-8">
            {MOCK_BOUNDARY_MESSAGES.notSecurityBoundary}{' '}
            {MOCK_BOUNDARY_MESSAGES.notClinicalAdvice}
          </footer>
        </section>
      </main>
    </div>
  );
}

AuthView.propTypes = {
  initialMode: PropTypes.oneOf(FORM_MODES),
  className: PropTypes.string,
};

export default AuthView;