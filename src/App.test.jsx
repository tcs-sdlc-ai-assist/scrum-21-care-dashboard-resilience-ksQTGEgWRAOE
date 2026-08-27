import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { createResilienceLifecycleAdapter } from './adapters/createResilienceLifecycleAdapter.js';
import ErrorBoundary from './components/shared/ErrorBoundary.jsx';
import {
  AUTH_MESSAGES,
  CLINICAL_MESSAGES,
  DEMO_MESSAGES,
  SRE_MESSAGES,
} from './constants/messages.js';
import { DashboardProvider } from './context/DashboardContext.jsx';
import { SessionProvider } from './context/SessionContext.jsx';
import {
  DEPENDENCY_IDS,
} from './domain/constants.js';
import { createResilienceEngine } from './engine/ResilienceEngine.js';
import ClinicalDashboard from './pages/ClinicalDashboard.jsx';
import SreDashboard from './pages/SreDashboard.jsx';
import { AppRoutes } from './routing/router.jsx';

const activeEngines = new Set();

/**
 * Renders the application route composition with a fresh browser-local
 * resilience engine and memory-backed router.
 *
 * @param {string} [initialPath]
 * @returns {{
 *   engine: ReturnType<typeof createResilienceEngine>,
 *   view: ReturnType<typeof render>
 * }}
 */
function renderApplication(initialPath = '/') {
  const engine = createResilienceEngine();
  const lifecycle = createResilienceLifecycleAdapter(engine);

  activeEngines.add(engine);

  const view = render(
    <ErrorBoundary onReset={lifecycle.resetScenario}>
      <SessionProvider engine={engine}>
        <DashboardProvider lifecycle={lifecycle}>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppRoutes engine={engine} />
          </MemoryRouter>
        </DashboardProvider>
      </SessionProvider>
    </ErrorBoundary>,
  );

  return {
    engine,
    view,
  };
}

/**
 * Renders an SRE dashboard that can be replaced by the clinical dashboard
 * while retaining the same provider and lifecycle instance.
 *
 * @returns {{
 *   engine: ReturnType<typeof createResilienceEngine>,
 *   lifecycle: ReturnType<typeof createResilienceLifecycleAdapter>,
 *   view: ReturnType<typeof render>
 * }}
 */
function renderSharedDashboardState() {
  const engine = createResilienceEngine();
  const lifecycle = createResilienceLifecycleAdapter(engine);

  activeEngines.add(engine);

  const view = render(
    <DashboardProvider lifecycle={lifecycle}>
      <SreDashboard engine={engine} />
    </DashboardProvider>,
  );

  return {
    engine,
    lifecycle,
    view,
  };
}

/**
 * Returns the rendered dependency-health row for one fixed dependency.
 *
 * @param {string} dependencyId
 * @returns {HTMLTableRowElement}
 */
function getDependencyRow(dependencyId) {
  const dependencySection = screen
    .getByRole('heading', {
      name: SRE_MESSAGES.dependencyHealthTitle,
    })
    .closest('section');

  if (dependencySection === null) {
    throw new Error('Expected the mock dependency health section');
  }

  const dependencyLabel = within(dependencySection).getByText(
    dependencyId,
  );
  const row = dependencyLabel.closest('tr');

  if (row === null) {
    throw new Error(`Expected a dependency row for ${dependencyId}`);
  }

  return row;
}

/**
 * Component used to verify application-level render error containment.
 *
 * @returns {never}
 */
function ThrowingApplicationView() {
  throw new Error('Unsafe internal exception detail');
}

afterEach(() => {
  activeEngines.forEach((engine) => {
    engine.stop();
  });
  activeEngines.clear();
  globalThis.history.replaceState({}, '', '/');
});

