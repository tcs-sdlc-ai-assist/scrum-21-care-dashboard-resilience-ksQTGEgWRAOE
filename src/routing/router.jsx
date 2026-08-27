import PropTypes from 'prop-types';
import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import AuthView from '../pages/AuthView.jsx';
import ClinicalDashboard from '../pages/ClinicalDashboard.jsx';
import NotFound from '../pages/NotFound.jsx';
import SreDashboard from '../pages/SreDashboard.jsx';
import RouteGuard from './RouteGuard.jsx';

/**
 * Defines the application route tree independently from the browser router so
 * it can be composed in router-aware tests without creating a nested router.
 *
 * @param {{
 *   engine: {
 *     start: Function,
 *     stop: Function,
 *     expireFallback?: Function
 *   }
 * }} props
 * @returns {import('react').ReactElement}
 */
export function AppRoutes({ engine }) {
  return (
    <Routes>
      <Route element={<AuthView />} path="/" />
      <Route element={<AuthView initialMode="login" />} path="/login" />
      <Route element={<AuthView initialMode="signup" />} path="/signup" />

      <Route element={<RouteGuard requiredRole="clinical" />}>
        <Route element={<AppShell role="clinical" />}>
          <Route
            element={<ClinicalDashboard />}
            path="/clinical"
          />
        </Route>
      </Route>

      <Route element={<RouteGuard requiredRole="sre" />}>
        <Route element={<AppShell role="sre" />}>
          <Route
            element={<SreDashboard engine={engine} />}
            path="/sre"
          />
        </Route>
      </Route>

      <Route element={<NotFound />} path="*" />
    </Routes>
  );
}

AppRoutes.propTypes = {
  engine: PropTypes.shape({
    start: PropTypes.func.isRequired,
    stop: PropTypes.func.isRequired,
    expireFallback: PropTypes.func,
  }).isRequired,
};

/**
 * Owns the single browser-history router for the static SPA.
 *
 * @param {{
 *   engine: {
 *     start: Function,
 *     stop: Function,
 *     expireFallback?: Function
 *   }
 * }} props
 * @returns {import('react').ReactElement}
 */
export function AppRouter({ engine }) {
  return (
    <BrowserRouter>
      <AppRoutes engine={engine} />
    </BrowserRouter>
  );
}

AppRouter.propTypes = {
  engine: PropTypes.shape({
    start: PropTypes.func.isRequired,
    stop: PropTypes.func.isRequired,
    expireFallback: PropTypes.func,
  }).isRequired,
};

export default AppRouter;