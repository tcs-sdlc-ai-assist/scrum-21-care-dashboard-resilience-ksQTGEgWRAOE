import {
  useEffect,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import FallbackStatusBanner from '../components/clinical/FallbackStatusBanner.jsx';
import PatientProfileCard from '../components/clinical/PatientProfileCard.jsx';
import ProfileSourceBadge from '../components/clinical/ProfileSourceBadge.jsx';
import LiveRegion from '../components/shared/LiveRegion.jsx';
import {
  CLINICAL_MESSAGES,
  DEMO_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../constants/messages.js';
import {
  LIFECYCLE_COMMAND_TYPES,
} from '../contracts/ResilienceLifecycleContract.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { PROFILE_SOURCES } from '../domain/constants.js';
import { INCIDENT_TYPES } from '../domain/model.js';
import {
  ACTIVE_PROFILE_ID,
  getProfileFixture,
} from '../fixtures/profiles.js';
import {
  selectPrivacySafeClinicalModel,
  selectPrivacySafeProfile,
} from '../selectors/PrivacySelectors.js';
import {
  selectFallbackBanner,
} from '../selectors/ViewModelSelectors.js';

const RECOVERY_STATES = Object.freeze({
  IDLE: 'idle',
  RECOVERING: 'recovering',
  RECOVERED: 'recovered',
});

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
 * @param {unknown} result
 * @returns {string}
 */
function resolveActionError(result) {
  if (
    typeof result === 'object' &&
    result !== null &&
    typeof result.error === 'object' &&
    result.error !== null &&
    typeof result.error.message === 'string' &&
    result.error.message.length > 0
  ) {
    return result.error.message;
  }

  return DEMO_MESSAGES.actionFailed;
}

/**
 * @param {ReturnType<typeof selectPrivacySafeClinicalModel>} model
 * @param {number} generatedAt
 * @returns {ReturnType<typeof selectPrivacySafeProfile>}
 */
function resolveProfile(model, generatedAt) {
  if (model.profile !== null) {
    return model.profile;
  }

  if (
    model.profileSource !== PROFILE_SOURCES.PRIMARY &&
    model.profileSource !== PROFILE_SOURCES.SECONDARY
  ) {
    return null;
  }

  const fixture = getProfileFixture(
    ACTIVE_PROFILE_ID,
    model.profileSource,
    generatedAt,
  );

  return fixture === null
    ? null
    : selectPrivacySafeProfile(fixture);
}

/**
 * Clinical role dashboard for reviewing an allowlisted synthetic profile,
 * its current mock source, context eligibility, and authoritative
 * browser-local fallback state.
 *
 * @param {{className?: string}} props
 * @returns {import('react').ReactElement}
 */
export function ClinicalDashboard({ className = '' }) {
  const { snapshot, dispatch } = useDashboard();
  const mountedRef = useRef(false);
  const [profileRequested, setProfileRequested] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [requestError, setRequestError] = useState('');

  const clinicalModel = selectPrivacySafeClinicalModel(snapshot);
  const fallbackBanner = selectFallbackBanner(snapshot);
  const profile = resolveProfile(clinicalModel, snapshot.now);
  const latestIncident =
    snapshot.incidents.length > 0
      ? snapshot.incidents[snapshot.incidents.length - 1]
      : null;
  const fallbackExpired =
    fallbackBanner === null &&
    latestIncident?.type === INCIDENT_TYPES.EXPIRY &&
    clinicalModel.profileSource === PROFILE_SOURCES.NONE;
  const recoveryStatus =
    latestIncident?.type === INCIDENT_TYPES.RECOVERY &&
    clinicalModel.profileSource === PROFILE_SOURCES.PRIMARY
      ? RECOVERY_STATES.RECOVERED
      : RECOVERY_STATES.IDLE;
  const effectiveRequested =
    profileRequested ||
    fallbackExpired ||
    clinicalModel.available;
  const profileUnavailable =
    effectiveRequested &&
    !clinicalModel.available;
  const announcementMessage = fallbackBanner !== null
    ? 'Critical demo update: browser-local synthetic fallback is active.'
    : fallbackExpired
      ? 'Critical demo update: the browser-local synthetic fallback has expired.'
      : recoveryStatus === RECOVERY_STATES.RECOVERED
        ? 'Demo update: the primary mock profile source has recovered.'
        : '';
  const announcementEventId =
    fallbackBanner?.eventId ??
    (fallbackExpired || recoveryStatus === RECOVERY_STATES.RECOVERED
      ? latestIncident?.eventId
      : undefined);
  const announcementPriority =
    fallbackBanner !== null || fallbackExpired
      ? 'assertive'
      : 'polite';

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Requests the fixed synthetic profile through the validated local
   * lifecycle boundary.
   *
   * @returns {Promise<void>}
   */
  async function handleRequestProfile() {
    if (requestPending) {
      return;
    }

    setProfileRequested(true);
    setRequestPending(true);
    setRequestError('');

    try {
      const result = await Promise.resolve(
        dispatch({
          type: LIFECYCLE_COMMAND_TYPES.REQUEST_PROFILE,
          profileId: ACTIVE_PROFILE_ID,
        }),
      );

      if (actionFailed(result) && mountedRef.current) {
        setRequestError(resolveActionError(result));
      }
    } catch {
      if (mountedRef.current) {
        setRequestError(DEMO_MESSAGES.actionFailed);
      }
    } finally {
      if (mountedRef.current) {
        setRequestPending(false);
      }
    }
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
            {CLINICAL_MESSAGES.dashboardTitle}
          </h1>
          <p className="mt-2 max-w-prose text-content-muted dark:text-slate-200">
            {CLINICAL_MESSAGES.dashboardDescription}
          </p>
        </div>

        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-care-700 bg-care-50 px-3 py-1.5 text-xs font-semibold text-care-900 dark:border-care-200 dark:bg-care-950 dark:text-care-100">
          <span aria-hidden="true">◇</span>
          Synthetic care view
        </span>
      </header>

      <LiveRegion
        eventId={announcementEventId}
        message={announcementMessage}
        priority={announcementPriority}
      />

      <section
        aria-labelledby="clinical-source-status-title"
        className="rounded-panel border border-slate-300 bg-surface p-4 shadow-panel dark:border-slate-700 dark:bg-surface-inverse sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              className="text-lg font-bold text-content dark:text-content-inverse"
              id="clinical-source-status-title"
            >
              Current mock profile source
            </h2>
            <p className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200">
              {clinicalModel.available
                ? 'A validated synthetic profile source is available in the browser-local scenario.'
                : 'No validated synthetic profile source is currently available.'}
            </p>
          </div>

          <ProfileSourceBadge source={clinicalModel.profileSource} />
        </div>

        <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-content-subtle dark:border-slate-700 dark:text-slate-300">
          {MOCK_BOUNDARY_MESSAGES.shortNotice}
        </p>
      </section>

      {fallbackBanner !== null ? (
        <FallbackStatusBanner
          active
          body={fallbackBanner.body}
          critical={fallbackBanner.critical}
          dismissible={fallbackBanner.dismissible}
          eventId={fallbackBanner.eventId}
          expiresAt={fallbackBanner.expiresAt}
          profileSource={fallbackBanner.profileSource}
          remainingMs={fallbackBanner.remainingMs}
          title={fallbackBanner.title}
        />
      ) : null}

      {fallbackExpired && latestIncident !== null ? (
        <FallbackStatusBanner
          active
          critical
          dismissible={false}
          eventId={latestIncident.eventId}
          expiresAt={latestIncident.occurredAt}
          profileSource={PROFILE_SOURCES.NONE}
          remainingMs={0}
          title="Browser-local fallback expired"
        />
      ) : null}

      {requestError.length > 0 ? (
        <div
          className="rounded-lg border border-status-critical-border bg-status-critical-surface p-4 text-status-critical"
          role="alert"
        >
          <p className="font-semibold">
            Synthetic profile request was not completed
          </p>
          <p className="mt-1 text-sm">{requestError}</p>
        </div>
      ) : null}

      <PatientProfileCard
        available={clinicalModel.available}
        contextEligibility={clinicalModel.contextEligibility}
        loading={requestPending}
        onRequestProfile={handleRequestProfile}
        profile={profile}
        profileSource={clinicalModel.profileSource}
        recoveryStatus={recoveryStatus}
        requestDisabled={requestPending}
        requested={effectiveRequested}
        unavailable={profileUnavailable}
      />
    </div>
  );
}

ClinicalDashboard.propTypes = {
  className: PropTypes.string,
};

export default ClinicalDashboard;