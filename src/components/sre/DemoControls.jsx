import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import {
  DEMO_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
  SRE_MESSAGES,
} from '../../constants/messages.js';
import {
  DEPENDENCIES,
  DEPENDENCY_IDS,
  RESPONSE_CONDITIONS,
} from '../../domain/constants.js';
import {
  LIFECYCLE_HEALTH_OUTCOMES,
} from '../../contracts/ResilienceLifecycleContract.js';
import { ACTIVE_PROFILE_ID } from '../../fixtures/profiles.js';

const RESPONSE_OPTIONS = Object.freeze([
  Object.freeze({
    value: LIFECYCLE_HEALTH_OUTCOMES.HEALTHY,
    condition: RESPONSE_CONDITIONS.NORMAL,
    label: DEMO_MESSAGES.normalCondition,
    description: 'Return a healthy browser-local mock response.',
  }),
  Object.freeze({
    value: LIFECYCLE_HEALTH_OUTCOMES.DEGRADED,
    condition: RESPONSE_CONDITIONS.DEGRADED,
    label: DEMO_MESSAGES.degradedCondition,
    description: 'Represent increased latency in the local mock dependency.',
  }),
  Object.freeze({
    value: LIFECYCLE_HEALTH_OUTCOMES.TIMEOUT,
    condition: RESPONSE_CONDITIONS.TIMEOUT,
    label: DEMO_MESSAGES.timeoutCondition,
    description: 'Represent a local mock response timeout.',
  }),
  Object.freeze({
    value: LIFECYCLE_HEALTH_OUTCOMES.INVALID_PAYLOAD,
    condition: RESPONSE_CONDITIONS.INVALID_PAYLOAD,
    label: DEMO_MESSAGES.invalidPayloadCondition,
    description: 'Return a synthetic payload that fails local validation.',
  }),
  Object.freeze({
    value: LIFECYCLE_HEALTH_OUTCOMES.FAILED,
    condition: RESPONSE_CONDITIONS.FAILURE,
    label: DEMO_MESSAGES.failureCondition,
    description: 'Represent an unavailable browser-local mock dependency.',
  }),
]);

export const DEMO_PRESET_IDS = Object.freeze({
  BASELINE: 'baseline',
  PRIMARY_DEGRADED: 'primary-degraded',
  PRIMARY_FAILOVER: 'primary-failover',
  FALLBACK_ACTIVE: 'fallback-active',
});

