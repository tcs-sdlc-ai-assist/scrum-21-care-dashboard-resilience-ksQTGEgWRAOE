import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  APP_MESSAGES,
  DEMO_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../../constants/messages.js';
import { DashboardContext } from '../../context/DashboardContext.jsx';
import { SessionContext } from '../../context/SessionContext.jsx';
import {
  SCENARIO_STORAGE_KEY,
} from '../../storage/preferencesStore.js';

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
 * @param {unknown} storage
 * @returns {{removeItem: Function}|null}
 */
function resolveStorage(storage) {
  if (storage !== undefined) {
    return (
      typeof storage === 'object' &&
      storage !== null &&
      typeof storage.removeItem === 'function'
    )
      ? storage
      : null;
  }

  try {
    const browserStorage = globalThis.localStorage;

    return (
      typeof browserStorage === 'object' &&
      browserStorage !== null &&
      typeof browserStorage.removeItem === 'function'
    )
      ? browserStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * Removes only the allowlisted scenario preference. Other UI preferences and
 * all unrelated browser storage remain untouched.
 *
 * @param {unknown} storage
 * @returns {boolean}
 */
function clearScenarioPreference(storage) {
  const targetStorage = resolveStorage(storage);

  if (targetStorage === null) {
    return false;
  }

  try {
    targetStorage.removeItem(SCENARIO_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Presents a confirmation-based reset control. The reset restores the
 * browser-local resilience baseline, removes the allowlisted scenario
 * preference, and clears the in-memory mock session. No profile, credential,
 * or operational record is written to storage.
 *
 * Provider actions are used by default. Explicit callbacks can be supplied
 * for isolated composition and testing.
 *
 * @param {{
 *   resetScenario?: () => unknown,
 *   clearSession?: () => unknown,
 *   storage?: {
 *     removeItem: Function
 *   },
 *   disabled?: boolean,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function DemoResetController({
  resetScenario = undefined,
  clearSession = undefined,
  storage = undefined,
  disabled = false,
  className = '',
}) {
  const generatedId = useId();
  const dashboardContext = useContext(DashboardContext);
  const sessionContext = useContext(SessionContext);
  const confirmButtonRef = useRef(null);
  const triggerButtonRef = useRef(null);
  const mountedRef = useRef(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const resetAction =
    resetScenario ?? dashboardContext?.resetScenario;
  const clearSessionAction =
    clearSession ?? sessionContext?.clearSession;
  const actionsAvailable =
    typeof resetAction === 'function' &&
    typeof clearSessionAction === 'function';
  const controlsDisabled =
    disabled || resetPending || !actionsAvailable;
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const statusId = `${generatedId}-status`;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (confirmationOpen && !resetPending) {
      confirmButtonRef.current?.focus();
    }
  }, [confirmationOpen, resetPending]);

  /**
   * @returns {void}
   */
  function openConfirmation() {
    if (controlsDisabled) {
      return;
    }

    setResetError('');
    setResetStatus('');
    setConfirmationOpen(true);
  }

  /**
   * @returns {void}
   */
  function closeConfirmation() {
    if (resetPending) {
      return;
    }

    setConfirmationOpen(false);

    globalThis.setTimeout(() => {
      triggerButtonRef.current?.focus();
    }, 0);
  }

  /**
   * @param {import('react').KeyboardEvent<HTMLElement>} event
   * @returns {void}
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && confirmationOpen && !resetPending) {
      event.preventDefault();
      closeConfirmation();
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async function handleConfirmedReset() {
    if (controlsDisabled) {
      return;
    }

    setResetPending(true);
    setResetError('');
    setResetStatus('');

    try {
      const resetResult = await Promise.resolve(resetAction());

      if (actionFailed(resetResult)) {
        throw new Error('Scenario reset failed');
      }

      clearScenarioPreference(storage);

      const sessionResult = await Promise.resolve(
        clearSessionAction(),
      );

      if (actionFailed(sessionResult)) {
        throw new Error('Session clear failed');
      }

      if (mountedRef.current) {
        setConfirmationOpen(false);
        setResetStatus(DEMO_MESSAGES.resetComplete);
      }
    } catch {
      if (mountedRef.current) {
        setResetError(DEMO_MESSAGES.resetFailed);
      }
    } finally {
      if (mountedRef.current) {
        setResetPending(false);
      }
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className={[
        'rounded-panel border border-slate-300 bg-surface p-4 shadow-panel',
        'dark:border-slate-700 dark:bg-surface-inverse sm:p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onKeyDown={handleKeyDown}
    >
      <h2
        className="text-lg font-bold text-content dark:text-content-inverse"
        id={titleId}
      >
        Reset browser-local demo
      </h2>

      <p
        className="mt-2 max-w-prose text-sm text-content-muted dark:text-slate-200"
        id={descriptionId}
      >
        Clear the in-memory mock session and resilience activity, remove the
        saved scenario selection, and restore deterministic synthetic
        fixtures.
      </p>

      <p className="mt-2 text-xs text-content-subtle dark:text-slate-300">
        {MOCK_BOUNDARY_MESSAGES.shortNotice}
      </p>

      {!actionsAvailable ? (
        <p
          className="mt-4 rounded-lg border border-status-critical-border bg-status-critical-surface p-3 text-sm font-semibold text-status-critical"
          role="status"
        >
          The browser-local reset is unavailable. Reload the demo to restore
          the synthetic baseline.
        </p>
      ) : null}

      {resetError.length > 0 ? (
        <p
          className="mt-4 rounded-lg border border-status-critical-border bg-status-critical-surface p-3 text-sm font-semibold text-status-critical"
          id={errorId}
          role="alert"
        >
          {resetError}
        </p>
      ) : null}

      <p
        aria-atomic="true"
        aria-live="polite"
        className={resetStatus.length > 0 ? 'mt-4 text-sm font-semibold text-status-healthy' : 'sr-only'}
        id={statusId}
        role="status"
      >
        {resetStatus}
      </p>

      {!confirmationOpen ? (
        <button
          aria-describedby={descriptionId}
          className="mt-4 min-h-touch rounded-lg border border-status-critical-border bg-surface px-4 py-2.5 font-semibold text-status-critical transition-colors duration-fast hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-inverse dark:hover:bg-slate-800"
          disabled={controlsDisabled}
          onClick={openConfirmation}
          ref={triggerButtonRef}
          type="button"
        >
          {DEMO_MESSAGES.reset}
        </button>
      ) : (
        <div
          aria-describedby={`${generatedId}-confirmation-description`}
          aria-labelledby={`${generatedId}-confirmation-title`}
          className="mt-5 rounded-lg border border-status-critical-border bg-status-critical-surface p-4 text-status-critical"
          role="alertdialog"
        >
          <h3
            className="font-bold"
            id={`${generatedId}-confirmation-title`}
          >
            Confirm browser-local reset
          </h3>

          <p
            className="mt-2 max-w-prose text-sm"
            id={`${generatedId}-confirmation-description`}
          >
            {DEMO_MESSAGES.resetConfirmation} This also logs out the current
            mock session. The action does not contact an external service.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              aria-describedby={
                resetError.length > 0 ? errorId : undefined
              }
              className="min-h-touch rounded-lg bg-status-critical px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-red-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resetPending}
              onClick={handleConfirmedReset}
              ref={confirmButtonRef}
              type="button"
            >
              {resetPending
                ? APP_MESSAGES.loading
                : 'Reset and log out'}
            </button>

            <button
              className="min-h-touch rounded-lg border border-current bg-surface px-4 py-2.5 font-semibold transition-colors duration-fast hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-inverse dark:hover:bg-slate-800"
              disabled={resetPending}
              onClick={closeConfirmation}
              type="button"
            >
              {APP_MESSAGES.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

DemoResetController.propTypes = {
  resetScenario: PropTypes.func,
  clearSession: PropTypes.func,
  storage: PropTypes.shape({
    removeItem: PropTypes.func.isRequired,
  }),
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default DemoResetController;