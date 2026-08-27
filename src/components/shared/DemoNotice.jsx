import PropTypes from 'prop-types';
import {
  INTEGRATION_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../../constants/messages.js';

/**
 * Displays the persistent browser-local demo boundary and clarifies that
 * external-looking integrations are pipeline-aligned mocks only.
 *
 * @param {{className?: string}} props
 * @returns {import('react').ReactElement}
 */
export function DemoNotice({ className = '' }) {
  return (
    <aside
      aria-labelledby="demo-notice-title"
      className={[
        'border-b border-care-300 bg-care-50 text-content',
        'dark:border-care-700 dark:bg-care-950 dark:text-content-inverse',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="note"
    >
      <div className="mx-auto flex max-w-dashboard gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-care-700 text-sm font-bold text-care-700 dark:border-care-200 dark:text-care-200"
        >
          i
        </span>

        <div className="min-w-0 space-y-2 text-sm leading-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="font-semibold text-care-900 dark:text-care-100"
              id="demo-notice-title"
            >
              {MOCK_BOUNDARY_MESSAGES.badge}
            </h2>
            <span className="rounded-full bg-care-700 px-2 py-0.5 text-xs font-semibold text-white dark:bg-care-200 dark:text-care-950">
              Mock data only
            </span>
          </div>

          <p className="max-w-prose">
            {MOCK_BOUNDARY_MESSAGES.fullNotice}
          </p>

          <ul className="grid max-w-dashboard list-disc gap-x-8 gap-y-1 pl-5 text-content-muted dark:text-care-100 sm:grid-cols-2">
            <li>{MOCK_BOUNDARY_MESSAGES.syntheticData}</li>
            <li>{MOCK_BOUNDARY_MESSAGES.noNetwork}</li>
            <li>{MOCK_BOUNDARY_MESSAGES.notSecurityBoundary}</li>
            <li>{MOCK_BOUNDARY_MESSAGES.notClinicalAdvice}</li>
          </ul>

          <div className="border-t border-care-200 pt-2 dark:border-care-800">
            <p className="font-semibold text-care-900 dark:text-care-100">
              [Pipeline-aligned mock] integration boundaries
            </p>
            <p className="text-content-muted dark:text-care-100">
              {INTEGRATION_MESSAGES.pagerDuty}:{' '}
              {INTEGRATION_MESSAGES.pagerDutyHint}{' '}
              {INTEGRATION_MESSAGES.slack}:{' '}
              {INTEGRATION_MESSAGES.slackHint}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

DemoNotice.propTypes = {
  className: PropTypes.string,
};

export default DemoNotice;