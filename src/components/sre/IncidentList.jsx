import { useId } from 'react';
import PropTypes from 'prop-types';
import { SRE_MESSAGES } from '../../constants/messages.js';
import {
  CIRCUIT_STATES,
  DEPENDENCIES,
  DEPENDENCY_IDS,
  MAX_RECORDS,
  PROFILE_SOURCES,
  RECOVERY_STATUSES,
  SEVERITIES,
} from '../../domain/constants.js';
import { INCIDENT_TYPES } from '../../domain/model.js';
import { formatRelativeTime } from '../../utils/clock.js';
import { sanitizeDiagnosticSummary } from '../../utils/privacy.js';
import ProfileSourceBadge from '../clinical/ProfileSourceBadge.jsx';
import StatusBadge from '../shared/StatusBadge.jsx';

const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;

const INCIDENT_TYPE_LABELS = Object.freeze({
  [INCIDENT_TYPES.FAILOVER]: 'Failover',
  [INCIDENT_TYPES.FALLBACK_ACTIVATED]: 'Fallback activated',
  [INCIDENT_TYPES.RECOVERY]: 'Recovery',
  [INCIDENT_TYPES.EXPIRY]: 'Fallback expiry',
});

const DETAIL_TERM_CLASS =
  'text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300';

const DETAIL_VALUE_CLASS =
  'mt-1 break-words text-sm text-content dark:text-content-inverse';

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
 * @param {unknown} value
 * @returns {string}
 */
