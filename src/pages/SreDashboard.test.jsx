import {
  act,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { createResilienceLifecycleAdapter } from '../adapters/createResilienceLifecycleAdapter.js';
import {
  DEMO_MESSAGES,
  INTEGRATION_MESSAGES,
  SRE_MESSAGES,
} from '../constants/messages.js';
import { DashboardProvider } from '../context/DashboardContext.jsx';
import {
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_STATES,
  DEPENDENCY_IDS,
  HEALTH_STATES,
  POLL_INTERVAL_MS,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import { ALERT_CHANNELS } from '../domain/model.js';
import { createResilienceEngine } from '../engine/ResilienceEngine.js';
import { ACTIVE_PROFILE_ID } from '../fixtures/profiles.js';
import { IncidentRepository } from '../repositories/IncidentRepository.js';
import {
  FakeClock,
  REFERENCE_TIMESTAMP,
} from '../utils/clock.js';
import SreDashboard from './SreDashboard.jsx';

const activeEngines = new Set();

class MixedChannelIncidentRepository extends IncidentRepository {
  /**
   * @param {unknown} input
   * @returns {ReturnType<IncidentRepository['recordFallbackActivation']>}
   */
  recordFallbackActivation(input) {
    return super.recordFallbackActivation({
      ...input,
      channel: ALERT_CHANNELS.MOCK_SLACK,
    });
  }
}

/**
 * @param {{
 *   incidentRepository?: IncidentRepository
 * }} [options]
 * @returns {{
 *   engine: ReturnType<typeof createResilienceEngine>,
 *   clock: FakeClock,
 *   view: ReturnType<typeof render>
 * }}
 */
function renderSreDashboard(options = {}) {
  const clock = new FakeClock(REFERENCE_TIMESTAMP);
  const engine = createResilienceEngine({
    clock,
    incidentRepository: options.incidentRepository,
  });
  const lifecycle = createResilienceLifecycleAdapter(engine);

  activeEngines.add(engine);

  const view = render(
    <DashboardProvider lifecycle={lifecycle}>
      <SreDashboard engine={engine} />
    </DashboardProvider>,
  );

  return {
    engine,
    clock,
    view,
  };
}

/**
 * @param {() => object} operation
 * @returns {object}
 */
function runEngineAction(operation) {
  let result;

  act(() => {
    result = operation();
  });

  expect(result).toMatchObject({
    ok: true,
  });

  return result;
}

/**
 * @param {ReturnType<typeof createResilienceEngine>} engine
 * @returns {object}
 */
function openPrimaryCircuit(engine) {
  let result;

  act(() => {
    for (
      let attempt = 0;
      attempt < CIRCUIT_FAILURE_THRESHOLD;
      attempt += 1
    ) {
      result = engine.simulateHealth({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.FAILED,
      });

      if (!result.ok) {
        throw new Error(
          `Expected primary failure simulation to succeed: ${result.error.code}`,
        );
      }
    }
  });

  return result;
}

/**
 * @param {ReturnType<typeof createResilienceEngine>} engine
 * @returns {object}
 */
function activateFallback(engine) {
  openPrimaryCircuit(engine);

  let result;

  act(() => {
    result = engine.simulateHealth({
      dependencyId: DEPENDENCY_IDS.PROFILE_SECONDARY,
      status: HEALTH_STATES.FAILED,
    });

    if (!result.ok) {
      throw new Error(
        `Expected secondary failure simulation to succeed: ${result.error.code}`,
      );
    }

    result = engine.requestProfile({
      profileId: ACTIVE_PROFILE_ID,
    });

    if (!result.ok) {
      throw new Error(
        `Expected fallback activation to succeed: ${result.error.code}`,
      );
    }
  });

  return result;
}

afterEach(() => {
  activeEngines.forEach((engine) => {
    engine.stop();
  });
  activeEngines.clear();
});

describe('SreDashboard', () => {
  it('renders exactly three fixed dependencies and every browser-local simulation control', async () => {
    const user = userEvent.setup();

    renderSreDashboard();

    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.dashboardTitle,
        level: 1,
      }),
    ).toBeInTheDocument();

    const dependencySection = screen
      .getByRole('heading', {
        name: SRE_MESSAGES.dependencyHealthTitle,
      })
      .closest('section');

    expect(dependencySection).not.toBeNull();

    const dependencyTable = within(dependencySection).getByRole(
      'table',
    );
    const tableRows = within(dependencyTable).getAllByRole('row');

    expect(tableRows).toHaveLength(4);
    expect(
      within(dependencyTable).getByText(
        DEPENDENCY_IDS.PROFILE_PRIMARY,
      ),
    ).toBeInTheDocument();
    expect(
      within(dependencyTable).getByText(
        DEPENDENCY_IDS.PROFILE_SECONDARY,
      ),
    ).toBeInTheDocument();
    expect(
      within(dependencyTable).getByText(
        DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(DEMO_MESSAGES.dependencyLabel),
    ).toBeEnabled();
    expect(
      screen.getByLabelText(DEMO_MESSAGES.responseConditionLabel),
    ).toBeEnabled();

    [
      DEMO_MESSAGES.normalCondition,
      DEMO_MESSAGES.degradedCondition,
      DEMO_MESSAGES.timeoutCondition,
      DEMO_MESSAGES.invalidPayloadCondition,
      DEMO_MESSAGES.failureCondition,
    ].forEach((optionName) => {
      expect(
        screen.getByRole('option', {
          name: optionName,
        }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.simulateHealth,
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.requestProfile,
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: SRE_MESSAGES.simulateRecovery,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Expire synthetic fallback',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Apply mock scenario',
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.reset,
      }),
    ).toBeEnabled();

    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.noTelemetryTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.noAlertsTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: SRE_MESSAGES.noIncidentsTitle,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.requestProfile,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('status', {
          name: '',
        }),
      ).toHaveTextContent(
        'The synthetic profile request completed locally.',
      );
    });
  });

  it('applies a selected degraded response and renders the resulting mock telemetry', async () => {
    const user = userEvent.setup();

    renderSreDashboard();

    await user.selectOptions(
      screen.getByLabelText(DEMO_MESSAGES.responseConditionLabel),
      'degraded',
    );
    await user.click(
      screen.getByRole('button', {
        name: DEMO_MESSAGES.simulateHealth,
      }),
    );

    const dependencySection = screen
      .getByRole('heading', {
        name: SRE_MESSAGES.dependencyHealthTitle,
      })
      .closest('section');

    expect(dependencySection).not.toBeNull();

    await waitFor(() => {
      const primaryRow = within(dependencySection)
        .getByText(DEPENDENCY_IDS.PROFILE_PRIMARY)
        .closest('tr');

      expect(primaryRow).not.toBeNull();
      expect(within(primaryRow).getByText('Degraded')).toBeInTheDocument();
      expect(within(primaryRow).getByText('800 ms')).toBeInTheDocument();
    });

    const telemetrySection = screen
      .getByRole('heading', {
        name: SRE_MESSAGES.telemetryTitle,
      })
      .closest('section');

    expect(telemetrySection).not.toBeNull();
    expect(
      within(telemetrySection).getByText('800 ms'),
    ).toBeInTheDocument();
    expect(
      within(telemetrySection).getByText(
        'Primary profile service',
      ),
    ).toBeInTheDocument();
    expect(
      within(telemetrySection).getByText('Degraded'),
    ).toBeInTheDocument();
    expect(
      within(telemetrySection).getByText('Recent mock response-time samples'),
    ).toBeInTheDocument();
  });

  it('applies the fallback preset and renders mock integration labels, alerts, and complete incident fields', async () => {
    const user = userEvent.setup();
    const incidentRepository =
      new MixedChannelIncidentRepository();

    renderSreDashboard({ incidentRepository });

    await user.selectOptions(
      screen.getByLabelText('Mock scenario preset'),
      'fallback-active',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Apply mock scenario',
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Expire synthetic fallback',
        }),
      ).toBeEnabled();
    });

    const alertsSection = screen
      .getByRole('heading', {
        name: SRE_MESSAGES.alertsTitle,
      })
      .closest('section');

    expect(alertsSection).not.toBeNull();
    expect(
      within(alertsSection).getByText(
        INTEGRATION_MESSAGES.pagerDuty,
      ),
    ).toBeInTheDocument();
    expect(
      within(alertsSection).getByText(
        INTEGRATION_MESSAGES.slack,
      ),
    ).toBeInTheDocument();
    expect(
      within(alertsSection).getByText(
        INTEGRATION_MESSAGES.pagerDutyHint,
      ),
    ).toBeInTheDocument();
    expect(
      within(alertsSection).getByText(
        INTEGRATION_MESSAGES.slackHint,
      ),
    ).toBeInTheDocument();
    expect(
      within(alertsSection).getByText(
        'Mock dependency failover',
        {
          selector: 'h3',
        },
      ),
    ).toBeInTheDocument();
    expect(
      within(alertsSection).getByText(
        'Mock synthetic fallback activated',
        {
          selector: 'h3',
        },
      ),
    ).toBeInTheDocument();

    const incidentSection = screen
      .getByRole('heading', {
        name: SRE_MESSAGES.incidentsTitle,
      })
      .closest('section');

    expect(incidentSection).not.toBeNull();
    expect(
      within(incidentSection).getByRole('heading', {
        name: 'Failover',
      }),
    ).toBeInTheDocument();
    expect(
      within(incidentSection).getByRole('heading', {
        name: 'Fallback activated',
      }),
    ).toBeInTheDocument();

    [
      'Mock event identifier',
      'Event type',
      'Mock dependency',
      'Severity',
      'Trigger',
      'Circuit state',
      'Data source',
      'Recovery status',
      'Event time',
      'Sanitized diagnostic summary',
    ].forEach((fieldName) => {
      expect(
        within(incidentSection).getAllByText(fieldName).length,
      ).toBeGreaterThan(0);
    });

    expect(
      within(incidentSection).getAllByText(
        `mock-record-${ACTIVE_PROFILE_ID}`,
      ),
    ).toHaveLength(2);
    expect(
      within(incidentSection).getAllByText('Fallback').length,
    ).toBeGreaterThan(0);
    expect(
      within(incidentSection).getAllByText('Open').length,
    ).toBeGreaterThan(0);
  });

  it('records and announces the ordered half-open to closed recovery timeline', async () => {
    const user = userEvent.setup();
    const { engine } = renderSreDashboard();

    const activation = activateFallback(engine);

    expect(activation.snapshot.profileSource).toBe(
      PROFILE_SOURCES.FALLBACK,
    );

    const recoveryButton = screen.getByRole('button', {
      name: SRE_MESSAGES.simulateRecovery,
    });

    expect(recoveryButton).toBeEnabled();

    await user.click(recoveryButton);

    const incidentSection = screen
      .getByRole('heading', {
        name: SRE_MESSAGES.incidentsTitle,
      })
      .closest('section');

    expect(incidentSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(incidentSection).getAllByRole('heading', {
          name: 'Recovery',
        }),
      ).toHaveLength(2);
    });

    expect(
      within(incidentSection).getAllByText('Half-open').length,
    ).toBeGreaterThan(0);
    expect(
      within(incidentSection).getAllByText('Closed').length,
    ).toBeGreaterThan(0);
    expect(
      within(incidentSection).getByText(
        'Mock recovery probe succeeded',
      ),
    ).toBeInTheDocument();
    expect(
      within(incidentSection).getByText(
        'Mock dependency recovery completed',
      ),
    ).toBeInTheDocument();
    expect(
      within(incidentSection).getAllByText('Recovered').length,
    ).toBeGreaterThan(0);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Demo status updates'),
      ).toHaveTextContent(
        'Demo update: the mock dependency has recovered.',
      );
    });

    expect(engine.getSnapshot().dependencies[0]).toMatchObject({
      circuit: CIRCUIT_STATES.CLOSED,
      status: HEALTH_STATES.HEALTHY,
    });
    expect(engine.getSnapshot().profileSource).toBe(
      PROFILE_SOURCES.PRIMARY,
    );
    expect(
      screen.getByRole('button', {
        name: SRE_MESSAGES.simulateRecovery,
      }),
    ).toBeDisabled();
  });

  it('acknowledges the active mock alert and removes it from the active alert list', async () => {
    const user = userEvent.setup();
    const { engine } = renderSreDashboard();

    openPrimaryCircuit(engine);

    expect(
      await screen.findByRole('heading', {
        name: 'Mock dependency failover',
      }),
    ).toBeInTheDocument();

    const acknowledgeButton = screen.getByRole('button', {
      name: SRE_MESSAGES.acknowledgeAlert,
    });

    await user.click(acknowledgeButton);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: SRE_MESSAGES.noAlertsTitle,
        }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', {
        name: SRE_MESSAGES.acknowledgeAlert,
      }),
    ).not.toBeInTheDocument();
    expect(engine.getSnapshot().alerts).toHaveLength(1);
    expect(engine.getSnapshot().alerts[0].acknowledged).toBe(true);
  });

  it('starts mock polling only while the document is visible and pauses it when hidden', async () => {
    let visibilityState = 'hidden';

    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibilityState,
    );

    const { clock, engine } = renderSreDashboard();

    expect(clock.pendingTimerCount()).toBe(0);
    expect(
      screen.getAllByText('Mock polling paused').length,
    ).toBeGreaterThan(0);

    visibilityState = 'visible';

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(
        screen.getAllByText('Mock polling active').length,
      ).toBeGreaterThan(0);
    });

    expect(clock.pendingTimerCount()).toBe(1);

    act(() => {
      clock.advance(POLL_INTERVAL_MS);
    });

    expect(engine.getSnapshot().telemetry).toHaveLength(3);
    expect(
      screen.queryByRole('heading', {
        name: SRE_MESSAGES.noTelemetryTitle,
      }),
    ).not.toBeInTheDocument();

    visibilityState = 'hidden';

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(
        screen.getAllByText('Mock polling paused').length,
      ).toBeGreaterThan(0);
    });

    expect(clock.pendingTimerCount()).toBe(0);

    act(() => {
      clock.advance(POLL_INTERVAL_MS);
    });

    expect(engine.getSnapshot().telemetry).toHaveLength(3);
  });

  it('has no detectable accessibility violations with fallback alerts and incidents displayed', async () => {
    const incidentRepository =
      new MixedChannelIncidentRepository();
    const { engine, view } = renderSreDashboard({
      incidentRepository,
    });

    runEngineAction(() =>
      engine.simulateHealth({
        dependencyId: DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
        status: HEALTH_STATES.DEGRADED,
      }));

    activateFallback(engine);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Fallback activated',
        }),
      ).toBeInTheDocument();
    });

    const results = await axe(view.container);

    expect(results).toHaveNoViolations();
  });
});