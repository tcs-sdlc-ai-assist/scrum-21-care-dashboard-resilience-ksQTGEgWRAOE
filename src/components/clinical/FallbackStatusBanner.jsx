import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import {
  APP_MESSAGES,
  CLINICAL_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../../constants/messages.js';
import { PROFILE_SOURCES } from '../../domain/constants.js';
import { formatCountdown } from '../../utils/clock.js';
import ProfileSourceBadge from './ProfileSourceBadge.jsx';
import StatusBadge from '../shared/StatusBadge.jsx';

const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isValidTimestamp(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_DATE_TIMESTAMP
  );
}

/**
 * @param {unknown} remainingMs
 * @param {unknown} expiresAt
 * @returns {number|null}
 */
function resolveRemainingTime(remainingMs, expiresAt) {
  if (Number.isSafeInteger(remainingMs) && remainingMs >= 0) {
    return remainingMs;
  }

  if (isValidTimestamp(expiresAt)) {
    return Math.max(0, expiresAt - Date.now());
  }

  return null;
}

/**
 * Presents browser-local synthetic fallback status without rendering profile
 * details. Dismissal applies only to the current non-critical event; critical
 * or expired fallback states always remain visible, and a new event ID
 * automatically reappears.
 *
 * @param {{
 *   active?: boolean,
 *   eventId: string,
 *   title?: string,
 *   body?: string,
 *   critical?: boolean,
 *   dismissible?: boolean,
 *   expiresAt?: number,
 *   remainingMs?: number,
 *   profileSource?: 'PRIMARY'|'SECONDARY'|'FALLBACK'|'NONE',
 *   onDismiss?: (eventId: string) => void,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement|null}
 */
export function FallbackStatusBanner({
  active = true,
  eventId,
  title = CLINICAL_MESSAGES.fallbackTitle,
  body = CLINICAL_MESSAGES.fallbackBody,
  critical = true,
  dismissible = false,
  expiresAt = undefined,
  remainingMs = undefined,
  profileSource = PROFILE_SOURCES.FALLBACK,
  onDismiss = undefined,
  className = '',
}) {
  const generatedId = useId();
  const [dismissedEventId, setDismissedEventId] = useState(null);
  const resolvedRemainingMs = resolveRemainingTime(
    remainingMs,
    expiresAt,
  );
  const expired = resolvedRemainingMs === 0;
  const effectiveCritical = critical || expired;
  const canDismiss =
    dismissible &&
    !effectiveCritical &&
    typeof onDismiss === 'function';
  const dismissed =
    canDismiss && dismissedEventId === eventId;

  if (!active || dismissed) {
    return null;
  }

  const expiryDateTime = isValidTimestamp(expiresAt)
    ? new Date(expiresAt).toISOString()
    : undefined;
  const countdown =
    resolvedRemainingMs === null
      ? 'Unavailable'
      : formatCountdown(resolvedRemainingMs);

  /**
   * @returns {void}
   */
  function handleDismiss() {
    if (!canDismiss) {
      return;
    }

    setDismissedEventId(eventId);
    onDismiss(eventId);
  }

  return (
    <aside
      aria-labelledby={`${generatedId}-title`}
      className={[
        'rounded-panel border p-4 shadow-panel sm:p-5',
        effectiveCritical
          ? 'border-status-critical-border bg-status-critical-surface text-status-critical'
          : 'border-status-fallback-border bg-status-fallback-surface text-status-fallback',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={effectiveCritical ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current text-lg font-bold"
        >
          {effectiveCritical ? '!' : '↪'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="text-lg font-bold"
                  id={`${generatedId}-title`}
                >
                  {title}
                </h2>
                <StatusBadge
                  description={
                    effectiveCritical
                      ? 'The active browser-local fallback requires attention.'
                      : 'A browser-local synthetic fallback is active.'
                  }
                  label={
                    effectiveCritical
                      ? 'Critical fallback'
                      : 'Fallback active'
                  }
                  status={
                    effectiveCritical ? 'CRITICAL' : 'FALLBACK'
                  }
                />
              </div>

              <p className="mt-2 max-w-prose text-sm">
                {expired ? CLINICAL_MESSAGES.fallbackExpired : body}
              </p>
            </div>

            {canDismiss ? (
              <button
                className="min-h-touch shrink-0 rounded-lg border border-current bg-surface px-3 py-2 text-sm font-semibold transition-colors duration-fast hover:bg-orange-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 dark:bg-surface-inverse dark:hover:bg-slate-800"
                onClick={handleDismiss}
                type="button"
              >
                {APP_MESSAGES.dismiss}
                <span className="sr-only"> fallback status</span>
              </button>
            ) : null}
          </div>

          <dl className="mt-4 grid gap-4 border-t border-current/20 pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide">
                {CLINICAL_MESSAGES.sourceLabel}
              </dt>
              <dd className="mt-2">
                <ProfileSourceBadge source={profileSource} />
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide">
                {CLINICAL_MESSAGES.fallbackExpiryLabel}
              </dt>
              <dd className="mt-2 font-semibold">
                {expiryDateTime ? (
                  <time
                    aria-label={`${CLINICAL_MESSAGES.fallbackExpiryLabel}: ${countdown}`}
                    dateTime={expiryDateTime}
                  >
                    {countdown}
                  </time>
                ) : (
                  <span>{countdown}</span>
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs">
            {MOCK_BOUNDARY_MESSAGES.shortNotice}
          </p>
        </div>
      </div>
    </aside>
  );
}

FallbackStatusBanner.propTypes = {
  active: PropTypes.bool,
  eventId: PropTypes.string.isRequired,
  title: PropTypes.string,
  body: PropTypes.string,
  critical: PropTypes.bool,
  dismissible: PropTypes.bool,
  expiresAt: PropTypes.number,
  remainingMs: PropTypes.number,
  profileSource: PropTypes.oneOf(Object.values(PROFILE_SOURCES)),
  onDismiss: PropTypes.func,
  className: PropTypes.string,
};

export default FallbackStatusBanner;