import { createResilienceLifecycleAdapter } from './adapters/createResilienceLifecycleAdapter.js';
import ErrorBoundary from './components/shared/ErrorBoundary.jsx';
import { DashboardProvider } from './context/DashboardContext.jsx';
import { SessionProvider } from './context/SessionContext.jsx';
import { createResilienceEngine } from './engine/ResilienceEngine.js';
import AppRouter from './routing/router.jsx';

const resilienceEngine = createResilienceEngine();
const resilienceLifecycle = createResilienceLifecycleAdapter(
  resilienceEngine,
);

/**
 * Composes the browser-local resilience engine, shared providers, error
 * boundary, and the single application router.
 *
 * @returns {import('react').ReactElement}
 */
export function App() {
  return (
    <ErrorBoundary onReset={resilienceLifecycle.resetScenario}>
      <SessionProvider engine={resilienceEngine}>
        <DashboardProvider lifecycle={resilienceLifecycle}>
          <AppRouter engine={resilienceEngine} />
        </DashboardProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}

export default App;