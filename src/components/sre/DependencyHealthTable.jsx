import { useId } from 'react';
import PropTypes from 'prop-types';
import {
  ACCESSIBILITY_MESSAGES,
  DEMO_MESSAGES,
  SRE_MESSAGES,
} from '../../constants/messages.js';
import {
  DEPENDENCIES,
  HEALTH_STATES,
  RESPONSE_CONDITIONS,
} from '../../domain/constants.js';
import { formatRelativeTime } from '../../utils/clock.js';
import StatusBadge from '../shared/StatusBadge.jsx';

const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;

const RESPONSE_CONDITION_LABELS = Object.freeze({
  [RESPONSE_CONDITIONS.NORMAL]: DEMO_MESSAGES.normalCondition,
  [RESPONSE_CONDITIONS.DEGRADED]: DEMO_MESSAGES.degradedCondition,
  [RESPONSE_CONDITIONS.TIMEOUT]: DEMO_MESSAGES.timeoutCondition,
  [RESPONSE_CONDITIONS.INVALID_PAYLOAD]:
    DEMO_MESSAGES.invalidPayloadCondition,
  [RESPONSE_CONDITIONS.FAILURE]: DEMO_MESSAGES.failureCondition,
  [HEALTH_STATES.HEALTHY]: DEMO_MESSAGES.normalCondition,
  [HEALTH_STATES.DEGRADED]: DEMO_MESSAGES.degradedCondition,
  [HEALTH_STATES.TIMEOUT]: DEMO_MESSAGES.timeoutCondition,
  [HEALTH_STATES.INVALID_PAYLOAD]:
    DEMO_MESSAGES.invalidPayloadCondition,
  [HEALTH_STATES.FAILED]: DEMO_MESSAGES.failureCondition,
});

const MOBILE_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-slate-300 md:hidden';