const PRESET_OPTIONS = Object.freeze([
  Object.freeze({
    value: DEMO_PRESET_IDS.BASELINE,
    label: 'Healthy baseline',
    description:
      'Restore all browser-local mock dependencies and clear demo activity.',
  }),
  Object.freeze({
    value: DEMO_PRESET_IDS.PRIMARY_DEGRADED,
    label: 'Primary degraded',
    description:
      'Apply the deterministic degraded response to the primary mock profile dependency.',
  }),
  Object.freeze({
    value: DEMO_PRESET_IDS.PRIMARY_FAILOVER,
    label: 'Primary failover',
    description:
      'Apply the deterministic local sequence that opens the primary mock circuit.',
  }),
  Object.freeze({
    value: DEMO_PRESET_IDS.FALLBACK_ACTIVE,
    label: 'Synthetic fallback active',
    description:
      'Apply deterministic primary and secondary failures, then request the browser-local fallback.',
  }),
]);

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
 * Accessible SRE controls for browser-local dependency simulations, profile
 * requests, recovery, fallback expiry, reset, and deterministic presets.
 * Callbacks receive only allowlisted mock identifiers and response outcomes.
 *
 * @param {{
 *   onSimulateHealth?: (dependencyId: string, outcome: string) => unknown,
 *   onRequestProfile?: (profileId: string) => unknown,
 *   onSimulateRecovery?: (dependencyId: string, profileId: string) => unknown,
 *   onExpireFallback?: () => unknown,
 *   onApplyPreset?: (presetId: string) => unknown,
 *   onResetDemo?: () => unknown,
 *   profileId?: string,
 *   fallbackActive?: boolean,
 *   recoveryAvailable?: boolean,
 *   disabled?: boolean,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function DemoControls({
  onSimulateHealth = undefined,
  onRequestProfile = undefined,
  onSimulateRecovery = undefined,
  onExpireFallback = undefined,
  onApplyPreset = undefined,
  onResetDemo = undefined,
  profileId = ACTIVE_PROFILE_ID,
  fallbackActive = false,
  recoveryAvailable = false,
  disabled = false,
  className = '',
}) {
  const generatedId = useId();
  const [dependencyId, setDependencyId] = useState(
    DEPENDENCY_IDS.PROFILE_PRIMARY,
  );
  const [outcome, setOutcome] = useState(
    LIFECYCLE_HEALTH_OUTCOMES.HEALTHY,
  );
  const [presetId, setPresetId] = useState(
    DEMO_PRESET_IDS.BASELINE,
  );
  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionStatus, setActionStatus] = useState('');

  const controlsDisabled =
    disabled || pendingAction.length > 0;
  const selectedResponse = RESPONSE_OPTIONS.find(
    (option) => option.value === outcome,
  );
  const selectedPreset = PRESET_OPTIONS.find(
    (option) => option.value === presetId,
  );

  /**
   * @param {string} action
   * @param {string} successMessage
   * @param {() => unknown} operation
   * @returns {Promise<void>}
   */
  async function runAction(action, successMessage, operation) {
    if (controlsDisabled) {
      return;
    }

    setPendingAction(action);
    setActionError('');
    setActionStatus('');

    try {
      const result = await Promise.resolve(operation());

      if (actionFailed(result)) {
        setActionError(DEMO_MESSAGES.actionFailed);
        return;
      }

      setActionStatus(successMessage);
    } catch {
      setActionError(DEMO_MESSAGES.actionFailed);
    } finally {
      setPendingAction('');
    }
  }

  /**
   * @param {import('react').FormEvent<HTMLFormElement>} event
   * @returns {void}
   */
  function handleHealthSubmit(event) {
    event.preventDefault();

    if (typeof onSimulateHealth !== 'function') {
      return;
    }

    const dependency = DEPENDENCIES.find(
      (item) => item.id === dependencyId,
    );
    const response = RESPONSE_OPTIONS.find(
      (item) => item.value === outcome,
    );

    runAction(
      'health',
      `${response?.label ?? 'Mock response'} applied locally to ${
        dependency?.displayName ?? 'the selected mock dependency'
      }.`,
      () => onSimulateHealth(dependencyId, outcome),
    );
  }

  /**
   * @returns {void}
   */
  function handleProfileRequest() {
    if (typeof onRequestProfile !== 'function') {
      return;
    }

    runAction(
      'profile',
      'The synthetic profile request completed locally.',
      () => onRequestProfile(profileId),
    );
  }

  /**
   * @returns {void}
   */
  function handleRecovery() {
    if (typeof onSimulateRecovery !== 'function') {
      return;
    }

    runAction(
      'recovery',
      SRE_MESSAGES.recoveryAnnouncement ??
        'The primary mock dependency recovery completed locally.',
      () =>
        onSimulateRecovery(
          DEPENDENCY_IDS.PROFILE_PRIMARY,
          profileId,
        ),
    );
  }

  /**
   * @returns {void}
   */
  function handleFallbackExpiry() {
    if (typeof onExpireFallback !== 'function') {
      return;
    }

    runAction(
      'expiry',
      'The browser-local synthetic fallback expiry was applied.',
      () => onExpireFallback(),
    );
  }

  /**
   * @returns {void}
   */
  function handlePreset() {
    if (typeof onApplyPreset !== 'function') {
      return;
    }

    runAction(
      'preset',
      `${selectedPreset?.label ?? 'Demo preset'} applied locally.`,
      () => onApplyPreset(presetId),
    );
  }

  /**
   * @returns {void}
   */
  function handleReset() {
    if (typeof onResetDemo !== 'function') {
      return;
    }

    runAction(
      'reset',
      DEMO_MESSAGES.resetComplete,
      () => onResetDemo(),
    );
  }

  return (
    <section
      aria-busy={pendingAction.length > 0 ? 'true' : undefined}
      aria-describedby={`${generatedId}-description`}
      aria-labelledby={`${generatedId}-title`}
      className={[
        'overflow-hidden rounded-panel border border-slate-300 bg-surface shadow-panel',
        'dark:border-slate-700 dark:bg-surface-inverse',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              className="text-xl font-bold text-content dark:text-content-inverse"
              id={`${generatedId}-title`}
            >
              {DEMO_MESSAGES.controlsTitle}
            </h2>
            <p
              className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200"
              id={`${generatedId}-description`}
            >
              {DEMO_MESSAGES.controlsDescription} Every control below changes
              synthetic in-memory state only.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-care-700 bg-care-50 px-2.5 py-1 text-xs font-semibold text-care-900 dark:border-care-200 dark:bg-care-950 dark:text-care-100">
            <span aria-hidden="true">◇</span>
            Local mock actions
          </span>
        </div>
      </header>

      <div className="space-y-6 p-4 sm:p-6">
        <div
          className="rounded-lg border border-care-300 bg-care-50 p-4 text-sm text-content dark:border-care-700 dark:bg-care-950 dark:text-care-100"
          role="note"
        >
          <p className="font-semibold">
            {MOCK_BOUNDARY_MESSAGES.badge}
          </p>
          <p className="mt-1">
            These controls do not contact dependencies, clinical systems,
            monitoring platforms, or external alert services.
          </p>
        </div>

        {actionError.length > 0 ? (
          <p
            className="rounded-lg border border-status-critical-border bg-status-critical-surface p-4 text-sm font-semibold text-status-critical"
            id={`${generatedId}-error`}
            role="alert"
          >
            {actionError}
          </p>
        ) : null}

        <div
          aria-atomic="true"
          aria-live="polite"
          className="rounded-lg border border-slate-200 bg-canvas-muted p-3 text-sm text-content dark:border-slate-700 dark:bg-slate-800 dark:text-content-inverse"
          role="status"
        >
          {pendingAction.length > 0
            ? 'Applying browser-local mock action…'
            : actionStatus.length > 0
              ? actionStatus
              : 'Local mock controls are ready.'}
        </div>

        <form
          className="rounded-panel border border-slate-300 p-4 dark:border-slate-600 sm:p-5"
          onSubmit={handleHealthSubmit}
        >
          <fieldset disabled={controlsDisabled}>
            <legend className="px-1 text-lg font-bold text-content dark:text-content-inverse">
              Mock dependency response
            </legend>
            <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
              Select one fixed dependency and one deterministic local response
              condition.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-semibold text-content dark:text-content-inverse"
                  htmlFor={`${generatedId}-dependency`}
                >
                  {DEMO_MESSAGES.dependencyLabel}
                </label>
                <select
                  className="mt-2 min-h-touch w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-content shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-surface-inverse dark:text-content-inverse"
                  id={`${generatedId}-dependency`}
                  onChange={(event) =>
                    setDependencyId(event.target.value)
                  }
                  value={dependencyId}
                >
                  {DEPENDENCIES.map((dependency) => (
                    <option
                      key={dependency.id}
                      value={dependency.id}
                    >
                      {dependency.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-content dark:text-content-inverse"
                  htmlFor={`${generatedId}-outcome`}
                >
                  {DEMO_MESSAGES.responseConditionLabel}
                </label>
                <select
                  aria-describedby={`${generatedId}-outcome-description`}
                  className="mt-2 min-h-touch w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-content shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-surface-inverse dark:text-content-inverse"
                  id={`${generatedId}-outcome`}
                  onChange={(event) => setOutcome(event.target.value)}
                  value={outcome}
                >
                  {RESPONSE_OPTIONS.map((option) => (
                    <option key={option.condition} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p
                  className="mt-2 text-sm text-content-muted dark:text-slate-200"
                  id={`${generatedId}-outcome-description`}
                >
                  {selectedResponse?.description}
                </p>
              </div>
            </div>

            <button
              className="mt-5 min-h-touch rounded-lg bg-care-700 px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-care-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-care-200 dark:text-care-950 dark:hover:bg-care-100"
              disabled={
                typeof onSimulateHealth !== 'function' ||
                controlsDisabled
              }
              type="submit"
            >
              {pendingAction === 'health'
                ? 'Applying mock response…'
                : DEMO_MESSAGES.simulateHealth}
            </button>
          </fieldset>
        </form>

        <section
          aria-labelledby={`${generatedId}-lifecycle-title`}
          className="rounded-panel border border-slate-300 p-4 dark:border-slate-600 sm:p-5"
        >
          <h3
            className="text-lg font-bold text-content dark:text-content-inverse"
            id={`${generatedId}-lifecycle-title`}
          >
            Local lifecycle actions
          </h3>
          <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
            Request the fixed synthetic profile, recover the primary mock
            dependency, or apply the authoritative fallback expiry locally.
          </p>

          <p className="mt-3 font-mono text-xs text-content-subtle dark:text-slate-300">
            Synthetic profile: {profileId}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              className="min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2.5 text-sm font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
              disabled={
                controlsDisabled ||
                typeof onRequestProfile !== 'function'
              }
              onClick={handleProfileRequest}
              type="button"
            >
              {pendingAction === 'profile'
                ? 'Requesting locally…'
                : DEMO_MESSAGES.requestProfile}
            </button>

            <button
              className="min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2.5 text-sm font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
              disabled={
                controlsDisabled ||
                !recoveryAvailable ||
                typeof onSimulateRecovery !== 'function'
              }
              onClick={handleRecovery}
              type="button"
            >
              {pendingAction === 'recovery'
                ? 'Recovering locally…'
                : SRE_MESSAGES.simulateRecovery}
            </button>

            <button
              className="min-h-touch rounded-lg border border-status-fallback-border bg-status-fallback-surface px-4 py-2.5 text-sm font-semibold text-status-fallback transition-colors duration-fast hover:bg-orange-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                controlsDisabled ||
                !fallbackActive ||
                typeof onExpireFallback !== 'function'
              }
              onClick={handleFallbackExpiry}
              type="button"
            >
              {pendingAction === 'expiry'
                ? 'Expiring fallback locally…'
                : 'Expire synthetic fallback'}
            </button>
          </div>

          {!recoveryAvailable ? (
            <p className="mt-3 text-xs text-content-subtle dark:text-slate-300">
              Primary recovery becomes available when the browser-local mock
              primary circuit is open.
            </p>
          ) : null}

          {!fallbackActive ? (
            <p className="mt-1 text-xs text-content-subtle dark:text-slate-300">
              Fallback expiry becomes available when a synthetic fallback is
              active.
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby={`${generatedId}-preset-title`}
          className="rounded-panel border border-slate-300 p-4 dark:border-slate-600 sm:p-5"
        >
          <h3
            className="text-lg font-bold text-content dark:text-content-inverse"
            id={`${generatedId}-preset-title`}
          >
            Deterministic mock scenarios
          </h3>
          <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
            Apply a named, repeatable browser-local scenario. No remote
            feature flag or external service is used.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <label
                className="block text-sm font-semibold text-content dark:text-content-inverse"
                htmlFor={`${generatedId}-preset`}
              >
                Mock scenario preset
              </label>
              <select
                aria-describedby={`${generatedId}-preset-description`}
                className="mt-2 min-h-touch w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-content shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-surface-inverse dark:text-content-inverse"
                disabled={controlsDisabled}
                id={`${generatedId}-preset`}
                onChange={(event) => setPresetId(event.target.value)}
                value={presetId}
              >
                {PRESET_OPTIONS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p
                className="mt-2 text-sm text-content-muted dark:text-slate-200"
                id={`${generatedId}-preset-description`}
              >
                {selectedPreset?.description}
              </p>
            </div>

            <button
              className="min-h-touch rounded-lg bg-care-700 px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-care-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-care-200 dark:text-care-950 dark:hover:bg-care-100"
              disabled={
                controlsDisabled ||
                typeof onApplyPreset !== 'function'
              }
              onClick={handlePreset}
              type="button"
            >
              {pendingAction === 'preset'
                ? 'Applying mock scenario…'
                : 'Apply mock scenario'}
            </button>
          </div>
        </section>

        {typeof onResetDemo === 'function' ? (
          <section
            aria-labelledby={`${generatedId}-reset-title`}
            className="rounded-panel border border-slate-300 p-4 dark:border-slate-600 sm:p-5"
          >
            <h3
              className="text-lg font-bold text-content dark:text-content-inverse"
              id={`${generatedId}-reset-title`}
            >
              Reset browser-local state
            </h3>
            <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
              Clear mock telemetry, alerts, incidents, fallback state, and
              dependency changes, then restore the synthetic baseline.
            </p>
            <button
              className="mt-4 min-h-touch rounded-lg border border-status-critical-border bg-surface px-4 py-2.5 font-semibold text-status-critical transition-colors duration-fast hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-inverse dark:hover:bg-slate-800"
              disabled={controlsDisabled}
              onClick={handleReset}
              type="button"
            >
              {pendingAction === 'reset'
                ? 'Resetting browser-local demo…'
                : DEMO_MESSAGES.reset}
            </button>
          </section>
        ) : null}

        <p className="text-xs text-content-subtle dark:text-slate-300">
          {MOCK_BOUNDARY_MESSAGES.shortNotice}
        </p>
      </div>
    </section>
  );
}

DemoControls.propTypes = {
  onSimulateHealth: PropTypes.func,
  onRequestProfile: PropTypes.func,
  onSimulateRecovery: PropTypes.func,
  onExpireFallback: PropTypes.func,
  onApplyPreset: PropTypes.func,
  onResetDemo: PropTypes.func,
  profileId: PropTypes.string,
  fallbackActive: PropTypes.bool,
  recoveryAvailable: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default DemoControls;