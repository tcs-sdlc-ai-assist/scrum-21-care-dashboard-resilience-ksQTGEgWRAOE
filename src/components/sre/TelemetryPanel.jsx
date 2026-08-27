import { useId } from 'react';
import PropTypes from 'prop-types';
import {
  SRE_MESSAGES,
} from '../../constants/messages.js';
import {
  DEPENDENCIES,
  PROFILE_SOURCES,
} from '../../domain/constants.js';
import { formatRelativeTime } from '../../utils/clock.js';
import ProfileSourceBadge from '../clinical/ProfileSourceBadge.jsx';
import StatusBadge from '../shared/StatusBadge.jsx';

const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;
const MAX_VISUALIZATION_POINTS = 12;
const PROFILE_SOURCE_VALUES = Object.freeze(
  Object.values(PROFILE_SOURCES),
);

const LATENCY_HEIGHT_CLASSES = Object.freeze([
  'h-2',
  'h-4',
  'h-7',
  'h-12',
  'h-16',
  'h-20',
]);

const HEALTH_BAR_CLASSES = Object.freeze({
  HEALTHY: 'border-status-healthy-border bg-status-healthy',
  DEGRADED: 'border-status-degraded-border bg-status-degraded',
  TIMEOUT: 'border-status-critical-border bg-status-critical',
  INVALID_PAYLOAD:
    'border-status-critical-border bg-status-critical',
  FAILED: 'border-status-critical-border bg-status-critical',
  UNKNOWN: 'border-status-unknown-border bg-status-unknown',
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
 * @param {unknown} value
 * @returns {string}
 */
function normalizeStatus(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'UNKNOWN';
  }

  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatMetricCount(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString('en-US')
    : 'Unavailable';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatLatency(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? `${value.toLocaleString('en-US')} ms`
    : 'Unavailable';
}

/**
 * @param {unknown} source
 * @returns {'PRIMARY'|'SECONDARY'|'FALLBACK'|'NONE'}
 */
function normalizeProfileSource(source) {
  return PROFILE_SOURCE_VALUES.includes(source)
    ? source
    : PROFILE_SOURCES.NONE;
}

/**
 * @param {unknown} dependencyId
 * @param {unknown} displayName
 * @returns {string}
 */
function resolveDependencyName(dependencyId, displayName) {
  if (
    typeof displayName === 'string' &&
    displayName.trim().length > 0
  ) {
    return displayName;
  }

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
 * @param {unknown} latency
 * @returns {string}
 */
function getLatencyHeightClass(latency) {
  if (!Number.isSafeInteger(latency) || latency < 0) {
    return LATENCY_HEIGHT_CLASSES[0];
  }

  if (latency <= 150) {
    return LATENCY_HEIGHT_CLASSES[1];
  }

  if (latency <= 300) {
    return LATENCY_HEIGHT_CLASSES[2];
  }

  if (latency <= 600) {
    return LATENCY_HEIGHT_CLASSES[3];
  }

  if (latency <= 1_000) {
    return LATENCY_HEIGHT_CLASSES[4];
  }

  return LATENCY_HEIGHT_CLASSES[5];
}

/**
 * @param {unknown} timestamp
 * @param {unknown} now
 * @returns {{dateTime?: string, relative: string, absolute?: string}}
 */
function formatSampleTime(timestamp, now) {
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
 * Presents bounded browser-local mock telemetry as an accessible metric
 * summary and compact latency history. It makes no live-monitoring claim and
 * does not render profile or fallback payloads.
 *
 * @param {{
 *   telemetry: ReadonlyArray<{
 *     timestamp: number,
 *     dependencyId: string,
 *     displayName?: string,
 *     status: string,
 *     responseTimeMs: number,
 *     failureCount: number,
 *     circuit: string,
 *     dataSource: string,
 *     incidentActivity: number
 *   }>,
 *   pollingActive?: boolean,
 *   now?: number,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function TelemetryPanel({
  telemetry,
  pollingActive = false,
  now = undefined,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const latestSample =
    telemetry.length > 0
      ? telemetry[telemetry.length - 1]
      : null;
  const visualizationPoints = telemetry.slice(
    -MAX_VISUALIZATION_POINTS,
  );
  const latestTime = formatSampleTime(
    latestSample?.timestamp,
    now,
  );
  const latestDependencyName = resolveDependencyName(
    latestSample?.dependencyId,
    latestSample?.displayName,
  );
  const latestStatus = normalizeStatus(latestSample?.status);
  const latestCircuit = normalizeStatus(latestSample?.circuit);
  const latestSource = normalizeProfileSource(
    latestSample?.dataSource,
  );

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
              {SRE_MESSAGES.telemetryTitle}
            </h2>
            <p
              className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200"
              id={descriptionId}
            >
              {SRE_MESSAGES.telemetryNotice}
            </p>
          </div>

          <StatusBadge
            description={
              pollingActive
                ? 'Browser-local represented polling is active.'
                : 'Browser-local represented polling is paused.'
            }
            label={
              pollingActive
                ? 'Mock polling active'
                : 'Mock polling paused'
            }
            status={pollingActive ? 'HEALTHY' : 'UNKNOWN'}
          />
        </div>
      </header>

      {latestSample === null ? (
        <div className="p-4 sm:p-6">
          <div className="rounded-lg border border-slate-300 bg-canvas-muted p-5 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="font-semibold text-content dark:text-content-inverse">
              {SRE_MESSAGES.noTelemetryTitle}
            </h3>
            <p className="mt-2 max-w-prose text-sm text-content-muted dark:text-slate-200">
              {SRE_MESSAGES.noTelemetryBody}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                Latest mock sample
              </p>
              <p className="mt-1 font-semibold text-content dark:text-content-inverse">
                {latestDependencyName}
              </p>
            </div>

            <p className="text-sm text-content-muted dark:text-slate-200">
              {latestTime.dateTime ? (
                <time
                  aria-label={`${latestTime.relative}; ${latestTime.absolute} UTC`}
                  dateTime={latestTime.dateTime}
                  title={`${latestTime.absolute} UTC`}
                >
                  {latestTime.relative}
                </time>
              ) : (
                <span>{latestTime.relative}</span>
              )}
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                {SRE_MESSAGES.healthStatus}
              </dt>
              <dd className="mt-2">
                <StatusBadge status={latestStatus} />
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                {SRE_MESSAGES.responseTime}
              </dt>
              <dd className="mt-2 font-mono text-lg font-bold text-content dark:text-content-inverse">
                {formatLatency(latestSample.responseTimeMs)}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                {SRE_MESSAGES.failureCount}
              </dt>
              <dd className="mt-2 font-mono text-lg font-bold text-content dark:text-content-inverse">
                {formatMetricCount(latestSample.failureCount)}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                {SRE_MESSAGES.circuitState}
              </dt>
              <dd className="mt-2">
                <StatusBadge status={latestCircuit} />
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                {SRE_MESSAGES.dataSource}
              </dt>
              <dd className="mt-2">
                <ProfileSourceBadge source={latestSource} />
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                Represented polling
              </dt>
              <dd className="mt-2 font-semibold text-content dark:text-content-inverse">
                {pollingActive ? 'Active locally' : 'Paused locally'}
              </dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300">
                {SRE_MESSAGES.incidentActivity}
              </dt>
              <dd className="mt-2 flex items-baseline gap-2 text-content dark:text-content-inverse">
                <span className="font-mono text-lg font-bold">
                  {formatMetricCount(
                    latestSample.incidentActivity,
                  )}
                </span>
                <span className="text-sm text-content-muted dark:text-slate-200">
                  active mock incident records
                </span>
              </dd>
            </div>
          </dl>

          <figure
            aria-labelledby={`${generatedId}-chart-title`}
            className="rounded-lg border border-slate-200 bg-canvas-muted p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <figcaption>
              <h3
                className="font-semibold text-content dark:text-content-inverse"
                id={`${generatedId}-chart-title`}
              >
                Recent mock response-time samples
              </h3>
              <p className="mt-1 text-sm text-content-muted dark:text-slate-200">
                A compact browser-local history of up to 12 samples.
                Taller bars represent greater response time.
              </p>
            </figcaption>

            <ol className="mt-5 flex h-24 items-end gap-1.5 border-b border-slate-400 px-1 dark:border-slate-500 sm:gap-2">
              {visualizationPoints.map((sample, index) => {
                const status = normalizeStatus(sample.status);
                const sampleTime = formatSampleTime(
                  sample.timestamp,
                  now,
                );
                const dependencyName = resolveDependencyName(
                  sample.dependencyId,
                  sample.displayName,
                );
                const latencyLabel = formatLatency(
                  sample.responseTimeMs,
                );

                return (
                  <li
                    className="flex h-full min-w-0 flex-1 items-end"
                    key={`${sample.timestamp}-${sample.dependencyId}-${index}`}
                  >
                    <span className="sr-only">
                      {dependencyName}, {latencyLabel}, status{' '}
                      {status.toLowerCase().replaceAll('_', ' ')},
                      failure count{' '}
                      {formatMetricCount(sample.failureCount)},
                      circuit{' '}
                      {normalizeStatus(sample.circuit)
                        .toLowerCase()
                        .replaceAll('_', ' ')}
                      , source{' '}
                      {normalizeProfileSource(
                        sample.dataSource,
                      ).toLowerCase()}
                      , incident activity{' '}
                      {formatMetricCount(sample.incidentActivity)},{' '}
                      {sampleTime.relative}.
                    </span>
                    <span
                      aria-hidden="true"
                      className={[
                        'block w-full min-w-1 rounded-t border transition-[height] duration-standard motion-reduce:transition-none',
                        getLatencyHeightClass(
                          sample.responseTimeMs,
                        ),
                        HEALTH_BAR_CLASSES[status] ??
                          HEALTH_BAR_CLASSES.UNKNOWN,
                      ].join(' ')}
                    />
                  </li>
                );
              })}
            </ol>

            <div
              aria-hidden="true"
              className="mt-2 flex justify-between text-xs text-content-subtle dark:text-slate-300"
            >
              <span>Older</span>
              <span>Newer</span>
            </div>
          </figure>
        </div>
      )}
    </section>
  );
}

TelemetryPanel.propTypes = {
  telemetry: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.number.isRequired,
      dependencyId: PropTypes.string.isRequired,
      displayName: PropTypes.string,
      status: PropTypes.string.isRequired,
      responseTimeMs: PropTypes.number.isRequired,
      failureCount: PropTypes.number.isRequired,
      circuit: PropTypes.string.isRequired,
      dataSource: PropTypes.string.isRequired,
      incidentActivity: PropTypes.number.isRequired,
    }),
  ).isRequired,
  pollingActive: PropTypes.bool,
  now: PropTypes.number,
  className: PropTypes.string,
};

export default TelemetryPanel;