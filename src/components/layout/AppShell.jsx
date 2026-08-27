import {
  useContext,
  useId,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  NavLink,
  Outlet,
} from 'react-router-dom';
import {
  APP_MESSAGES,
  AUTH_MESSAGES,
  DEMO_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
  ROLE_LABELS,
} from '../../constants/messages.js';
import { DashboardContext } from '../../context/DashboardContext.jsx';
import { SessionContext } from '../../context/SessionContext.jsx';

const ROLE_ROUTES = Object.freeze({
  clinical: Object.freeze({
    path: '/clinical',
    label: 'Care team dashboard',
  }),
  sre: Object.freeze({
    path: '/sre',
    label: 'SRE dashboard',
  }),
});

/**
 * @param {unknown} role
 * @returns {'clinical'|'sre'|null}
 */
function normalizeRole(role) {
  if (role === 'clinical' || role === 'CARE_TEAM') {
    return 'clinical';
  }

  if (role === 'sre' || role === 'SRE') {
    return 'sre';
  }

  return null;
}

/**
 * @param {unknown} result
 * @returns {boolean}
 */
function actionFailed(result) {
  return (
    typeof result === 'object' &&
    result !== null &&
    result.ok === false
  );
}

/**
 * @param {unknown} buildLabel
 * @returns {string}
 */
function resolveBuildLabel(buildLabel) {
  const candidate =
    buildLabel === undefined
      ? import.meta.env.VITE_BUILD_LABEL
      : buildLabel;

  return typeof candidate === 'string'
    ? candidate.trim().slice(0, 80)
    : '';
}

