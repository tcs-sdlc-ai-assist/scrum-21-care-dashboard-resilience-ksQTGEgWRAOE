import {
  act,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { createResilienceLifecycleAdapter } from '../adapters/createResilienceLifecycleAdapter.js';
import FallbackStatusBanner from '../components/clinical/FallbackStatusBanner.jsx';
import {
  ACCESSIBILITY_MESSAGES,
  CLINICAL_MESSAGES,
} from '../constants/messages.js';
import { DashboardProvider } from '../context/DashboardContext.jsx';
import {
  CIRCUIT_FAILURE_THRESHOLD,
  DEPENDENCY_IDS,
  FALLBACK_TTL_MS,
  HEALTH_STATES,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import { createResilienceEngine } from '../engine/ResilienceEngine.js';
import { ACTIVE_PROFILE_ID } from '../fixtures/profiles.js';
import {
  FakeClock,
  REFERENCE_TIMESTAMP,
} from '../utils/clock.js';
import ClinicalDashboard from './ClinicalDashboard.jsx';

const activeEngines = new Set();

/**
 * @returns {{
 *   engine: ReturnType<typeof createResilienceEngine>,
 *   clock: FakeClock,
 *   view: ReturnType<typeof render>
 * }}
 */
function renderClinicalDashboard() {
  const clock = new FakeClock(REFERENCE_TIMESTAMP);
  const engine = createResilienceEngine({ clock });
  const lifecycle = createResilienceLifecycleAdapter(engine);

  activeEngines.add(engine);

  const view = render(
    <DashboardProvider lifecycle={lifecycle}>
      <ClinicalDashboard />
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
function activateFallback(engine) {
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

describe('ClinicalDashboard', () => {
  it('requests and renders the allowlisted synthetic profile from the primary source', async () => {
    const user = userEvent.setup();

    renderClinicalDashboard();

    expect(
      screen.getByRole('heading', {
        name: CLINICAL_MESSAGES.dashboardTitle,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: CLINICAL_MESSAGES.noProfileTitle,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: CLINICAL_MESSAGES.requestProfile,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(ACTIVE_PROFILE_ID)).toBeInTheDocument();
    });

    expect(screen.getByText('Synthetic Patient 0042')).toBeInTheDocument();
    expect(screen.getByText('****0042')).toBeInTheDocument();
    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Approved masked fields from a browser-local synthetic record.'),
    ).toBeInTheDocument();
  });

  it('updates the rendered profile source when the primary mock dependency becomes unavailable', async () => {
    const user = userEvent.setup();
    const { engine } = renderClinicalDashboard();

    await user.click(
      screen.getByRole('button', {
        name: CLINICAL_MESSAGES.requestProfile,
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
    });

    runEngineAction(() =>
      engine.simulateHealth({
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        status: HEALTH_STATES.FAILED,
      }));

    await waitFor(() => {
      expect(screen.getAllByText('Secondary').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(ACTIVE_PROFILE_ID)).toBeInTheDocument();
    expect(screen.getByText('Synthetic Patient 0042')).toBeInTheDocument();
  });

  it('announces an active critical fallback and does not offer dismissal', async () => {
    const { engine } = renderClinicalDashboard();

    const activation = activateFallback(engine);

    expect(activation.snapshot.profileSource).toBe(
      PROFILE_SOURCES.FALLBACK,
    );

    expect(
      await screen.findByRole('heading', {
        name: CLINICAL_MESSAGES.fallbackTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(CLINICAL_MESSAGES.fallbackBody),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /dismiss fallback status/i,
      }),
    ).not.toBeInTheDocument();

    const criticalRegion = screen.getByLabelText(
      ACCESSIBILITY_MESSAGES.criticalRegionLabel,
    );

    await waitFor(() => {
      expect(criticalRegion).toHaveTextContent(
        ACCESSIBILITY_MESSAGES.newFallbackAnnouncement,
      );
    });
  });

  it('renders the authoritative expired fallback state at the exact expiry boundary', async () => {
    const { clock, engine } = renderClinicalDashboard();

    activateFallback(engine);

    expect(
      screen.getByRole('heading', {
        name: CLINICAL_MESSAGES.fallbackTitle,
      }),
    ).toBeInTheDocument();

    act(() => {
      clock.advance(FALLBACK_TTL_MS);
    });

    expect(engine.getSnapshot().fallback).toBeNull();
    expect(engine.getSnapshot().profileSource).toBe(
      PROFILE_SOURCES.NONE,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Browser-local fallback expired',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(CLINICAL_MESSAGES.fallbackExpired),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: CLINICAL_MESSAGES.profileUnavailableTitle,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          ACCESSIBILITY_MESSAGES.criticalRegionLabel,
        ),
      ).toHaveTextContent(
        'Critical demo update: the browser-local synthetic fallback has expired.',
      );
    });
  });

  it('has no detectable accessibility violations after rendering a synthetic profile', async () => {
    const user = userEvent.setup();
    const { view } = renderClinicalDashboard();

    await user.click(
      screen.getByRole('button', {
        name: CLINICAL_MESSAGES.requestProfile,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(ACTIVE_PROFILE_ID)).toBeInTheDocument();
    });

    const results = await axe(view.container);

    expect(results).toHaveNoViolations();
  });
});

describe('FallbackStatusBanner dismissal policy', () => {
  it('dismisses a non-critical event and reappears when a new event identifier is rendered', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <FallbackStatusBanner
        body="A non-critical browser-local fallback event is available."
        critical={false}
        dismissible
        eventId="evt-fallback-1"
        onDismiss={onDismiss}
        profileSource={PROFILE_SOURCES.FALLBACK}
        remainingMs={60_000}
        title="Non-critical fallback update"
      />,
    );

    expect(
      screen.getByRole('status'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: /dismiss fallback status/i,
      }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('evt-fallback-1');
    expect(
      screen.queryByRole('heading', {
        name: 'Non-critical fallback update',
      }),
    ).not.toBeInTheDocument();

    rerender(
      <FallbackStatusBanner
        body="A new non-critical browser-local fallback event is available."
        critical={false}
        dismissible
        eventId="evt-fallback-2"
        onDismiss={onDismiss}
        profileSource={PROFILE_SOURCES.FALLBACK}
        remainingMs={60_000}
        title="New fallback update"
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'New fallback update',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /dismiss fallback status/i,
      }),
    ).toBeEnabled();
  });

  it('prevents dismissal when an event is critical even if dismissal is requested', () => {
    const onDismiss = vi.fn();

    render(
      <FallbackStatusBanner
        critical
        dismissible
        eventId="evt-critical-fallback"
        onDismiss={onDismiss}
        profileSource={PROFILE_SOURCES.FALLBACK}
        remainingMs={60_000}
        title="Critical fallback update"
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Critical fallback update',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /dismiss fallback status/i,
      }),
    ).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});