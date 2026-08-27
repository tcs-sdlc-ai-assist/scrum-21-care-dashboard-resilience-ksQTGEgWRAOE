import { expect, test } from '@playwright/test';

const STATIC_RESOURCE_TYPES = new Set([
  'document',
  'font',
  'image',
  'script',
  'stylesheet',
]);

/**
 * Tracks requests that do not match the static, same-origin application
 * boundary.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {{
 *   nonStaticRequests: Array<{method: string, resourceType: string, url: string}>,
 *   webSockets: string[]
 * }}
 */
function monitorNetworkBoundary(page) {
  const nonStaticRequests = [];
  const webSockets = [];

  page.on('request', (request) => {
    const method = request.method();
    const resourceType = request.resourceType();

    if (
      method !== 'GET' ||
      !STATIC_RESOURCE_TYPES.has(resourceType)
    ) {
      nonStaticRequests.push({
        method,
        resourceType,
        url: request.url(),
      });
    }
  });

  page.on('websocket', (socket) => {
    webSockets.push(socket.url());
  });

  return {
    nonStaticRequests,
    webSockets,
  };
}

/**
 * Verifies that every observed request remained a same-origin static asset
 * request.
 *
 * @param {import('@playwright/test').Page} page
 * @param {ReturnType<typeof monitorNetworkBoundary>} monitor
 * @returns {void}
 */
function expectStaticNetworkOnly(page, monitor) {
  const applicationOrigin = new URL(page.url()).origin;

  expect(
    monitor.nonStaticRequests,
    'The browser-local demo must not issue fetch, XHR, event-stream, mutation, or other non-static requests.',
  ).toEqual([]);
  expect(
    monitor.webSockets,
    'The browser-local demo must not open WebSocket connections.',
  ).toEqual([]);

  for (const request of page.context().pages()) {
    expect(new URL(request.url()).origin).toBe(applicationOrigin);
  }
}

/**
 * Creates a fixed browser-local demo session through the visible account
 * shortcut.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'clinical'|'sre'} role
 * @returns {Promise<void>}
 */
async function useDemoAccount(page, role) {
  const actionName =
    role === 'clinical'
      ? 'Use care team demo account'
      : 'Use SRE demo account';
  const destinationHeading =
    role === 'clinical'
      ? 'Care team dashboard'
      : 'SRE dashboard';

  await page.getByRole('button', { name: actionName }).click();
  await expect(
    page.getByRole('heading', {
      name: destinationHeading,
      level: 1,
    }),
  ).toBeVisible();
}

/**
 * Returns the dependency table row containing a fixed mock dependency.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} dependencyId
 * @returns {import('@playwright/test').Locator}
 */
function getDependencyRow(page, dependencyId) {
  return page
    .getByRole('heading', { name: 'Mock dependency health' })
    .locator('..')
    .locator('..')
    .getByRole('row')
    .filter({ hasText: dependencyId });
}

