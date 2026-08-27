import {
  useEffect,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import AlertList from '../components/sre/AlertList.jsx';
import DemoControls, {
  DEMO_PRESET_IDS,
} from '../components/sre/DemoControls.jsx';
import DependencyHealthTable from '../components/sre/DependencyHealthTable.jsx';
import IncidentList from '../components/sre/IncidentList.jsx';
import TelemetryPanel from '../components/sre/TelemetryPanel.jsx';
import LiveRegion from '../components/shared/LiveRegion.jsx';
import StatusBadge from '../components/shared/StatusBadge.jsx';
import {
  ACCESSIBILITY_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
  SRE_MESSAGES,
} from '../constants/messages.js';
import {
  LIFECYCLE_COMMAND_TYPES,
  LIFECYCLE_HEALTH_OUTCOMES,
} from '../contracts/ResilienceLifecycleContract.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import {
  CIRCUIT_STATES,
  DEPENDENCY_IDS,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import { INCIDENT_TYPES } from '../domain/model.js';
import { ACTIVE_PROFILE_ID } from '../fixtures/profiles.js';
import { usePollingLifecycle } from '../hooks/usePollingLifecycle.js';
import {
  selectPrivacySafeSreModel,
} from '../selectors/PrivacySelectors.js';

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
 * @returns {boolean}
 */
function isDocumentVisible() {
  if (typeof document === 'undefined') {
    return false;
  }

  if (document.visibilityState !== undefined) {
    return document.visibilityState === 'visible';
  }

  return document.hidden === false;
}

/**
 * SRE operations dashboard for the browser-local resilience demonstration.
 * It composes privacy-safe dependency, telemetry, alert, and incident models,
 * activates represented polling only while mounted and visible, and exposes
 * allowlisted local lifecycle controls.
 *
 * @param {{
 *   engine: {
 *     start: Function,
 *     stop: Function,
 *     expireFallback?: Function
 *   },
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function SreDashboard({
  engine,
  className = '',
}) {
  const { snapshot, dispatch } = useDashboard();
  const [documentVisible, setDocumentVisible] = useState(
    isDocumentVisible,
  );

  usePollingLifecycle(engine, {
    isRouteActive: true,
    role: 'sre',
    sessionActive: true,
  });

  useEffect(() => {
    function handleVisibilityChange() {
      setDocumentVisible(isDocumentVisible());
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, []);

  const sreModel = selectPrivacySafeSreModel(snapshot);
  const primaryDependency = sreModel.dependencies.find(
    (dependency) =>
      dependency.dependencyId === DEPENDENCY_IDS.PROFILE_PRIMARY,
  );
  const fallbackActive =
    snapshot.profileSource === PROFILE_SOURCES.FALLBACK &&
    snapshot.fallback !== null &&
    snapshot.now < snapshot.fallback.expiresAt;
  const recoveryAvailable =
    primaryDependency?.circuit === CIRCUIT_STATES.OPEN;
  const latestIncident =
    sreModel.incidents.length > 0
      ? sreModel.incidents[0]
      : null;
  const latestRecovery =
    latestIncident?.type === INCIDENT_TYPES.RECOVERY
      ? latestIncident
      : null;
  const latestCriticalIncident =
    latestIncident?.type === INCIDENT_TYPES.FALLBACK_ACTIVATED ||
    latestIncident?.type === INCIDENT_TYPES.EXPIRY
      ? latestIncident
      : null;

  const announcementMessage =
    latestCriticalIncident?.type ===
    INCIDENT_TYPES.FALLBACK_ACTIVATED
      ? ACCESSIBILITY_MESSAGES.newFallbackAnnouncement
      : latestCriticalIncident?.type === INCIDENT_TYPES.EXPIRY
        ? 'Critical demo update: the browser-local synthetic fallback has expired.'
        : latestRecovery !== null
          ? ACCESSIBILITY_MESSAGES.recoveryAnnouncement
          : '';
  const announcementEventId =
    latestCriticalIncident?.eventId ??
    latestRecovery?.eventId;
  const announcementPriority =
    latestCriticalIncident !== null ? 'assertive' : 'polite';

  /**
   * @param {string} dependencyId
   * @param {string} outcome
   * @returns {unknown}
   */
  function handleSimulateHealth(dependencyId, outcome) {
    return dispatch({
      type: LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH,
      dependencyId,
      outcome,
    });
  }

  /**
   * @param {string} profileId
   * @returns {unknown}
   */
  function handleRequestProfile(profileId) {
    return dispatch({
      type: LIFECYCLE_COMMAND_TYPES.REQUEST_PROFILE,
      profileId,
    });
  }

  /**
   * @param {string} dependencyId
   * @param {string} profileId
   * @returns {unknown}
   */
  function handleSimulateRecovery(dependencyId, profileId) {
    return dispatch({
      type: LIFECYCLE_COMMAND_TYPES.SIMULATE_RECOVERY,
      dependencyId,
      profileId,
    });
  }

  /**
   * @param {string} alertId
   * @returns {unknown}
   */
  function handleAcknowledgeAlert(alertId) {
    return dispatch({
      type: LIFECYCLE_COMMAND_TYPES.ACKNOWLEDGE_ALERT,
      alertId,
    });
  }

  /**
   * @returns {unknown}
   */
  function handleResetDemo() {
    return dispatch({
      type: LIFECYCLE_COMMAND_TYPES.RESET_DEMO,
    });
  }

  /**
   * Runs lifecycle commands sequentially and stops when one fails.
   *
   * @param {ReadonlyArray<Readonly<Record<string, string>>>} commands
   * @returns {Promise<unknown>}
   */
  async function executeCommands(commands) {
    try {
      let result;

      for (const command of commands) {
        result = await Promise.resolve(dispatch(command));

        if (actionFailed(result)) {
          return result;
        }
      }

      return result;
    } catch {
      return Object.freeze({
        ok: false,
      });
    }
  }

  /**
   * @param {string} presetId
   * @returns {Promise<unknown>}
   */
  async function handleApplyPreset(presetId) {
    const resetCommand = Object.freeze({
      type: LIFECYCLE_COMMAND_TYPES.RESET_DEMO,
    });

    if (presetId === DEMO_PRESET_IDS.BASELINE) {
      return executeCommands([resetCommand]);
    }

    if (presetId === DEMO_PRESET_IDS.PRIMARY_DEGRADED) {
      return executeCommands([
        resetCommand,
        Object.freeze({
          type: LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH,
          dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
          outcome: LIFECYCLE_HEALTH_OUTCOMES.DEGRADED,
        }),
      ]);
    }

    const primaryFailureCommand = Object.freeze({
      type: LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH,
      dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
      outcome: LIFECYCLE_HEALTH_OUTCOMES.FAILED,
    });

    if (presetId === DEMO_PRESET_IDS.PRIMARY_FAILOVER) {
      return executeCommands([
        resetCommand,
        primaryFailureCommand,
        primaryFailureCommand,
        primaryFailureCommand,
      ]);
    }

    if (presetId === DEMO_PRESET_IDS.FALLBACK_ACTIVE) {
      return executeCommands([
        resetCommand,
        primaryFailureCommand,
        primaryFailureCommand,
        primaryFailureCommand,
        Object.freeze({
          type: LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH,
          dependencyId: DEPENDENCY_IDS.PROFILE_SECONDARY,
          outcome: LIFECYCLE_HEALTH_OUTCOMES.FAILED,
        }),
        Object.freeze({
          type: LIFECYCLE_COMMAND_TYPES.REQUEST_PROFILE,
          profileId: ACTIVE_PROFILE_ID,
        }),
      ]);
    }

    return Object.freeze({
      ok: false,
    });
  }

  /**
   * @returns {unknown}
   */
  function handleExpireFallback() {
    if (typeof engine.expireFallback !== 'function') {
      return Object.freeze({
        ok: false,
      });
    }

    return engine.expireFallback();
  }

  return (
    <div
      className={[
        'space-y-6 sm:space-y-8',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-content dark:text-content-inverse sm:text-3xl">
            {SRE_MESSAGES.dashboardTitle}
          </h1>
          <p className="mt-2 max-w-prose text-content-muted dark:text-slate-200">
            {SRE_MESSAGES.dashboardDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            description={
              documentVisible
                ? 'Browser-local represented polling is active while this SRE dashboard is visible.'
                : 'Browser-local represented polling is paused while this document is hidden.'
            }
            label={
              documentVisible
                ? 'Mock polling active'
                : 'Mock polling paused'
            }
            status={documentVisible ? 'HEALTHY' : 'UNKNOWN'}
          />
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-care-700 bg-care-50 px-3 py-1.5 text-xs font-semibold text-care-900 dark:border-care-200 dark:bg-care-950 dark:text-care-100">
            <span aria-hidden="true">◇</span>
            Synthetic operations view
          </span>
        </div>
      </header>

      <LiveRegion
        eventId={announcementEventId}
        message={announcementMessage}
        priority={announcementPriority}
      />

      <section
        aria-labelledby="sre-overview-title"
        className="rounded-panel border border-slate-300 bg-surface p-4 shadow-panel dark:border-slate-700 dark:bg-surface-inverse sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2
              className="text-lg font-bold text-content dark:text-content-inverse"
              id="sre-overview-title"
            >
              Browser-local operations overview
            </h2>
            <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
              Current bounded activity from the deterministic mock lifecycle.
              No monitoring or incident-management platform is connected.
            </p>
          </div>

          {latestRecovery !== null ? (
            <StatusBadge
              description="The latest browser-local lifecycle event records mock dependency recovery."
              label="Recovery recorded"
              status="RECOVERED"
            />
          ) : null}
        </div>

        <dl className="mt-5 grid gap-3 border-t border-slate-200 pt-5 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-canvas-muted p-4 dark:bg-slate-800">
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
              Mock dependencies
            </dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-content dark:text-content-inverse">
              {sreModel.dependencies.length}
            </dd>
          </div>

          <div className="rounded-lg bg-canvas-muted p-4 dark:bg-slate-800">
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
              Active mock alerts
            </dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-content dark:text-content-inverse">
              {sreModel.alerts.length}
            </dd>
          </div>

          <div className="rounded-lg bg-canvas-muted p-4 dark:bg-slate-800">
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
              Mock incident events
            </dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-content dark:text-content-inverse">
              {sreModel.incidents.length}
            </dd>
          </div>

          <div className="rounded-lg bg-canvas-muted p-4 dark:bg-slate-800">
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
              Mock telemetry samples
            </dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-content dark:text-content-inverse">
              {sreModel.telemetry.length}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-content-subtle dark:text-slate-300">
          {MOCK_BOUNDARY_MESSAGES.shortNotice}
        </p>
      </section>

      <DependencyHealthTable
        dependencies={sreModel.dependencies}
        now={snapshot.now}
      />

      <DemoControls
        fallbackActive={fallbackActive}
        onApplyPreset={handleApplyPreset}
        onExpireFallback={
          typeof engine.expireFallback === 'function'
            ? handleExpireFallback
            : undefined
        }
        onRequestProfile={handleRequestProfile}
        onResetDemo={handleResetDemo}
        onSimulateHealth={handleSimulateHealth}
        onSimulateRecovery={handleSimulateRecovery}
        profileId={ACTIVE_PROFILE_ID}
        recoveryAvailable={recoveryAvailable}
      />

      <TelemetryPanel
        now={snapshot.now}
        pollingActive={documentVisible}
        telemetry={sreModel.telemetry}
      />

      <AlertList
        alerts={sreModel.alerts}
        now={snapshot.now}
        onAcknowledgeAlert={handleAcknowledgeAlert}
      />

      <IncidentList
        incidents={sreModel.incidents}
        now={snapshot.now}
      />
    </div>
  );
}

SreDashboard.propTypes = {
  engine: PropTypes.shape({
    start: PropTypes.func.isRequired,
    stop: PropTypes.func.isRequired,
    expireFallback: PropTypes.func,
  }).isRequired,
  className: PropTypes.string,
};

export default SreDashboard;