function humanizeCode(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Unavailable';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * @param {unknown} type
 * @returns {string}
 */
function resolveIncidentType(type) {
  return INCIDENT_TYPE_LABELS[type] ?? humanizeCode(type);
}

/**
 * @param {unknown} dependencyId
 * @returns {string}
 */
function resolveDependencyName(dependencyId) {
  return (
    DEPENDENCIES.find(
      (dependency) => dependency.id === dependencyId,
    )?.displayName ??
    (typeof dependencyId === 'string'
      ? dependencyId
      : 'Mock dependency')
  );
}

/**
 * @param {unknown} timestamp
 * @param {unknown} now
 * @returns {{dateTime?: string, relative: string, absolute?: string}}
 */
function formatIncidentTime(timestamp, now) {
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
 * Displays a bounded, ordered timeline of privacy-safe browser-local incident
 * lifecycle records. Diagnostic summaries are sanitized before rendering, and
 * no profile or fallback payload is presented.
 *
 * @param {{
 *   incidents: ReadonlyArray<{
 *     eventId: string,
 *     type: string,
 *     dependencyId: string,
 *     severity: string,
 *     condition: string,
 *     circuit: string,
 *     dataSource: string,
 *     occurredAt: number,
 *     recoveryStatus: string,
 *     diagnosticSummary: string
 *   }>,
 *   now?: number,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function IncidentList({
  incidents,
  now = undefined,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const visibleIncidents = incidents.slice(0, MAX_RECORDS);

  return (
    <section
      aria-describedby={descriptionId}
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
              {SRE_MESSAGES.incidentsTitle}
            </h2>
            <p
              className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200"
              id={descriptionId}
            >
              Ordered browser-local incident lifecycle events. Records contain
              synthetic operational details only and are shown newest first.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-care-700 bg-care-50 px-2.5 py-1 text-xs font-semibold text-care-900 dark:border-care-200 dark:bg-care-950 dark:text-care-100">
            <span aria-hidden="true">◇</span>
            Mock incidents only
          </span>
        </div>
      </header>

      {visibleIncidents.length === 0 ? (
        <div className="p-4 sm:p-6">
          <div className="rounded-lg border border-slate-300 bg-canvas-muted p-5 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="font-semibold text-content dark:text-content-inverse">
              {SRE_MESSAGES.noIncidentsTitle}
            </h3>
            <p className="mt-2 max-w-prose text-sm text-content-muted dark:text-slate-200">
              {SRE_MESSAGES.noIncidentsBody}
            </p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-slate-200 dark:divide-slate-700">
          {visibleIncidents.map((incident, index) => {
            const incidentTitleId =
              `${generatedId}-incident-${index}-title`;
            const incidentTime = formatIncidentTime(
              incident.occurredAt,
              now,
            );
            const incidentType = resolveIncidentType(incident.type);
            const dependencyName = resolveDependencyName(
              incident.dependencyId,
            );
            const diagnosticSummary = sanitizeDiagnosticSummary(
              incident.diagnosticSummary,
            );

            return (
              <li className="p-4 sm:p-6" key={incident.eventId}>
                <article aria-labelledby={incidentTitleId}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={incident.severity} />
                        <StatusBadge
                          description={
                            incident.recoveryStatus ===
                            RECOVERY_STATUSES.RECOVERED
                              ? 'This browser-local mock incident lifecycle event records recovery.'
                              : 'This browser-local mock incident lifecycle event remains active.'
                          }
                          status={incident.recoveryStatus}
                        />
                      </div>

                      <h3
                        className="mt-3 break-words text-lg font-bold text-content dark:text-content-inverse"
                        id={incidentTitleId}
                      >
                        {incidentType}
                      </h3>

                      <p className="mt-1 break-words text-sm text-content-muted dark:text-slate-200">
                        {incident.condition}
                      </p>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className={DETAIL_TERM_CLASS}>
                        Event time
                      </p>
                      <p className="mt-1 text-sm font-semibold text-content dark:text-content-inverse">
                        {incidentTime.dateTime ? (
                          <time
                            aria-label={`${incidentTime.relative}; ${incidentTime.absolute} UTC`}
                            dateTime={incidentTime.dateTime}
                            title={`${incidentTime.absolute} UTC`}
                          >
                            {incidentTime.relative}
                          </time>
                        ) : (
                          <span>{incidentTime.relative}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Mock event identifier
                      </dt>
                      <dd className={`${DETAIL_VALUE_CLASS} font-mono font-semibold`}>
                        {incident.eventId}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Event type
                      </dt>
                      <dd className={`${DETAIL_VALUE_CLASS} font-semibold`}>
                        {incidentType}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Mock dependency
                      </dt>
                      <dd className={DETAIL_VALUE_CLASS}>
                        <span className="block font-semibold">
                          {dependencyName}
                        </span>
                        <span className="mt-1 block break-all font-mono text-xs text-content-muted dark:text-slate-300">
                          {incident.dependencyId}
                        </span>
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Severity
                      </dt>
                      <dd className="mt-2">
                        <StatusBadge status={incident.severity} />
                      </dd>
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                      <dt className={DETAIL_TERM_CLASS}>
                        Trigger
                      </dt>
                      <dd className={`${DETAIL_VALUE_CLASS} font-semibold`}>
                        {incident.condition}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Circuit state
                      </dt>
                      <dd className="mt-2">
                        <StatusBadge status={incident.circuit} />
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Data source
                      </dt>
                      <dd className="mt-2">
                        <ProfileSourceBadge
                          source={incident.dataSource}
                        />
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Recovery status
                      </dt>
                      <dd className="mt-2">
                        <StatusBadge
                          status={incident.recoveryStatus}
                        />
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className={DETAIL_TERM_CLASS}>
                        Event time
                      </dt>
                      <dd className={DETAIL_VALUE_CLASS}>
                        {incidentTime.dateTime ? (
                          <time dateTime={incidentTime.dateTime}>
                            <span className="block font-semibold">
                              {incidentTime.absolute} UTC
                            </span>
                            <span className="mt-1 block text-xs text-content-muted dark:text-slate-300">
                              {incidentTime.relative}
                            </span>
                          </time>
                        ) : (
                          <span>{incidentTime.relative}</span>
                        )}
                      </dd>
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                      <dt className={DETAIL_TERM_CLASS}>
                        Sanitized diagnostic summary
                      </dt>
                      <dd className={`${DETAIL_VALUE_CLASS} font-mono font-semibold`}>
                        {diagnosticSummary}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-5 text-xs text-content-subtle dark:text-slate-300">
                    Browser-local mock timeline record. No profile payload or
                    external incident data is included.
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

IncidentList.propTypes = {
  incidents: PropTypes.arrayOf(
    PropTypes.shape({
      eventId: PropTypes.string.isRequired,
      type: PropTypes.oneOf(Object.values(INCIDENT_TYPES)).isRequired,
      dependencyId: PropTypes.oneOf(
        Object.values(DEPENDENCY_IDS),
      ).isRequired,
      severity: PropTypes.oneOf(Object.values(SEVERITIES)).isRequired,
      condition: PropTypes.string.isRequired,
      circuit: PropTypes.oneOf(
        Object.values(CIRCUIT_STATES),
      ).isRequired,
      dataSource: PropTypes.oneOf(
        Object.values(PROFILE_SOURCES),
      ).isRequired,
      occurredAt: PropTypes.number.isRequired,
      recoveryStatus: PropTypes.oneOf(
        Object.values(RECOVERY_STATUSES),
      ).isRequired,
      diagnosticSummary: PropTypes.string.isRequired,
    }),
  ).isRequired,
  now: PropTypes.number,
  className: PropTypes.string,
};

export default IncidentList;