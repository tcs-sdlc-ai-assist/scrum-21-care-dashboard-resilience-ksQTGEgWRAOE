import PropTypes from 'prop-types';
import {
  CLINICAL_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../../constants/messages.js';
import {
  HEALTH_STATES,
  PROFILE_SOURCES,
} from '../../domain/constants.js';
import { validateSyntheticRecord } from '../../utils/privacy.js';
import ProfileSourceBadge from './ProfileSourceBadge.jsx';
import StatusBadge from '../shared/StatusBadge.jsx';

const PROFILE_SOURCE_VALUES = Object.freeze(
  Object.values(PROFILE_SOURCES),
);

const RECOVERY_STATES = Object.freeze({
  IDLE: 'idle',
  RECOVERING: 'recovering',
  RECOVERED: 'recovered',
});

const VIEW_STATES = Object.freeze({
  AUTO: 'auto',
  LOADING: 'loading',
  EMPTY: 'empty',
  UNAVAILABLE: 'unavailable',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

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
 * @param {unknown} timestamp
 * @returns {string}
 */
function formatTimestamp(timestamp) {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    return 'Unavailable';
  }

  return DATE_FORMATTER.format(new Date(timestamp));
}

/**
 * Displays an approved, privacy-safe synthetic patient profile together with
 * its source and mock context eligibility. Raw repository identifiers and
 * unapproved profile fields are never rendered.
 *
 * @param {{
 *   profile?: {
 *     displayName: string,
 *     patientIdentifier: string,
 *     accountNumber: string,
 *     source: 'PRIMARY'|'SECONDARY'|'FALLBACK',
 *     generatedAt: number
 *   }|null,
 *   profileSource?: 'PRIMARY'|'SECONDARY'|'FALLBACK'|'NONE',
 *   available?: boolean,
 *   contextEligibility?: {
 *     status: string,
 *     available: boolean,
 *     lastCheckedAt?: number
 *   }|null,
 *   loading?: boolean,
 *   requested?: boolean,
 *   unavailable?: boolean,
 *   recoveryStatus?: 'idle'|'recovering'|'recovered',
 *   viewState?: 'auto'|'loading'|'empty'|'unavailable',
 *   onRequestProfile?: Function,
 *   requestDisabled?: boolean,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function PatientProfileCard({
  profile = null,
  profileSource = PROFILE_SOURCES.NONE,
  available = false,
  contextEligibility = null,
  loading = false,
  requested = false,
  unavailable = false,
  recoveryStatus = RECOVERY_STATES.IDLE,
  viewState = VIEW_STATES.AUTO,
  onRequestProfile = undefined,
  requestDisabled = false,
  className = '',
}) {
  const profileIsSafe =
    profile !== null && validateSyntheticRecord(profile);
  const normalizedSource = normalizeProfileSource(
    profileIsSafe ? profile.source : profileSource,
  );
  const eligibilityStatus =
    typeof contextEligibility?.status === 'string'
      ? contextEligibility.status
      : HEALTH_STATES.FAILED;
  const eligibilityAvailable =
    contextEligibility?.available === true;

  let resolvedViewState = viewState;

  if (resolvedViewState === VIEW_STATES.AUTO) {
    if (loading) {
      resolvedViewState = VIEW_STATES.LOADING;
    } else if (profileIsSafe) {
      resolvedViewState = 'profile';
    } else if (unavailable || (requested && !available)) {
      resolvedViewState = VIEW_STATES.UNAVAILABLE;
    } else {
      resolvedViewState = VIEW_STATES.EMPTY;
    }
  }

  /**
   * @returns {void}
   */
  function handleRequestProfile() {
    if (
      typeof onRequestProfile === 'function' &&
      !requestDisabled &&
      !loading
    ) {
      onRequestProfile();
    }
  }

  const showRequestAction =
    typeof onRequestProfile === 'function' &&
    resolvedViewState !== VIEW_STATES.LOADING;

  return (
    <section
      aria-labelledby="patient-profile-card-title"
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
              id="patient-profile-card-title"
            >
              {CLINICAL_MESSAGES.profileTitle}
            </h2>
            <p className="mt-1 text-sm text-content-muted dark:text-slate-200">
              Approved masked fields from a browser-local synthetic record.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-care-700 bg-care-50 px-2.5 py-1 text-xs font-semibold text-care-900 dark:border-care-200 dark:bg-care-950 dark:text-care-100">
            <span aria-hidden="true">◇</span>
            Synthetic data
          </span>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {recoveryStatus === RECOVERY_STATES.RECOVERING ? (
          <div
            className="mb-5 rounded-lg border border-status-recovering-border bg-status-recovering-surface p-4 text-sm text-status-recovering"
            role="status"
          >
            <p className="font-semibold">Mock recovery in progress</p>
            <p className="mt-1">
              The browser-local demo is checking the synthetic profile
              source.
            </p>
          </div>
        ) : null}

        {recoveryStatus === RECOVERY_STATES.RECOVERED ? (
          <div
            className="mb-5 rounded-lg border border-status-healthy-border bg-status-healthy-surface p-4 text-sm text-status-healthy"
            role="status"
          >
            <p className="font-semibold">Mock profile source recovered</p>
            <p className="mt-1">
              The browser-local recovery sequence completed.
            </p>
          </div>
        ) : null}

        {resolvedViewState === VIEW_STATES.LOADING ? (
          <div
            aria-live="polite"
            className="rounded-lg border border-care-300 bg-care-50 p-5 text-content dark:border-care-700 dark:bg-care-950 dark:text-care-100"
            role="status"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="motion-safe:animate-pulse"
              >
                …
              </span>
              <div>
                <p className="font-semibold">
                  {CLINICAL_MESSAGES.profileLoading}
                </p>
                <p className="mt-1 text-sm">
                  This action runs locally and does not contact a clinical
                  system.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {resolvedViewState === VIEW_STATES.EMPTY ? (
          <div className="rounded-lg border border-slate-300 bg-canvas-muted p-5 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="font-semibold text-content dark:text-content-inverse">
              {CLINICAL_MESSAGES.noProfileTitle}
            </h3>
            <p className="mt-2 text-sm text-content-muted dark:text-slate-200">
              {CLINICAL_MESSAGES.noProfileBody}
            </p>

            {showRequestAction ? (
              <button
                className="mt-4 min-h-touch rounded-lg bg-care-700 px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-care-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-care-200 dark:text-care-950 dark:hover:bg-care-100"
                disabled={requestDisabled}
                onClick={handleRequestProfile}
                type="button"
              >
                {CLINICAL_MESSAGES.requestProfile}
              </button>
            ) : null}
          </div>
        ) : null}

        {resolvedViewState === VIEW_STATES.UNAVAILABLE ? (
          <div
            className="rounded-lg border border-status-critical-border bg-status-critical-surface p-5 text-status-critical"
            role="status"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-bold"
              >
                ×
              </span>
              <div>
                <h3 className="font-semibold">
                  {CLINICAL_MESSAGES.profileUnavailableTitle}
                </h3>
                <p className="mt-2 text-sm">
                  {CLINICAL_MESSAGES.profileUnavailableBody}
                </p>

                {showRequestAction ? (
                  <button
                    className="mt-4 min-h-touch rounded-lg border border-status-critical-border bg-surface px-4 py-2.5 font-semibold text-status-critical transition-colors duration-fast hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-inverse dark:hover:bg-slate-800"
                    disabled={requestDisabled}
                    onClick={handleRequestProfile}
                    type="button"
                  >
                    {CLINICAL_MESSAGES.requestProfile}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {resolvedViewState === 'profile' && profileIsSafe ? (
          <div>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm font-semibold text-content-muted dark:text-slate-200">
                  Synthetic display name
                </dt>
                <dd className="mt-1 break-words font-semibold text-content dark:text-content-inverse">
                  {profile.displayName}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-sm font-semibold text-content-muted dark:text-slate-200">
                  {CLINICAL_MESSAGES.profileIdentifierLabel}
                </dt>
                <dd className="mt-1 font-mono text-content dark:text-content-inverse">
                  {profile.patientIdentifier}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-sm font-semibold text-content-muted dark:text-slate-200">
                  {CLINICAL_MESSAGES.accountNumberLabel}
                </dt>
                <dd className="mt-1 font-mono text-content dark:text-content-inverse">
                  {profile.accountNumber}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-sm font-semibold text-content-muted dark:text-slate-200">
                  {CLINICAL_MESSAGES.sourceLabel}
                </dt>
                <dd className="mt-2">
                  <ProfileSourceBadge source={normalizedSource} />
                </dd>
              </div>

              <div className="min-w-0 sm:col-span-2">
                <dt className="text-sm font-semibold text-content-muted dark:text-slate-200">
                  {CLINICAL_MESSAGES.generatedAtLabel}
                </dt>
                <dd className="mt-1 text-content dark:text-content-inverse">
                  <time dateTime={new Date(profile.generatedAt).toISOString()}>
                    {formatTimestamp(profile.generatedAt)} UTC
                  </time>
                </dd>
              </div>
            </dl>

            {showRequestAction ? (
              <button
                className="mt-6 min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2.5 font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
                disabled={requestDisabled}
                onClick={handleRequestProfile}
                type="button"
              >
                {CLINICAL_MESSAGES.requestProfile}
              </button>
            ) : null}
          </div>
        ) : null}

        <section
          aria-labelledby="profile-context-title"
          className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3
                className="font-semibold text-content dark:text-content-inverse"
                id="profile-context-title"
              >
                {CLINICAL_MESSAGES.contextTitle}
              </h3>
              <p className="mt-1 text-sm text-content-muted dark:text-slate-200">
                {eligibilityAvailable
                  ? CLINICAL_MESSAGES.contextAvailable
                  : CLINICAL_MESSAGES.contextUnavailable}
              </p>
            </div>

            <StatusBadge
              description={
                eligibilityAvailable
                  ? CLINICAL_MESSAGES.contextAvailable
                  : CLINICAL_MESSAGES.contextUnavailable
              }
              label={eligibilityAvailable ? 'Available' : 'Unavailable'}
              status={eligibilityStatus}
            />
          </div>

          {Number.isSafeInteger(contextEligibility?.lastCheckedAt) ? (
            <p className="mt-3 text-xs text-content-subtle dark:text-slate-300">
              {CLINICAL_MESSAGES.generatedAtLabel.replace(
                'Generated',
                'Context checked',
              )}
              :{' '}
              <time
                dateTime={new Date(
                  contextEligibility.lastCheckedAt,
                ).toISOString()}
              >
                {formatTimestamp(contextEligibility.lastCheckedAt)} UTC
              </time>
            </p>
          ) : null}
        </section>

        <p className="mt-5 text-xs text-content-subtle dark:text-slate-300">
          {MOCK_BOUNDARY_MESSAGES.shortNotice}
        </p>
      </div>
    </section>
  );
}

PatientProfileCard.propTypes = {
  profile: PropTypes.shape({
    displayName: PropTypes.string.isRequired,
    patientIdentifier: PropTypes.string.isRequired,
    accountNumber: PropTypes.string.isRequired,
    source: PropTypes.oneOf([
      PROFILE_SOURCES.PRIMARY,
      PROFILE_SOURCES.SECONDARY,
      PROFILE_SOURCES.FALLBACK,
    ]).isRequired,
    generatedAt: PropTypes.number.isRequired,
  }),
  profileSource: PropTypes.oneOf(PROFILE_SOURCE_VALUES),
  available: PropTypes.bool,
  contextEligibility: PropTypes.shape({
    status: PropTypes.string.isRequired,
    available: PropTypes.bool.isRequired,
    lastCheckedAt: PropTypes.number,
  }),
  loading: PropTypes.bool,
  requested: PropTypes.bool,
  unavailable: PropTypes.bool,
  recoveryStatus: PropTypes.oneOf(Object.values(RECOVERY_STATES)),
  viewState: PropTypes.oneOf(Object.values(VIEW_STATES)),
  onRequestProfile: PropTypes.func,
  requestDisabled: PropTypes.bool,
  className: PropTypes.string,
};

export default PatientProfileCard;