describe('App', () => {
  it('redirects a guarded clinical deep link to the browser-local demo entry when no session exists', () => {
    globalThis.history.replaceState({}, '', '/clinical');

    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: AUTH_MESSAGES.title,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.loginAction,
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('heading', {
        name: CLINICAL_MESSAGES.dashboardTitle,
      }),
    ).not.toBeInTheDocument();
  });

  it('composes the signup deep link without nesting routers or creating a session', () => {
    renderApplication('/signup');

    expect(
      screen.getByRole('tab', {
        name: AUTH_MESSAGES.signupTab,
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByLabelText(AUTH_MESSAGES.passwordLabel),
    ).toHaveAttribute('autocomplete', 'new-password');
    expect(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.signupAction,
      }),
    ).toBeEnabled();
  });

  it('retains shared resilience state when switching from the SRE view to the clinical view', async () => {
    const user = userEvent.setup();
    const {
      engine,
      lifecycle,
      view,
    } = renderSharedDashboardState();

    await user.selectOptions(
      screen.getByLabelText(DEMO_MESSAGES.responseConditionLabel),
      'degraded',
    );
    await user.click(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.simulateHealth,
      }),
    );

    await waitFor(() => {
      expect(
        within(
          getDependencyRow(DEPENDENCY_IDS.PROFILE_PRIMARY),
        ).getByText('Degraded'),
      ).toBeInTheDocument();
    });

    view.rerender(
      <DashboardProvider lifecycle={lifecycle}>
        <ClinicalDashboard />
      </DashboardProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: CLINICAL_MESSAGES.dashboardTitle,
        level: 1,
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getAllByText('Secondary').length,
      ).toBeGreaterThan(0);
    });

    expect(
      screen.queryByRole('heading', {
        name: SRE_MESSAGES.dashboardTitle,
      }),
    ).not.toBeInTheDocument();

    engine.stop();
  });

  it('resets the resilience scenario while preserving the active SRE session', async () => {
    const user = userEvent.setup();

    renderApplication();

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.useSreAccount,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: SRE_MESSAGES.dashboardTitle,
        level: 1,
      }),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(DEMO_MESSAGES.responseConditionLabel),
      'degraded',
    );
    await user.click(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.simulateHealth,
      }),
    );

    await waitFor(() => {
      expect(
        within(
          getDependencyRow(DEPENDENCY_IDS.PROFILE_PRIMARY),
        ).getByText('Degraded'),
      ).toBeInTheDocument();
    });

    const resetTriggers = screen.getAllByRole('button', {
      name: DEMO_MESSAGES.reset,
    });

    await user.click(resetTriggers[0]);

    const confirmation = screen.getByRole('alertdialog');

    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Reset demo',
      }),
    );

    await waitFor(() => {
      expect(
        within(
          getDependencyRow(DEPENDENCY_IDS.PROFILE_PRIMARY),
        ).getByText('Healthy'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.dashboardTitle,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.noTelemetryTitle,
      }),
    ).toBeInTheDocument();
  });

  it('clears resilience activity on logout and restores a clean state on the next demo session', async () => {
    const user = userEvent.setup();
    const { engine } = renderApplication();

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.useSreAccount,
      }),
    );

    await screen.findByRole('heading', {
      name: SRE_MESSAGES.dashboardTitle,
      level: 1,
    });

    await user.selectOptions(
      screen.getByLabelText(DEMO_MESSAGES.responseConditionLabel),
      'degraded',
    );
    await user.click(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.simulateHealth,
      }),
    );

    await waitFor(() => {
      expect(engine.getSnapshot().telemetry.length).toBeGreaterThan(0);
    });

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.logoutAction,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: AUTH_MESSAGES.title,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(engine.getSnapshot().telemetry).toEqual([]);
    expect(engine.getSnapshot().incidents).toEqual([]);
    expect(engine.getSnapshot().alerts).toEqual([]);

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.useSreAccount,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: SRE_MESSAGES.dashboardTitle,
        level: 1,
      }),
    ).toBeInTheDocument();

    expect(
      within(
        getDependencyRow(DEPENDENCY_IDS.PROFILE_PRIMARY),
      ).getByText('Healthy'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.noTelemetryTitle,
      }),
    ).toBeInTheDocument();
  });

  it('contains unexpected rendering failures without displaying raw exception details', () => {
    vi.spyOn(globalThis.console, 'error').mockImplementation(
      () => undefined,
    );

    render(
      <ErrorBoundary>
        <ThrowingApplicationView />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'The demo could not be displayed',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Reload demo',
      }),
    ).toBeEnabled();
    expect(
      screen.queryByText('Unsafe internal exception detail'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'No exception details, profiles, or credentials are displayed.',
      ),
    ).toBeInTheDocument();
  });

  it('runs fallback, reset, and logout flows without unexpected network calls', async () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn(function MockXMLHttpRequest() {});
    const webSocketSpy = vi.fn(function MockWebSocket() {});
    const user = userEvent.setup();

    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);

    renderApplication();

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.useSreAccount,
      }),
    );

    await screen.findByRole('heading', {
      name: SRE_MESSAGES.dashboardTitle,
      level: 1,
    });

    await user.selectOptions(
      screen.getByLabelText('Mock scenario preset'),
      'fallback-active',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Apply mock scenario',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Fallback activated',
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.logoutAction,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: AUTH_MESSAGES.title,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
  });
});