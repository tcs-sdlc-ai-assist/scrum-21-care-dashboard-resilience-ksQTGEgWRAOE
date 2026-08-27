import PropTypes from 'prop-types';
import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';

const ROLE_DESTINATIONS = Object.freeze({
  clinical: '/clinical',
  sre: '/sre',
});

/**
 * Normalizes supported mock session role values. Roles select presentation
 * only and do not represent authorization.
 *
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
 * Infers a role only from the fixed top-level dashboard route.
 *
 * @param {unknown} pathname
 * @returns {'clinical'|'sre'|null}
 */
function getRouteRole(pathname) {
  if (typeof pathname !== 'string') {
    return null;
  }

  const routeSegment = pathname.split('/').filter(Boolean)[0];
  return normalizeRole(routeSegment);
}

/**
 * Navigation-only guard for browser-local mock sessions and role views.
 *
 * This component is not an authentication, authorization, or security
 * boundary. It only keeps direct client-side visits aligned with the current
 * in-memory demo session. Redirects use fixed internal paths and do not copy
 * the attempted URL into navigation state or query parameters.
 *
 * `requiredRole` is the preferred role prop. `allowedRole` and `role` are
 * accepted for route composition compatibility. When no role prop is
 * supplied, the fixed `/clinical` or `/sre` path determines the requested
 * role.
 *
 * @param {{
 *   children?: import('react').ReactNode,
 *   requiredRole?: 'clinical'|'sre'|'CARE_TEAM'|'SRE',
 *   allowedRole?: 'clinical'|'sre'|'CARE_TEAM'|'SRE',
 *   role?: 'clinical'|'sre'|'CARE_TEAM'|'SRE'
 * }} props
 * @returns {import('react').ReactNode}
 */
export function RouteGuard({
  children = undefined,
  requiredRole = undefined,
  allowedRole = undefined,
  role = undefined,
}) {
  const location = useLocation();
  const { session } = useSession();
  const sessionRole = normalizeRole(session?.role);
  const requestedRole =
    normalizeRole(requiredRole ?? allowedRole ?? role) ??
    getRouteRole(location.pathname);

  if (session === null || sessionRole === null) {
    return <Navigate replace to="/" />;
  }

  if (
    requestedRole !== null &&
    requestedRole !== sessionRole
  ) {
    return (
      <Navigate
        replace
        to={ROLE_DESTINATIONS[sessionRole]}
      />
    );
  }

  return children === undefined ? <Outlet /> : children;
}

RouteGuard.propTypes = {
  children: PropTypes.node,
  requiredRole: PropTypes.oneOf([
    'clinical',
    'sre',
    'CARE_TEAM',
    'SRE',
  ]),
  allowedRole: PropTypes.oneOf([
    'clinical',
    'sre',
    'CARE_TEAM',
    'SRE',
  ]),
  role: PropTypes.oneOf([
    'clinical',
    'sre',
    'CARE_TEAM',
    'SRE',
  ]),
};

export default RouteGuard;