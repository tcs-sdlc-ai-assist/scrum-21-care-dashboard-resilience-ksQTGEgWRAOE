import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import {
  DEMO_MESSAGES,
  INTEGRATION_MESSAGES,
  SRE_MESSAGES,
} from '../../constants/messages.js';
import { MAX_RECORDS, SEVERITIES } from '../../domain/constants.js';
import { ALERT_CHANNELS } from '../../domain/model.js';
import { formatRelativeTime } from '../../utils/clock.js';
import StatusBadge from '../shared/StatusBadge.jsx';

const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;

const CHANNEL_PRESENTATION = Object.freeze({
  [ALERT_CHANNELS.MOCK_PAGERDUTY]: Object.freeze({
    label: INTEGRATION_MESSAGES.pagerDuty,
    hint: INTEGRATION_MESSAGES.pagerDutyHint,
  }),
  [ALERT_CHANNELS.MOCK_SLACK]: Object.freeze({
    label: INTEGRATION_MESSAGES.slack,
    hint: INTEGRATION_MESSAGES.slackHint,
  }),
});

const UNKNOWN_CHANNEL_PRESENTATION = Object.freeze({
  label: 'Mock in-app alert',
  hint: 'Browser-local mock only. No external event is transmitted.',
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isTimestamp(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_DATE_TIMESTAMP
  );
}

/**
 * @param {unknown} timestamp
 * @param {unknown} now
 * @returns {{dateTime?: string, relative: string, absolute?: string}}
 */
function formatAlertTime(timestamp, now) {
  if (!isTimestamp(timestamp)) {
    return Object.freeze({
      relative: 'Unavailable',
    });
  }

  const comparisonTimestamp = isTimestamp(now) ? now : Date.now();
  const date = new Date(timestamp);

  return Object.freeze({
    dateTime: date.toISOString(),
    relative: formatRelativeTime(timestamp, comparisonTimestamp),
    absolute: date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }),
  });
}

/**
 * @param {unknown} channel
 * @returns {{label: string, hint: string}}
 */
function resolveChannelPresentation(channel) {
  return CHANNEL_PRESENTATION[channel] ?? UNKNOWN_CHANNEL_PRESENTATION;
}

