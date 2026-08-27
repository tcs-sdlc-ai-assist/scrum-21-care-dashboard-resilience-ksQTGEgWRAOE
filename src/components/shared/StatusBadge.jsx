import PropTypes from 'prop-types';
import {
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
} from '../../constants/messages.js';

const STATUS_TONES = Object.freeze({
  HEALTHY: 'healthy',
  CLOSED: 'healthy',
  PRIMARY: 'healthy',
  SECONDARY: 'recovering',
  DEGRADED: 'degraded',
  TIMEOUT: 'critical',
  INVALID_PAYLOAD: 'critical',
  FAILED: 'critical',
  OPEN: 'critical',
  NONE: 'critical',
  HIGH: 'critical',
  CRITICAL: 'critical',
  ACTIVE: 'critical',
  HALF_OPEN: 'recovering',
  RECOVERED: 'recovering',
  FALLBACK: 'fallback',
  LOW: 'unknown',
  MEDIUM: 'degraded',
});

const TONE_CLASSES = Object.freeze({
  healthy:
    'border-status-healthy-border bg-status-healthy-surface text-status-healthy',
  degraded:
    'border-status-degraded-border bg-status-degraded-surface text-status-degraded',
  critical:
    'border-status-critical-border bg-status-critical-surface text-status-critical',
  recovering:
    'border-status-recovering-border bg-status-recovering-surface text-status-recovering',
  fallback:
    'border-status-fallback-border bg-status-fallback-surface text-status-fallback',
  unknown:
    'border-status-unknown-border bg-status-unknown-surface text-status-unknown',
});

const TONE_SYMBOLS = Object.freeze({
  healthy: '✓',
  degraded: '!',
  critical: '×',
  recovering: '↻',
  fallback: '↪',
  unknown: '•',
});

/**
 * @param {string} status
 * @returns {string}
 */
function normalizeStatus(status) {
  return status.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * @param {string} status
 * @returns {string}
 */
function createFallbackLabel(status) {
  const normalized = normalizeStatus(status);

  if (normalized.length === 0) {
    return 'Unknown';
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
 * Renders a compact status indicator with visible text and a non-color visual
 * symbol. The hidden description provides additional context to assistive
 * technology without turning routine status rendering into a live update.
 *
 * @param {{
 *   status: string,
 *   label?: string,
 *   description?: string,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function StatusBadge({
  status,
  label = undefined,
  description = undefined,
  className = '',
}) {
  const normalizedStatus = normalizeStatus(status);
  const tone = STATUS_TONES[normalizedStatus] ?? 'unknown';
  const visibleLabel =
    label ?? STATUS_LABELS[normalizedStatus] ?? createFallbackLabel(status);
  const accessibleDescription =
    description ?? STATUS_DESCRIPTIONS[normalizedStatus];

  return (
    <span
      className={[
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4',
        TONE_CLASSES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-status={normalizedStatus || 'UNKNOWN'}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[0.7rem] font-bold leading-none"
      >
        {TONE_SYMBOLS[tone]}
      </span>
      <span>{visibleLabel}</span>
      {accessibleDescription ? (
        <span className="sr-only">. {accessibleDescription}</span>
      ) : null}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  className: PropTypes.string,
};

export default StatusBadge;