const CELL_CLASS =
  'flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 text-right text-sm text-content dark:border-slate-700 dark:text-content-inverse md:table-cell md:border-0 md:px-4 md:py-3 md:text-left md:align-middle';

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
function normalizeCode(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[\s-]+/g, '_')
    : '';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function humanizeCode(value) {
  const normalized = normalizeCode(value);

  if (normalized.length === 0) {
    return 'Unavailable';
  }

  return normalized
    .split('_')
    .map(
      (word) =>
        `${word.charAt(0)}${word.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

/**
 * @param {unknown} dependency
 * @returns {string}
 */
function resolveHealthStatus(dependency) {
  const status = dependency?.status ?? dependency?.health;
  return typeof status === 'string' && status.trim().length > 0
    ? status
    : 'UNKNOWN';
}

/**
 * @param {unknown} dependency
 * @returns {string}
 */
function resolveResponseCondition(dependency) {
  const value =
    dependency?.responseCondition ??
    dependency?.condition ??
    dependency?.status ??
    dependency?.health;
  const normalized = normalizeCode(value);

  return (
    RESPONSE_CONDITION_LABELS[normalized] ??
    humanizeCode(value)
  );
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatResponseTime(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? `${value.toLocaleString('en-US')} ms`
    : 'Unavailable';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatCount(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString('en-US')
    : 'Unavailable';
}

/**
 * @param {unknown} timestamp
 * @param {unknown} now
 * @returns {{dateTime?: string, relative: string, absolute?: string}}
 */
function formatLastEvent(timestamp, now) {
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
 * @param {ReadonlyArray<object>} dependencies
 * @returns {ReadonlyArray<object>}
 */
function createDependencyRows(dependencies) {
  return Object.freeze(
    DEPENDENCIES.map((definition) => {
      const dependency = dependencies.find(
        (item) =>
          (item?.dependencyId ?? item?.id) === definition.id,
      );

      return dependency ?? Object.freeze({
        dependencyId: definition.id,
        displayName: definition.displayName,
        status: 'UNKNOWN',
        latencyMs: undefined,
        failureCount: undefined,
        consecutiveFailureCount: undefined,
        circuit: 'UNKNOWN',
        lastCheckedAt: undefined,
      });
    }),
  );
}

/**
 * Renders the three fixed mock dependencies as a semantic table on larger
 * screens and card-like rows on smaller screens. Statuses include text and
 * symbols so meaning is not conveyed by color alone.
 *
 * @param {{
 *   dependencies: ReadonlyArray<{
 *     dependencyId?: string,
 *     id?: string,
 *     displayName?: string,
 *     name?: string,
 *     status?: string,
 *     health?: string,
 *     responseCondition?: string,
 *     condition?: string,
 *     latencyMs?: number,
 *     responseTimeMs?: number,
 *     failureCount?: number,
 *     consecutiveFailureCount?: number,
 *     consecutiveFailures?: number,
 *     circuit?: string,
 *     circuitState?: string,
 *     lastCheckedAt?: number,
 *     lastEventAt?: number
 *   }>,
 *   now?: number,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function DependencyHealthTable({
  dependencies,
  now = undefined,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const rows = createDependencyRows(dependencies);

  return (
    <section
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
        <h2
          className="text-xl font-bold text-content dark:text-content-inverse"
          id={titleId}
        >
          {SRE_MESSAGES.dependencyHealthTitle}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
          Current browser-local status for the three fixed mock
          dependencies.
        </p>
      </header>

      <div className="p-3 sm:p-4 md:p-0">
        <table className="block w-full border-separate border-spacing-0 md:table">
          <caption className="sr-only">
            {ACCESSIBILITY_MESSAGES.tableCaption}
          </caption>

          <thead className="sr-only md:not-sr-only md:table-header-group">
            <tr className="bg-canvas-muted text-left text-xs uppercase tracking-wide text-content-muted dark:bg-slate-800 dark:text-slate-200">
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.dependencyName}
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.healthStatus}
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Response condition
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.responseTime}
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.failureCount}
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.consecutiveFailures}
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.circuitState}
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                {SRE_MESSAGES.lastChecked}
              </th>
            </tr>
          </thead>

          <tbody className="grid gap-3 md:table-row-group">
            {rows.map((dependency) => {
              const dependencyId =
                dependency.dependencyId ?? dependency.id;
              const definition = DEPENDENCIES.find(
                (item) => item.id === dependencyId,
              );
              const displayName =
                dependency.displayName ??
                dependency.name ??
                definition?.displayName ??
                dependencyId;
              const healthStatus =
                resolveHealthStatus(dependency);
              const responseCondition =
                resolveResponseCondition(dependency);
              const responseTime =
                dependency.latencyMs ??
                dependency.responseTimeMs;
              const consecutiveFailures =
                dependency.consecutiveFailureCount ??
                dependency.consecutiveFailures;
              const circuit =
                dependency.circuit ??
                dependency.circuitState ??
                'UNKNOWN';
              const lastEvent = formatLastEvent(
                dependency.lastCheckedAt ??
                  dependency.lastEventAt,
                now,
              );

              return (
                <tr
                  className="block overflow-hidden rounded-lg border border-slate-300 bg-surface shadow-sm dark:border-slate-700 dark:bg-surface-inverse md:table-row md:rounded-none md:border-0 md:shadow-none md:odd:bg-surface md:even:bg-canvas-muted dark:md:odd:bg-surface-inverse dark:md:even:bg-slate-800"
                  key={dependencyId}
                >
                  <th
                    className="block bg-canvas-muted px-4 py-3 text-left text-sm font-semibold text-content dark:bg-slate-800 dark:text-content-inverse md:table-cell md:bg-transparent md:align-middle dark:md:bg-transparent"
                    scope="row"
                  >
                    <span className="block">{displayName}</span>
                    <span className="mt-1 block font-mono text-xs font-normal text-content-subtle dark:text-slate-300">
                      {dependencyId}
                    </span>
                  </th>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      {SRE_MESSAGES.healthStatus}
                    </span>
                    <StatusBadge status={healthStatus} />
                  </td>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      Response condition
                    </span>
                    <span className="font-medium">
                      {responseCondition}
                    </span>
                  </td>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      {SRE_MESSAGES.responseTime}
                    </span>
                    <span className="font-mono font-semibold">
                      {formatResponseTime(responseTime)}
                    </span>
                  </td>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      {SRE_MESSAGES.failureCount}
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCount(dependency.failureCount)}
                    </span>
                  </td>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      {SRE_MESSAGES.consecutiveFailures}
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCount(consecutiveFailures)}
                    </span>
                  </td>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      {SRE_MESSAGES.circuitState}
                    </span>
                    <StatusBadge status={circuit} />
                  </td>

                  <td className={CELL_CLASS}>
                    <span
                      aria-hidden="true"
                      className={MOBILE_LABEL_CLASS}
                    >
                      {SRE_MESSAGES.lastChecked}
                    </span>
                    {lastEvent.dateTime ? (
                      <time
                        aria-label={`${lastEvent.relative}; ${lastEvent.absolute} UTC`}
                        dateTime={lastEvent.dateTime}
                        title={`${lastEvent.absolute} UTC`}
                      >
                        {lastEvent.relative}
                      </time>
                    ) : (
                      <span>{lastEvent.relative}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

DependencyHealthTable.propTypes = {
  dependencies: PropTypes.arrayOf(
    PropTypes.shape({
      dependencyId: PropTypes.string,
      id: PropTypes.string,
      displayName: PropTypes.string,
      name: PropTypes.string,
      status: PropTypes.string,
      health: PropTypes.string,
      responseCondition: PropTypes.string,
      condition: PropTypes.string,
      latencyMs: PropTypes.number,
      responseTimeMs: PropTypes.number,
      failureCount: PropTypes.number,
      consecutiveFailureCount: PropTypes.number,
      consecutiveFailures: PropTypes.number,
      circuit: PropTypes.string,
      circuitState: PropTypes.string,
      lastCheckedAt: PropTypes.number,
      lastEventAt: PropTypes.number,
    }),
  ).isRequired,
  now: PropTypes.number,
  className: PropTypes.string,
};

export default DependencyHealthTable;