/**
 * Responsive semantic shell for authenticated browser-local dashboard views.
 * Role-aware navigation changes presentation only and is not an authorization
 * boundary. Logout and reset actions operate exclusively on in-memory mock
 * state.
 *
 * @param {{
 *   children?: import('react').ReactNode,
 *   role?: 'clinical'|'sre'|'CARE_TEAM'|'SRE',
 *   session?: {
 *     emailLabel?: string,
 *     role?: 'clinical'|'sre'|'CARE_TEAM'|'SRE'
 *   }|null,
 *   onLogout?: () => unknown,
 *   onReset?: () => unknown,
 *   buildLabel?: string,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function AppShell({
  children = undefined,
  role = undefined,
  session = undefined,
  onLogout = undefined,
  onReset = undefined,
  buildLabel = undefined,
  className = '',
}) {
  const generatedId = useId();
  const dashboardContext = useContext(DashboardContext);
  const sessionContext = useContext(SessionContext);
  const resetButtonRef = useRef(null);
  const confirmResetButtonRef = useRef(null);
  const [pendingAction, setPendingAction] = useState('');
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionStatus, setActionStatus] = useState('');

  const activeSession =
    session === undefined
      ? sessionContext?.session ?? null
      : session;
  const activeRole = normalizeRole(
    role ??
      activeSession?.role ??
      sessionContext?.role,
  );
  const roleRoute =
    activeRole === null ? null : ROLE_ROUTES[activeRole];
  const roleLabel =
    activeRole === null
      ? 'Demo user'
      : ROLE_LABELS[activeRole];
  const emailLabel =
    typeof activeSession?.emailLabel === 'string'
      ? activeSession.emailLabel
      : '';
  const logoutAction =
    onLogout ??
    sessionContext?.logout ??
    sessionContext?.clearSession;
  const resetAction =
    onReset ??
    dashboardContext?.resetScenario;
  const resolvedBuildLabel = resolveBuildLabel(buildLabel);
  const controlsPending = pendingAction.length > 0;
  const resetDescriptionId = `${generatedId}-reset-description`;
  const resetDialogTitleId = `${generatedId}-reset-title`;
  const resetDialogDescriptionId =
    `${generatedId}-reset-confirmation-description`;

  /**
   * @returns {Promise<void>}
   */
  async function handleLogout() {
    if (
      controlsPending ||
      typeof logoutAction !== 'function'
    ) {
      return;
    }

    setPendingAction('logout');
    setActionError('');
    setActionStatus('');

    try {
      const result = await Promise.resolve(logoutAction());

      if (actionFailed(result)) {
        throw new Error('Mock logout failed');
      }

      setActionStatus(AUTH_MESSAGES.logoutComplete);
    } catch {
      setActionError(
        'The mock session could not be cleared. Reload the demo to try again.',
      );
    } finally {
      setPendingAction('');
    }
  }

  /**
   * @returns {void}
   */
  function openResetConfirmation() {
    if (
      controlsPending ||
      typeof resetAction !== 'function'
    ) {
      return;
    }

    setActionError('');
    setActionStatus('');
    setConfirmationOpen(true);

    globalThis.setTimeout(() => {
      confirmResetButtonRef.current?.focus();
    }, 0);
  }

  /**
   * @returns {void}
   */
  function closeResetConfirmation() {
    if (controlsPending) {
      return;
    }

    setConfirmationOpen(false);

    globalThis.setTimeout(() => {
      resetButtonRef.current?.focus();
    }, 0);
  }

  /**
   * @returns {Promise<void>}
   */
  async function handleReset() {
    if (
      controlsPending ||
      typeof resetAction !== 'function'
    ) {
      return;
    }

    setPendingAction('reset');
    setActionError('');
    setActionStatus('');

    try {
      const result = await Promise.resolve(resetAction());

      if (actionFailed(result)) {
        throw new Error('Mock reset failed');
      }

      setConfirmationOpen(false);
      setActionStatus(DEMO_MESSAGES.resetComplete);
    } catch {
      setActionError(DEMO_MESSAGES.resetFailed);
    } finally {
      setPendingAction('');
    }
  }

  /**
   * @param {import('react').KeyboardEvent<HTMLElement>} event
   * @returns {void}
   */
  function handleResetKeyDown(event) {
    if (
      event.key === 'Escape' &&
      confirmationOpen &&
      !controlsPending
    ) {
      event.preventDefault();
      closeResetConfirmation();
    }
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

      <header className="border-b border-slate-300 bg-surface shadow-sm dark:border-slate-700 dark:bg-surface-inverse">
        <div className="mx-auto flex max-w-dashboard flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-care-700 text-2xl font-bold text-white dark:bg-care-200 dark:text-care-950"
            >
              +
            </span>

            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-content dark:text-content-inverse">
                {APP_MESSAGES.name}
              </p>
              <p className="text-sm text-content-muted dark:text-slate-200">
                Resilience demonstration
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content dark:text-content-inverse">
                {roleLabel}
              </p>
              {emailLabel.length > 0 ? (
                <p className="truncate text-xs text-content-muted dark:text-slate-300">
                  {emailLabel}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                aria-describedby={resetDescriptionId}
                className="min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2 text-sm font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
                disabled={
                  controlsPending ||
                  typeof resetAction !== 'function'
                }
                onClick={openResetConfirmation}
                ref={resetButtonRef}
                type="button"
              >
                {pendingAction === 'reset'
                  ? 'Resetting demo…'
                  : DEMO_MESSAGES.reset}
              </button>

              <button
                className="min-h-touch rounded-lg border border-status-critical-border bg-surface px-4 py-2 text-sm font-semibold text-status-critical transition-colors duration-fast hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-inverse dark:hover:bg-slate-800"
                disabled={
                  controlsPending ||
                  typeof logoutAction !== 'function'
                }
                onClick={handleLogout}
                type="button"
              >
                {pendingAction === 'logout'
                  ? 'Logging out…'
                  : AUTH_MESSAGES.logoutAction}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-care-300 bg-care-50 dark:border-care-700 dark:bg-care-950">
          <div className="mx-auto flex max-w-dashboard flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="flex min-w-0 items-start gap-2 text-sm text-content dark:text-care-100">
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-care-700 text-xs font-bold text-care-700 dark:border-care-200 dark:text-care-200"
              >
                i
              </span>
              <p>
                <span className="font-semibold">
                  {MOCK_BOUNDARY_MESSAGES.badge}.
                </span>{' '}
                {MOCK_BOUNDARY_MESSAGES.shortNotice}
              </p>
            </div>

            <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-care-700 px-2.5 py-1 text-xs font-semibold text-white dark:bg-care-200 dark:text-care-950">
              <span aria-hidden="true">◇</span>
              Mock data only
            </span>
          </div>
        </div>

        {roleRoute !== null ? (
          <nav
            aria-label="Primary navigation"
            className="border-t border-slate-200 dark:border-slate-700"
          >
            <div className="mx-auto flex max-w-dashboard px-4 sm:px-6 lg:px-8">
              <NavLink
                className={({ isActive }) =>
                  [
                    'inline-flex min-h-touch items-center border-b-2 px-3 py-3 text-sm font-semibold transition-colors duration-fast',
                    'focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-focus/40',
                    isActive
                      ? 'border-care-700 text-care-800 dark:border-care-200 dark:text-care-100'
                      : 'border-transparent text-content-muted hover:border-care-400 hover:text-content dark:text-slate-200 dark:hover:text-content-inverse',
                  ].join(' ')
                }
                end
                to={roleRoute.path}
              >
                {roleRoute.label}
              </NavLink>
            </div>
          </nav>
        ) : null}
      </header>

      <p className="sr-only" id={resetDescriptionId}>
        Restore the browser-local resilience scenario to its synthetic
        baseline. The current mock session remains active.
      </p>

      {confirmationOpen ? (
        <section
          aria-describedby={resetDialogDescriptionId}
          aria-labelledby={resetDialogTitleId}
          className="border-b border-status-critical-border bg-status-critical-surface text-status-critical"
          onKeyDown={handleResetKeyDown}
          role="alertdialog"
        >
          <div className="mx-auto max-w-dashboard px-4 py-4 sm:px-6 lg:px-8">
            <h2
              className="font-bold"
              id={resetDialogTitleId}
            >
              Confirm browser-local demo reset
            </h2>
            <p
              className="mt-1 max-w-prose text-sm"
              id={resetDialogDescriptionId}
            >
              Restore the synthetic baseline and clear mock telemetry,
              alerts, incidents, fallback state, and dependency changes. This
              does not contact an external service or log out the current
              mock session.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="min-h-touch rounded-lg bg-status-critical px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-red-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={controlsPending}
                onClick={handleReset}
                ref={confirmResetButtonRef}
                type="button"
              >
                {pendingAction === 'reset'
                  ? 'Resetting browser-local demo…'
                  : 'Reset demo'}
              </button>

              <button
                className="min-h-touch rounded-lg border border-current bg-surface px-4 py-2.5 font-semibold transition-colors duration-fast hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-inverse dark:hover:bg-slate-800"
                disabled={controlsPending}
                onClick={closeResetConfirmation}
                type="button"
              >
                {APP_MESSAGES.cancel}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {actionError.length > 0 ? (
        <div
          className="border-b border-status-critical-border bg-status-critical-surface text-status-critical"
          role="alert"
        >
          <p className="mx-auto max-w-dashboard px-4 py-3 text-sm font-semibold sm:px-6 lg:px-8">
            {actionError}
          </p>
        </div>
      ) : null}

      <div
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {actionStatus}
      </div>

      <main
        className="mx-auto w-full max-w-dashboard px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        id="main-content"
        tabIndex="-1"
      >
        {children === undefined ? <Outlet /> : children}
      </main>

      <footer className="border-t border-slate-300 bg-surface dark:border-slate-700 dark:bg-surface-inverse">
        <div className="mx-auto flex max-w-dashboard flex-col gap-2 px-4 py-5 text-xs text-content-muted dark:text-slate-300 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>{MOCK_BOUNDARY_MESSAGES.fullNotice}</p>
          {resolvedBuildLabel.length > 0 ? (
            <p className="shrink-0">
              {APP_MESSAGES.buildLabel}: {resolvedBuildLabel}
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

AppShell.propTypes = {
  children: PropTypes.node,
  role: PropTypes.oneOf([
    'clinical',
    'sre',
    'CARE_TEAM',
    'SRE',
  ]),
  session: PropTypes.shape({
    emailLabel: PropTypes.string,
    role: PropTypes.oneOf([
      'clinical',
      'sre',
      'CARE_TEAM',
      'SRE',
    ]),
  }),
  onLogout: PropTypes.func,
  onReset: PropTypes.func,
  buildLabel: PropTypes.string,
  className: PropTypes.string,
};

export default AppShell;