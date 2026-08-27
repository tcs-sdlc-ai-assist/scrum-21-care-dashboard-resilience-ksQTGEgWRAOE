import { useContext, useId } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  APP_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../constants/messages.js';
import { SessionContext } from '../context/SessionContext.jsx';

const ROUTE_PRESENTATION = Object.freeze({
  clinical: Object.freeze({
    path: '/clinical',
    action: 'Return to care team dashboard',
  }),
  sre: Object.freeze({
    path: '/sre',
    action: 'Return to SRE dashboard',
  }),
  entry: Object.freeze({
    path: '/',
    action: 'Return to demo entry',
  }),
});

/**
 * @param {unknown} role
 * @returns {'clinical'|'sre'|null}
 */
function normalizeRole(role) {
  if (role === 'clinical' || role === 'CARE_TEAM') {
    return 'clinical';
  }

  if (role === 'sre' || role === 'SRE') {
    return 'sre';
  }

  return null;
}

/**
 * Accessible static fallback for unknown client-side routes. Navigation uses
 * only fixed internal routes and never relies on browser history, referrer
 * data, or user-provided URL values.
 *
 * @param {{
 *   role?: 'clinical'|'sre'|'CARE_TEAM'|'SRE',
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function NotFound({
  role = undefined,
  className = '',
}) {
  const generatedId = useId();
  const sessionContext = useContext(SessionContext);
  const activeRole = normalizeRole(
    role ??
      sessionContext?.role ??
      sessionContext?.session?.role,
  );
  const destination =
    activeRole === null
      ? ROUTE_PRESENTATION.entry
      : ROUTE_PRESENTATION[activeRole];

  return (
    <main
      className={[
        'flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-content',
        'dark:bg-canvas-inverse dark:text-content-inverse sm:px-6 lg:px-8',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      id="main-content"
      tabIndex="-1"
    >
      <section
        aria-labelledby={`${generatedId}-title`}
        className="w-full max-w-2xl rounded-panel border border-slate-300 bg-surface p-6 text-center shadow-elevated dark:border-slate-700 dark:bg-surface-inverse sm:p-8"
      >
        <span
          aria-hidden="true"
          className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-care-700 bg-care-50 text-xl font-bold text-care-800 dark:border-care-200 dark:bg-care-950 dark:text-care-100"
        >
          404
        </span>

        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-care-700 dark:text-care-200">
          Unknown demo route
        </p>

        <h1
          className="mt-2 text-2xl font-bold text-content dark:text-content-inverse sm:text-3xl"
          id={`${generatedId}-title`}
        >
          Page not found
        </h1>

        <p className="mx-auto mt-3 max-w-prose text-content-muted dark:text-slate-200">
          The requested page is not available in the {APP_MESSAGES.name}{' '}
          resilience demonstration. Use the safe internal link below to
          continue.
        </p>

        <div
          className="mt-6 rounded-lg border border-care-300 bg-care-50 p-4 text-left text-sm text-content dark:border-care-700 dark:bg-care-950 dark:text-care-100"
          role="note"
        >
          <p className="font-semibold">
            {MOCK_BOUNDARY_MESSAGES.badge}
          </p>
          <p className="mt-1">
            {MOCK_BOUNDARY_MESSAGES.shortNotice}
          </p>
        </div>

        <Link
          className="mt-6 inline-flex min-h-touch items-center justify-center rounded-lg bg-care-700 px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-care-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 dark:bg-care-200 dark:text-care-950 dark:hover:bg-care-100"
          to={destination.path}
        >
          {destination.action}
        </Link>
      </section>
    </main>
  );
}

NotFound.propTypes = {
  role: PropTypes.oneOf([
    'clinical',
    'sre',
    'CARE_TEAM',
    'SRE',
  ]),
  className: PropTypes.string,
};

export default NotFound;