/**
 * Displays a bounded list of browser-local mock alert records. Integration
 * labels and hints explicitly state that no PagerDuty or Slack event is
 * transmitted. Acknowledgement controls expose only the privacy-safe alert
 * identifier to the supplied callback.
 *
 * @param {{
 *   alerts: ReadonlyArray<{
 *     id: string,
 *     incidentId: string,
 *     channel: string,
 *     severity: string,
 *     title: string,
 *     createdAt: number,
 *     acknowledged: boolean
 *   }>,
 *   onAcknowledgeAlert?: (alertId: string) => unknown,
 *   acknowledgingAlertId?: string,
 *   disabled?: boolean,
 *   now?: number,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function AlertList({
  alerts,
  onAcknowledgeAlert = undefined,
  acknowledgingAlertId = undefined,
  disabled = false,
  now = undefined,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const errorId = `${generatedId}-error`;
  const [pendingAlertId, setPendingAlertId] = useState(null);
  const [actionError, setActionError] = useState('');
  const visibleAlerts = alerts.slice(0, MAX_RECORDS);
  const activePendingAlertId =
    acknowledgingAlertId ?? pendingAlertId;

  /**
   * @param {string} alertId
   * @returns {Promise<void>}
   */
  async function handleAcknowledge(alertId) {
    if (
      disabled ||
      activePendingAlertId !== null &&
        activePendingAlertId !== undefined ||
      typeof onAcknowledgeAlert !== 'function'
    ) {
      return;
    }

    setActionError('');
    setPendingAlertId(alertId);

    try {
      const result = await Promise.resolve(
        onAcknowledgeAlert(alertId),
      );

      if (
        result !== undefined &&
        result !== null &&
        typeof result === 'object' &&
        result.ok === false
      ) {
        setActionError(DEMO_MESSAGES.actionFailed);
      }
    } catch {
      setActionError(DEMO_MESSAGES.actionFailed);
    } finally {
      setPendingAlertId(null);
    }
  }

  return (
    <section
      aria-busy={
        activePendingAlertId !== null &&
        activePendingAlertId !== undefined
          ? 'true'
          : undefined
      }
      aria-labelledby={titleId}
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
              id={titleId}
            >
              {SRE_MESSAGES.alertsTitle}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
              Bounded in-app alert records generated by the browser-local
              scenario. No external alert service is connected.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-care-700 bg-care-50 px-2.5 py-1 text-xs font-semibold text-care-900 dark:border-care-200 dark:bg-care-950 dark:text-care-100">
            <span aria-hidden="true">◇</span>
            Mock alerts only
          </span>
        </div>
      </header>

      {actionError.length > 0 ? (
        <p
          className="m-4 rounded-lg border border-status-critical-border bg-status-critical-surface p-3 text-sm font-semibold text-status-critical sm:mx-6"
          id={errorId}
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {visibleAlerts.length === 0 ? (
        <div className="p-4 sm:p-6">
          <div className="rounded-lg border border-slate-300 bg-canvas-muted p-5 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="font-semibold text-content dark:text-content-inverse">
              {SRE_MESSAGES.noAlertsTitle}
            </h3>
            <p className="mt-2 max-w-prose text-sm text-content-muted dark:text-slate-200">
              {SRE_MESSAGES.noAlertsBody}
            </p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-slate-200 dark:divide-slate-700">
          {visibleAlerts.map((alert, index) => {
            const itemTitleId = `${generatedId}-alert-${index}-title`;
            const channel = resolveChannelPresentation(alert.channel);
            const alertTime = formatAlertTime(alert.createdAt, now);
            const acknowledged = alert.acknowledged === true;
            const isPending = activePendingAlertId === alert.id;
            const controlsDisabled =
              disabled ||
              activePendingAlertId !== null &&
                activePendingAlertId !== undefined;
            const canAcknowledge =
              !acknowledged &&
              typeof onAcknowledgeAlert === 'function';

            return (
              <li
                aria-labelledby={itemTitleId}
                className="p-4 sm:p-6"
                key={alert.id}
              >
                <article>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={alert.severity} />
                        <StatusBadge
                          description={
                            acknowledged
                              ? 'This browser-local mock alert has been acknowledged.'
                              : 'This browser-local mock alert is awaiting acknowledgement.'
                          }
                          label={
                            acknowledged
                              ? 'Acknowledged'
                              : 'Awaiting acknowledgement'
                          }
                          status={acknowledged ? 'CLOSED' : 'ACTIVE'}
                        />
                      </div>

                      <h3
                        className="mt-3 break-words text-lg font-bold text-content dark:text-content-inverse"
                        id={itemTitleId}
                      >
                        {alert.title}
                      </h3>
                    </div>

                    {canAcknowledge ? (
                      <button
                        aria-describedby={
                          actionError.length > 0 ? errorId : undefined
                        }
                        className="min-h-touch shrink-0 rounded-lg border border-care-700 bg-surface px-4 py-2.5 text-sm font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
                        disabled={controlsDisabled}
                        onClick={() => handleAcknowledge(alert.id)}
                        type="button"
                      >
                        {isPending
                          ? 'Acknowledging mock alert…'
                          : SRE_MESSAGES.acknowledgeAlert}
                      </button>
                    ) : null}
                  </div>

                  <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                        Trigger
                      </dt>
                      <dd className="mt-1 break-words text-sm font-semibold text-content dark:text-content-inverse">
                        {alert.title}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                        Mock source
                      </dt>
                      <dd className="mt-1 text-sm text-content dark:text-content-inverse">
                        <span className="block font-semibold">
                          {channel.label}
                        </span>
                        <span className="mt-1 block text-xs text-content-muted dark:text-slate-300">
                          {channel.hint}
                        </span>
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                        Triggered
                      </dt>
                      <dd className="mt-1 text-sm text-content dark:text-content-inverse">
                        {alertTime.dateTime ? (
                          <time
                            aria-label={`${alertTime.relative}; ${alertTime.absolute} UTC`}
                            dateTime={alertTime.dateTime}
                            title={`${alertTime.absolute} UTC`}
                          >
                            {alertTime.relative}
                          </time>
                        ) : (
                          <span>{alertTime.relative}</span>
                        )}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                        Mock incident reference
                      </dt>
                      <dd className="mt-1 break-all font-mono text-sm font-semibold text-content dark:text-content-inverse">
                        {alert.incidentId}
                      </dd>
                    </div>
                  </dl>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

AlertList.propTypes = {
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      incidentId: PropTypes.string.isRequired,
      channel: PropTypes.oneOf(Object.values(ALERT_CHANNELS)).isRequired,
      severity: PropTypes.oneOf(Object.values(SEVERITIES)).isRequired,
      title: PropTypes.string.isRequired,
      createdAt: PropTypes.number.isRequired,
      acknowledged: PropTypes.bool.isRequired,
    }),
  ).isRequired,
  onAcknowledgeAlert: PropTypes.func,
  acknowledgingAlertId: PropTypes.string,
  disabled: PropTypes.bool,
  now: PropTypes.number,
  className: PropTypes.string,
};

export default AlertList;