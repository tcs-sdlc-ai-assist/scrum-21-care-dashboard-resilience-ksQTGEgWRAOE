import { useLocation } from 'react-router-dom';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AUTH_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
  VALIDATION_MESSAGES,
} from '../constants/messages.js';
import { SessionProvider } from '../context/SessionContext.jsx';
import AuthView from './AuthView.jsx';

/**
 * @param {'login'|'signup'} [initialMode]
 * @returns {ReturnType<typeof render>}
 */
function renderAuthView(initialMode = 'login') {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <Routes>
          <Route
            element={<AuthView initialMode={initialMode} />}
            path="/"
          />
          <Route
            element={<p>Care team destination</p>}
            path="/clinical"
          />
          <Route
            element={<p>SRE destination</p>}
            path="/sre"
          />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

/**
 * Exposes the current internal route for navigation assertions without
 * copying form values into the URL.
 *
 * @returns {import('react').ReactElement}
 */
function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Current route">{location.pathname}</output>;
}

/**
 * @returns {ReturnType<typeof render>}
 */
function renderAuthViewWithLocationProbe() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <LocationProbe />
        <Routes>
          <Route element={<AuthView />} path="/" />
          <Route
            element={<p>Care team destination</p>}
            path="/clinical"
          />
          <Route
            element={<p>SRE destination</p>}
            path="/sre"
          />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('AuthView', () => {
  it('renders the browser-local login form with accessible labels and mock boundary notices', () => {
    renderAuthView();

    expect(
      screen.getByRole('heading', {
        name: AUTH_MESSAGES.title,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', {
        name: AUTH_MESSAGES.loginTab,
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', {
        name: AUTH_MESSAGES.signupTab,
      }),
    ).toHaveAttribute('aria-selected', 'false');

    expect(
      screen.getByLabelText(AUTH_MESSAGES.emailLabel),
    ).toHaveAttribute('autocomplete', 'email');
    expect(
      screen.getByLabelText(AUTH_MESSAGES.passwordLabel),
    ).toHaveAttribute('autocomplete', 'current-password');
    expect(
      screen.getByRole('radio', {
        name: /Clinical staff/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: /Site reliability engineer/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.loginAction,
      }),
    ).toBeEnabled();

    expect(
      screen.getAllByText(MOCK_BOUNDARY_MESSAGES.badge).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(MOCK_BOUNDARY_MESSAGES.notSecurityBoundary, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it('supports keyboard tab selection and clears the transient password when changing modes', async () => {
    const user = userEvent.setup();

    renderAuthView();

    const passwordInput = screen.getByLabelText(
      AUTH_MESSAGES.passwordLabel,
    );
    const loginTab = screen.getByRole('tab', {
      name: AUTH_MESSAGES.loginTab,
    });
    const signupTab = screen.getByRole('tab', {
      name: AUTH_MESSAGES.signupTab,
    });

    await user.type(passwordInput, 'temporary-password');
    loginTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(signupTab).toHaveFocus();
    expect(signupTab).toHaveAttribute('aria-selected', 'true');
    expect(loginTab).toHaveAttribute('aria-selected', 'false');
    expect(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.signupAction,
      }),
    ).toBeEnabled();

    const signupPasswordInput = screen.getByLabelText(
      AUTH_MESSAGES.passwordLabel,
    );

    await waitFor(() => {
      expect(signupPasswordInput).toHaveValue('');
    });

    expect(signupPasswordInput).toHaveAttribute(
      'autocomplete',
      'new-password',
    );

    const tabPanel = screen.getByRole('tabpanel');

    expect(tabPanel).toHaveAttribute(
      'aria-labelledby',
      signupTab.id,
    );

    await user.keyboard('{Home}');

    expect(loginTab).toHaveFocus();
    expect(loginTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows field-associated validation errors and focuses the error summary after invalid submission', async () => {
    const user = userEvent.setup();

    renderAuthView();

    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.loginAction,
      }),
    );

    const summaryHeading = await screen.findByRole('heading', {
      name: VALIDATION_MESSAGES.summaryTitle,
      level: 2,
    });
    const errorSummary = summaryHeading.closest('[role="alert"]');
    const emailInput = screen.getByLabelText(
      AUTH_MESSAGES.emailLabel,
    );
    const passwordInput = screen.getByLabelText(
      AUTH_MESSAGES.passwordLabel,
    );

    expect(errorSummary).not.toBeNull();

    await waitFor(() => {
      expect(errorSummary).toHaveFocus();
    });

    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getAllByText(VALIDATION_MESSAGES.emailRequired),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(VALIDATION_MESSAGES.passwordRequired),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(VALIDATION_MESSAGES.roleRequired).length,
    ).toBeGreaterThanOrEqual(2);

    const emailErrorId = emailInput
      .getAttribute('aria-describedby')
      ?.split(' ')
      .find((id) => id.endsWith('-email-error'));
    const passwordErrorId = passwordInput
      .getAttribute('aria-describedby')
      ?.split(' ')
      .find((id) => id.endsWith('-password-error'));

    expect(emailErrorId).toBeTruthy();
    expect(passwordErrorId).toBeTruthy();
    expect(document.getElementById(emailErrorId)).toHaveTextContent(
      VALIDATION_MESSAGES.emailRequired,
    );
    expect(document.getElementById(passwordErrorId)).toHaveTextContent(
      VALIDATION_MESSAGES.passwordRequired,
    );
  });

  it('creates a mock login session and navigates to the selected SRE role view without placing credentials in the URL', async () => {
    const user = userEvent.setup();
    const rawEmail = 'operator@demo.example';
    const rawPassword = 'synthetic-password';

    renderAuthViewWithLocationProbe();

    await user.type(
      screen.getByLabelText(AUTH_MESSAGES.emailLabel),
      rawEmail,
    );
    await user.type(
      screen.getByLabelText(AUTH_MESSAGES.passwordLabel),
      rawPassword,
    );
    await user.click(
      screen.getByRole('radio', {
        name: /Site reliability engineer/i,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.loginAction,
      }),
    );

    expect(
      await screen.findByText('SRE destination'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', {
        name: 'Current route',
      }),
    ).toHaveTextContent('/sre');
    expect(globalThis.location.search).not.toContain(rawEmail);
    expect(globalThis.location.search).not.toContain(rawPassword);
    expect(globalThis.location.hash).not.toContain(rawEmail);
    expect(globalThis.location.hash).not.toContain(rawPassword);
  });

  it('creates a mock signup session and navigates to the selected clinical role view', async () => {
    const user = userEvent.setup();

    renderAuthView('signup');

    expect(
      screen.getByRole('tab', {
        name: AUTH_MESSAGES.signupTab,
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByLabelText(AUTH_MESSAGES.passwordLabel),
    ).toHaveAttribute('autocomplete', 'new-password');

    await user.type(
      screen.getByLabelText(AUTH_MESSAGES.emailLabel),
      'new.clinical@demo.example',
    );
    await user.type(
      screen.getByLabelText(AUTH_MESSAGES.passwordLabel),
      'synthetic-password',
    );
    await user.click(
      screen.getByRole('radio', {
        name: /Clinical staff/i,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: AUTH_MESSAGES.signupAction,
      }),
    );

    expect(
      await screen.findByText('Care team destination'),
    ).toBeInTheDocument();
  });

  it.each([
    {
      action: AUTH_MESSAGES.useCareTeamAccount,
      destination: 'Care team destination',
    },
    {
      action: AUTH_MESSAGES.useSreAccount,
      destination: 'SRE destination',
    },
  ])(
    'uses the fixed fake account for "$action" without making a network request',
    async ({ action, destination }) => {
      const fetchSpy = vi.fn();
      const xhrSpy = vi.fn();
      const webSocketSpy = vi.fn();
      const user = userEvent.setup();

      vi.stubGlobal('fetch', fetchSpy);
      vi.stubGlobal('XMLHttpRequest', xhrSpy);
      vi.stubGlobal('WebSocket', webSocketSpy);

      renderAuthView();

      await user.click(
        screen.getByRole('button', {
          name: action,
        }),
      );

      expect(
        await screen.findByText(destination),
      ).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSpy).not.toHaveBeenCalled();
      expect(webSocketSpy).not.toHaveBeenCalled();
    },
  );
});