test.describe('Care Dashboard browser acceptance', () => {
  test('completes the clinical account journey using only synthetic browser-local data', async ({
    page,
  }) => {
    const monitor = monitorNetworkBoundary(page);

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Enter the resilience demo',
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Browser-local demo').first(),
    ).toBeVisible();

    await useDemoAccount(page, 'clinical');

    await expect(page).toHaveURL(/\/clinical$/);
    await expect(
      page.getByRole('heading', {
        name: 'No synthetic profile requested',
      }),
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Request synthetic profile',
      })
      .click();

    await expect(page.getByText('Synthetic Patient 0042')).toBeVisible();
    await expect(page.getByText('MOCK-0042')).toBeVisible();
    await expect(page.getByText('****0042')).toBeVisible();
    await expect(page.getByText('Primary').first()).toBeVisible();
    await expect(
      page.getByText(
        'Approved masked fields from a browser-local synthetic record.',
      ),
    ).toBeVisible();

    expectStaticNetworkOnly(page, monitor);
  });

  test('completes primary failover, fallback activation, alert acknowledgement, and recovery', async ({
    page,
  }) => {
    const monitor = monitorNetworkBoundary(page);

    await page.goto('/');
    await useDemoAccount(page, 'sre');

    await expect(page).toHaveURL(/\/sre$/);
    await expect(
      page.getByRole('heading', { name: 'No mock telemetry' }),
    ).toBeVisible();

    const preset = page.getByLabel('Mock scenario preset');
    await preset.selectOption('fallback-active');

    const fallbackStartedAt = Date.now();

    await page
      .getByRole('button', { name: 'Apply mock scenario' })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Fallback activated' }),
    ).toBeVisible();

    const fallbackPresentationMs = Date.now() - fallbackStartedAt;
    expect(fallbackPresentationMs).toBeLessThan(3_000);

    const primaryRow = getDependencyRow(page, 'profile-primary');
    const secondaryRow = getDependencyRow(page, 'profile-secondary');

    await expect(primaryRow.getByText('Open')).toBeVisible();
    await expect(primaryRow.getByText('Failed')).toBeVisible();
    await expect(secondaryRow.getByText('Failed')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Mock synthetic fallback activated',
      }),
    ).toBeVisible();
    await expect(page.getByText('Mock PagerDuty').first()).toBeVisible();
    await expect(
      page.getByText(
        'Pipeline-aligned mock only. No PagerDuty event is transmitted.',
      ).first(),
    ).toBeVisible();

    const acknowledgeButtons = page.getByRole('button', {
      name: 'Acknowledge mock alert',
    });
    const alertCountBeforeAcknowledgement =
      await acknowledgeButtons.count();

    expect(alertCountBeforeAcknowledgement).toBeGreaterThan(0);
    await acknowledgeButtons.first().click();

    await expect(
      page.getByRole('button', {
        name: 'Acknowledge mock alert',
      }),
    ).toHaveCount(alertCountBeforeAcknowledgement - 1);

    const recoveryStartedAt = Date.now();
    const recoveryButton = page.getByRole('button', {
      name: 'Simulate local recovery',
    });

    await expect(recoveryButton).toBeEnabled();
    await recoveryButton.click();

    await expect(
      page.getByText('Mock dependency recovery completed'),
    ).toBeVisible();
    await expect(primaryRow.getByText('Closed')).toBeVisible();
    await expect(primaryRow.getByText('Healthy')).toBeVisible();
    await expect(recoveryButton).toBeDisabled();

    const recoveryPresentationMs = Date.now() - recoveryStartedAt;
    expect(recoveryPresentationMs).toBeLessThan(3_000);

    expectStaticNetworkOnly(page, monitor);
  });

  test('supports guarded deep links and refreshes safely on a static host', async ({
    page,
  }) => {
    const monitor = monitorNetworkBoundary(page);

    const directResponse = await page.goto('/clinical');

    expect(directResponse).not.toBeNull();
    expect(directResponse.status()).toBeLessThan(400);
    await expect(
      page.getByRole('heading', {
        name: 'Enter the resilience demo',
        level: 1,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await useDemoAccount(page, 'clinical');
    await expect(page).toHaveURL(/\/clinical$/);

    const refreshResponse = await page.reload();

    expect(refreshResponse).not.toBeNull();
    expect(refreshResponse.status()).toBeLessThan(400);
    await expect(
      page.getByRole('heading', {
        name: 'Enter the resilience demo',
        level: 1,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    expectStaticNetworkOnly(page, monitor);
  });

  test('supports keyboard-only auth mode selection and demo account entry', async ({
    page,
  }) => {
    const monitor = monitorNetworkBoundary(page);

    await page.goto('/');

    const loginTab = page.getByRole('tab', { name: 'Demo login' });
    const signupTab = page.getByRole('tab', { name: 'Demo signup' });

    await loginTab.focus();
    await expect(loginTab).toBeFocused();

    await page.keyboard.press('ArrowRight');

    await expect(signupTab).toBeFocused();
    await expect(signupTab).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByLabel('Password'),
    ).toHaveAttribute('autocomplete', 'new-password');

    await page.keyboard.press('Home');

    await expect(loginTab).toBeFocused();
    await expect(loginTab).toHaveAttribute('aria-selected', 'true');

    const sreAccountButton = page.getByRole('button', {
      name: 'Use SRE demo account',
    });

    await sreAccountButton.focus();
    await expect(sreAccountButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', {
        name: 'SRE dashboard',
        level: 1,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sre$/);

    const responseCondition = page.getByLabel(
      'Mock response condition',
    );
    await responseCondition.focus();
    await page.keyboard.selectOption
      ? responseCondition.selectOption('degraded')
      : page.keyboard.press('ArrowDown');

    if (
      (await responseCondition.inputValue()) !== 'degraded'
    ) {
      await responseCondition.selectOption('degraded');
    }

    const applyHealthButton = page.getByRole('button', {
      name: 'Apply mock health response',
    });

    await applyHealthButton.focus();
    await page.keyboard.press('Enter');

    await expect(
      getDependencyRow(page, 'profile-primary').getByText('Degraded'),
    ).toBeVisible();

    expectStaticNetworkOnly(page, monitor);
  });

  test('renders without horizontal overflow across configured desktop, tablet, and mobile projects', async ({
    page,
  }, testInfo) => {
    const monitor = monitorNetworkBoundary(page);

    await page.goto('/');
    await useDemoAccount(page, 'sre');

    const viewport = page.viewportSize();

    expect(viewport).not.toBeNull();
    expect(viewport.width).toBeGreaterThanOrEqual(320);

    const layout = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));

    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(
      layout.viewportWidth + 1,
    );
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(
      layout.viewportWidth + 1,
    );

    await expect(
      page.getByRole('heading', {
        name: 'SRE dashboard',
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', {
        name: 'Primary navigation',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('table', {
        name: 'Current health of the three fixed mock dependencies',
      }),
    ).toBeVisible();

    const firstDependencyRow = getDependencyRow(
      page,
      'profile-primary',
    );
    const rowDisplay = await firstDependencyRow.evaluate(
      (element) => globalThis.getComputedStyle(element).display,
    );

    if (testInfo.project.name === 'mobile') {
      expect(rowDisplay).toBe('block');
    } else {
      expect(rowDisplay).toBe('table-row');
    }

    expectStaticNetworkOnly(page, monitor);
  });
});