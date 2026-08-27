# Care Dashboard Resilience Demo

A static, browser-only React application demonstrating deterministic profile-service failover, synthetic fallback, alerting, recovery, and role-specific dashboard presentation.

The project supports the resilience, privacy, accessibility, and observability requirements associated with:

- `SCRUM-1386`
- `SCRUM-1392`

## Demonstration Boundary

> **This application uses synthetic data only and is not for clinical or production use.**

The application:

- Runs entirely in the browser.
- Does not connect to clinical systems.
- Does not authenticate or authorize users.
- Does not connect to identity providers.
- Does not transmit PagerDuty or Slack events.
- Does not send telemetry to Prometheus, Grafana, analytics, or monitoring services.
- Does not perform application API requests.
- Does not use a database, serverless function, edge function, or application server.
- Does not persist sessions, profiles, fallback records, alerts, incidents, telemetry, or resilience snapshots.
- Does not require runtime credentials, endpoint URLs, integration keys, or secrets.

Labels such as **Mock PagerDuty**, **Mock Slack**, **Mock telemetry**, and **Mock dependency** represent browser-local records and deterministic JavaScript behavior only.

Role selection changes the visible demonstration experience. It is not authentication, authorization, access control, or a security boundary.

## Features

### Resilience lifecycle

- Three fixed browser-local dependencies:
  - Primary profile service
  - Secondary profile service
  - Context eligibility service
- Deterministic health responses:
  - Healthy
  - Degraded
  - Timeout
  - Invalid payload
  - Failed
- Primary circuit breaker opening after three consecutive failures.
- Automatic primary-to-secondary profile failover.
- In-memory synthetic fallback when both profile services are unavailable.
- Exact four-hour fallback lifetime.
- Stale timer and stale transition protection.
- Ordered primary recovery:
  - `OPEN`
  - `HALF_OPEN`
  - `CLOSED`
- Bounded local telemetry, alerts, and incident timelines.
- Browser-local alert acknowledgement.
- Deterministic scenario presets.
- Complete reset and session-clear behavior.

### Clinical presentation

- Synthetic profile requests.
- Masked account numbers.
- Fixed `MOCK-####` patient identifiers.
- Current profile-source status.
- Context eligibility status.
- Critical fallback activation and expiry notices.
- Recovery presentation.
- Privacy-safe field projection.

### SRE presentation

- Dependency status, latency, failure counts, and circuit states.
- Deterministic dependency simulation controls.
- Represented browser-local polling.
- Bounded telemetry visualization.
- Mock PagerDuty and Mock Slack alert records.
- Alert acknowledgement.
- Incident lifecycle timeline.
- Fallback and recovery controls.
- Sanitized diagnostic summaries.

### Accessibility and responsive behavior

- Semantic headings, forms, tables, lists, alerts, and dialogs.
- Keyboard-operable authentication tabs and native controls.
- Skip links.
- Field-associated validation messages.
- Focus movement for validation and reset confirmation.
- Escape handling for reset confirmation.
- Polite and assertive live regions.
- Text and symbols for non-color-only status presentation.
- Reduced-motion support.
- Dark-mode styles.
- Minimum touch-target sizing.
- Responsive desktop, tablet, and mobile layouts.
- Card-style dependency rows on small screens without losing table semantics.

## Technology

- JavaScript and JSX
- React 19
- React Router 7
- Vite 6
- Tailwind CSS 3
- Vitest
- React Testing Library
- jest-axe
- Playwright
- ESLint 9

## Prerequisites

Use:

- Node.js 20 or later
- npm
- Chromium browser dependencies when running Playwright tests

Confirm the installed versions:

```sh
node --version
npm --version
```

Install the exact locked dependency graph:

```sh
npm ci
```

Use `npm ci` in CI and release workflows. Do not regenerate the lockfile during deployment.

## Local Development

Start the Vite development server:

```sh
npm run dev
```

Open the URL printed by Vite, typically:

```text
http://localhost:5173/
```

The development server is for local development only. Production deployment publishes the generated static files from `dist/`.

## npm Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create the production static bundle in `dist/`. |
| `npm run preview` | Serve the generated production bundle locally. |
| `npm run lint` | Run ESLint across the repository. |
| `npm test` | Run the Vitest unit and component test suite once. |
| `npm run coverage` | Run Vitest with V8 coverage reports. |
| `npm run browser-test` | Run the Playwright browser acceptance suite. |

Recommended local verification:

```sh
npm run lint
npm test
npm run build
npm run browser-test
```

To preview the production build on the acceptance-test port:

```sh
npm run preview -- --host 127.0.0.1 --port 4173
```

## Application Routes

| Route | Description |
| --- | --- |
| `/` | Demo login presentation. |
| `/login` | Demo login presentation. |
| `/signup` | Demo signup presentation. |
| `/clinical` | Care team dashboard for an active clinical mock session. |
| `/sre` | SRE dashboard for an active SRE mock session. |
| Any other route | Static not-found view with a fixed safe destination. |

Protected-route handling is a navigation convenience only:

- A protected route without an in-memory session redirects to `/`.
- A clinical session visiting `/sre` redirects to `/clinical`.
- An SRE session visiting `/clinical` redirects to `/sre`.
- Attempted URLs are not copied into query parameters, hashes, or navigation state.
- Refreshing the page clears the in-memory session and returns protected routes to the entry view.

## Role Journeys

### Care team journey

1. Open `/`.
2. Select **Use care team demo account**.
3. Confirm the **Care team dashboard** is displayed.
4. Review the current mock profile source and context eligibility.
5. Select **Request synthetic profile**.
6. Review the approved synthetic fields:
   - `Synthetic Patient 0042`
   - `MOCK-0042`
   - `****0042`
   - Current source
   - Synthetic generation time
7. Log out to clear the session and all resilience activity.

The clinical projection receives only:

- Display name
- Mock patient identifier
- Masked account number
- Profile source
- Generation timestamp

Repository identifiers, fallback identifiers, timer revisions, credentials, and internal payload containers are excluded.

### SRE journey

1. Open `/`.
2. Select **Use SRE demo account**.
3. Confirm the **SRE dashboard** is displayed.
4. Review the three fixed mock dependencies.
5. Apply individual mock health responses or a deterministic scenario preset.
6. Review local telemetry, mock alerts, and incident events.
7. Acknowledge an active mock alert.
8. When the primary circuit is open, select **Simulate local recovery**.
9. Confirm recovery proceeds through `HALF_OPEN` and then `CLOSED`.
10. Reset the scenario or log out to clear browser-local operational activity.

The SRE projection contains operational fields only. It does not receive profile objects, fallback payloads, account numbers, profile fields, credentials, passwords, or timer revisions.

## Scenario Presets

The SRE dashboard provides the following deterministic presets.

### Healthy baseline

Restores:

- All dependencies to `HEALTHY`
- All circuits to `CLOSED`
- Failure counters to zero
- Profile source to `NONE`
- Fallback to `null`
- Alerts to an empty list
- Incidents to an empty list
- Telemetry to an empty list

The active mock session remains available when using the dashboard reset action.

### Primary degraded

Applies a degraded response to the primary profile dependency:

- Status: `DEGRADED`
- Latency: `800 ms`
- Circuit: `CLOSED`
- Consecutive failure count: `0`

A degraded response is not counted as a circuit-breaking failure.

### Primary failover

Applies three consecutive primary failures:

1. First failure increments the consecutive failure count to one.
2. Second failure increments the count to two.
3. Third failure opens the primary circuit.
4. The secondary profile service becomes the preferred usable source.
5. A failover incident is recorded.
6. A browser-local Mock PagerDuty alert is recorded.

Additional primary failures while the circuit remains open do not create duplicate failover incidents.

### Synthetic fallback active

Runs the complete fallback sequence:

1. Reset the scenario.
2. Apply three primary failures.
3. Open the primary circuit.
4. Apply a secondary profile failure.
5. Request `MOCK-0042`.
6. Create or reuse a valid in-memory fallback record.
7. Select `FALLBACK` as the profile source.
8. Record a fallback activation incident.
9. Record a browser-local mock alert.
10. Schedule fallback expiry.

The fallback expires exactly four hours after creation. It is valid only while:

```text
now < expiresAt
```

At:

```text
now >= expiresAt
```

the fallback is removed, an expiry event is recorded, profile-source selection is recalculated, and the updated state is published.

## Manual Dependency Simulation

The SRE dashboard supports these deterministic conditions:

| UI condition | Domain state | Latency | Valid payload | Counts as failure |
| --- | --- | ---: | --- | --- |
| Normal response | `HEALTHY` | 120 ms | Yes | No |
| Degraded response | `DEGRADED` | 800 ms | Yes | No |
| Timeout | `TIMEOUT` | 1,200 ms | No | Yes |
| Invalid payload | `INVALID_PAYLOAD` | 120 ms | No | Yes |
| Failure | `FAILED` | 0 ms | No | Yes |

Only the primary profile dependency automatically opens its circuit. Secondary and context failures are counted without opening their circuits.

## Recovery Behavior

Recovery is available only while the primary circuit is `OPEN`.

The deterministic order is:

```text
OPEN -> HALF_OPEN -> CLOSED
```

A successful local recovery:

1. Applies a successful probe.
2. Records a half-open event.
3. Verifies the half-open state.
4. Applies the closing transition.
5. Records a closed recovery event.
6. Removes the active fallback.
7. Restores `PRIMARY` as the profile source.
8. Records recovery telemetry.
9. Publishes the recovered snapshot.

The two recovery timeline entries have distinct event identifiers and remain ordered.

## Polling and Timers

Represented polling is local JavaScript activity. It does not call a dependency or monitoring service.

Polling is active only while:

- The SRE dashboard is mounted.
- The document is visible.
- The engine is running.
- At least one engine subscriber exists.

One engine owns at most one polling interval. Each poll records the current state of the three fixed dependencies without changing the selected scenario.

Polling stops when:

- The document becomes hidden.
- The SRE dashboard unmounts.
- The final subscriber unsubscribes.
- The engine stops.
- The session is cleared.

The engine also owns the active fallback timer. Replacement, recovery, reset, expiry, engine stop, and session clear reconcile or cancel that timer.

## Data and Privacy Model

### Synthetic fixtures

The application generates at most 100 synthetic profiles.

Profiles follow these formats:

```text
Patient identifier: MOCK-####
Masked account: ****####
Display name: Synthetic Patient ####
Source: PRIMARY | SECONDARY | FALLBACK
```

The active demonstration record is:

```text
MOCK-0042
```

A fixture is rejected if it contains:

- A malformed identifier
- An unmasked account number
- An unsupported source
- An unsafe display name
- An invalid timestamp
- An unsafe repository identifier

### Browser memory

The following data remains in browser memory only:

- Mock sessions
- Synthetic profiles
- Fallback records
- Alerts
- Incidents
- Telemetry
- Resilience snapshots
- Diagnostic lifecycle state

A full page refresh creates a new in-memory application session.

### Permitted local storage

Only two exact-schema records are permitted.

Preferences:

```text
Key: care-dashboard.preferences.v1

{
  reducedMotion: boolean,
  density: "comfortable" | "compact"
}
```

Scenario preference:

```text
Key: care-dashboard.scenario.v1

{
  scenarioId: "baseline"
}
```

Unknown fields, missing fields, unsupported values, malformed JSON, and values larger than 2,048 characters are rejected and removed.

### Diagnostics

Incident diagnostic summaries are normalized to:

```text
mock-record-MOCK-####
```

When no valid synthetic identifier is available, the safe fallback is:

```text
mock-record-MOCK-0000
```

Arbitrary diagnostic text is not retained.

### Logging

The privacy logger accepts only allowlisted structured fields:

- Event code
- Event identifier or mock event identifier
- Dependency identifier
- Role
- Timestamp

Validated records are written only in development builds. Production logging is disabled by construction.

### Error containment

Expected lifecycle failures are returned as privacy-safe result objects.

Unexpected render failures:

- Do not display raw exception messages.
- Do not display component stacks.
- Do not expose credentials or profile payloads.
- Do not log exception details from the error boundary.
- Present generic reset and reload guidance.

## Architecture

The application is a static single-page application:

```text
index.html
    |
    v
src/main.jsx
    |
    v
src/App.jsx
    |
    +-- ErrorBoundary
    +-- SessionProvider
    +-- DashboardProvider
    +-- AppRouter
            |
            +-- AuthView
            +-- AppShell
            |     +-- ClinicalDashboard
            |     +-- SreDashboard
            |
            +-- NotFound
```

`src/main.jsx` creates the React root and renders `App` inside `StrictMode`.

`src/App.jsx` creates one resilience engine and lifecycle adapter, then composes the application providers and router.

`src/routing/router.jsx` owns the single `BrowserRouter`. No second router is created in `main.jsx` or a page component.

### Browser-local action flow

```text
React component
    |
    v
DashboardContext.dispatch(command)
    |
    v
createResilienceLifecycleAdapter
    |
    v
ResilienceEngine
    |
    +-- StateMachine
    +-- DependencyAdapter
    +-- FallbackRepository
    +-- IncidentRepository
    +-- TelemetryRepository
    +-- Synthetic fixtures
```

All operational actions execute against local JavaScript objects. No domain service requires `fetch`, `XMLHttpRequest`, `WebSocket`, event streams, or an external SDK.

### Lifecycle command boundary

Dashboard commands use exact allowlisted schemas:

- `SIMULATE_HEALTH`
- `SIMULATE_RECOVERY`
- `REQUEST_PROFILE`
- `ACKNOWLEDGE_ALERT`
- `RESET_DEMO`

Missing fields and additional fields are rejected.

Only one engine command may run at a time. A nested command receives a safe `INVALID_COMMAND` result and cannot interrupt the active command.

### Immutable state

The engine owns one validated immutable snapshot containing:

- Version and reference date
- Current timestamp
- Exactly three dependency records
- Current profile source
- Optional fallback state
- Bounded alerts
- Bounded incidents
- Bounded telemetry
- Last event identifier

Alerts, incidents, and telemetry retain only the newest 50 records.

For detailed contracts and transition rules, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Project Structure

```text
.
├── public/
│   └── favicon.svg
├── src/
│   ├── adapters/
│   │   ├── DependencyAdapter.js
│   │   └── createResilienceLifecycleAdapter.js
│   ├── components/
│   │   ├── auth/
│   │   ├── clinical/
│   │   ├── layout/
│   │   ├── shared/
│   │   └── sre/
│   ├── constants/
│   │   └── messages.js
│   ├── context/
│   │   ├── DashboardContext.jsx
│   │   └── SessionContext.jsx
│   ├── contracts/
│   │   └── ResilienceLifecycleContract.js
│   ├── domain/
│   │   ├── constants.js
│   │   ├── errors.js
│   │   ├── model.js
│   │   ├── selectors.js
│   │   └── StateMachine.js
│   ├── engine/
│   │   ├── ResilienceEngine.js
│   │   └── ResilienceLifecycleHooks.js
│   ├── fixtures/
│   │   ├── demoAccounts.js
│   │   ├── initialState.js
│   │   └── profiles.js
│   ├── hooks/
│   │   ├── useMockSession.js
│   │   └── usePollingLifecycle.js
│   ├── pages/
│   │   ├── AuthView.jsx
│   │   ├── ClinicalDashboard.jsx
│   │   ├── NotFound.jsx
│   │   └── SreDashboard.jsx
│   ├── repositories/
│   │   ├── FallbackRepository.js
│   │   ├── IncidentRepository.js
│   │   └── TelemetryRepository.js
│   ├── routing/
│   │   ├── RouteGuard.jsx
│   │   └── router.jsx
│   ├── selectors/
│   │   ├── PrivacySelectors.js
│   │   └── ViewModelSelectors.js
│   ├── services/
│   │   └── privacyLogger.js
│   ├── session/
│   │   └── sessionReducer.js
│   ├── storage/
│   │   └── preferencesStore.js
│   ├── test/
│   ├── utils/
│   │   ├── clock.js
│   │   ├── collections.js
│   │   └── privacy.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── ARCHITECTURE.md
├── CHANGELOG.md
├── DEPLOYMENT.md
├── index.html
├── package.json
├── playwright.config.js
├── tailwind.config.js
├── vercel.json
├── vite.config.js
└── vitest.config.js
```

## Testing

### Unit and component tests

Run:

```sh
npm test
```

The Vitest and React Testing Library suites cover:

- Domain validation and immutable models.
- Dependency health transitions.
- Circuit-breaker behavior.
- Primary failover.
- Exact fallback TTL boundaries.
- Stale transition and stale timer handling.
- Ordered recovery.
- Repository limits and idempotency.
- Privacy masking and prohibited-field detection.
- Session validation and credential non-retention.
- Lifecycle command validation.
- Clinical and SRE user behavior.
- Keyboard interaction.
- Accessibility with jest-axe.
- Absence of browser network access.

The test environment blocks unmocked construction or use of:

- `fetch`
- `XMLHttpRequest`
- `WebSocket`

Run coverage:

```sh
npm run coverage
```

Coverage reports are written under `coverage/`.

### Browser acceptance tests

Install Chromium if necessary:

```sh
npx playwright install chromium
```

Run:

```sh
npm run browser-test
```

Playwright projects cover desktop, tablet, and mobile viewports.

Browser acceptance verifies:

- Clinical demo account entry.
- Synthetic profile requests.
- SRE failover and fallback activation.
- Primary circuit opening.
- Mock alert acknowledgement.
- Ordered local recovery.
- Protected deep links.
- Refresh behavior.
- Keyboard-only role journey.
- Responsive dependency-table behavior.
- Absence of horizontal overflow.
- Fallback and recovery presentation timing.
- Static same-origin network activity only.
- Absence of WebSocket connections.

The browser network boundary permits only same-origin static `GET` requests for documents, scripts, stylesheets, images, and fonts.

## Accessibility Guidance

Changes should preserve:

- One logical page-level heading.
- Semantic form controls and labels.
- Semantic table structure for dependency health.
- Keyboard access to all interactive controls.
- Visible focus indicators.
- Error summaries linked to invalid fields.
- Focus restoration after reset confirmation.
- Escape handling for dismissible confirmation UI.
- Assertive announcements for fallback activation and expiry.
- Polite announcements for recovery.
- Status text and symbols in addition to color.
- Reduced-motion behavior.
- Dark-mode contrast.
- Minimum `2.75rem` touch targets.
- No horizontal overflow at supported widths.

When adding a status, do not communicate meaning through color alone. Extend the shared status-label, description, tone, and symbol mappings as needed.

When adding a form control, provide a visible label, associated help text, validation messaging, and keyboard behavior.

## Privacy and Security Guidance

Changes must preserve these boundaries:

1. Use synthetic fixtures only.
2. Do not add clinical system integrations.
3. Do not add authentication or authorization claims.
4. Do not persist sessions or operational state.
5. Do not add endpoint URLs, service credentials, or integration keys.
6. Do not add analytics, remote logging, or monitoring SDKs.
7. Do not expose raw profiles to SRE presentation code.
8. Do not expose repository identifiers or timer revisions to clinical views.
9. Keep lifecycle commands exact-schema and allowlisted.
10. Sanitize diagnostics before storage or presentation.
11. Keep alerts, incidents, and telemetry bounded.
12. Do not log credentials, profiles, arbitrary payloads, or exception details.
13. Do not introduce `fetch`, XHR, WebSocket, event-stream, or other runtime application traffic.
14. Do not add a service worker or runtime cache without architecture review.

All `VITE_*` values are public because Vite compiles them into the client bundle.

## Environment Variables

The only supported environment variable is:

```text
VITE_BUILD_LABEL
```

It is optional, non-secret build metadata displayed in the application footer.

Example:

```sh
VITE_BUILD_LABEL="preview-2026-08-27.1" npm run build
```

Leave it empty to omit the label:

```sh
VITE_BUILD_LABEL= npm run build
```

A template is provided in `.env.example`.

Never place any of the following in `VITE_BUILD_LABEL` or another `VITE_*` variable:

- Passwords
- Tokens
- API keys
- Service credentials
- Endpoint credentials
- Patient or account data
- Private incident details
- Internal diagnostic payloads

The project intentionally does not support runtime endpoint or secret configuration.

## Production Build

Create the static production artifact:

```sh
npm run build
```

The output is written to:

```text
dist/
```

The bundle contains static HTML, JavaScript, CSS, and assets only.

The Vite build uses:

- SPA application mode
- Root base path `/`
- ES2020 JavaScript target
- Content-hashed assets
- CSS code splitting
- Disabled source maps

Only the contents of `dist/` should be published.

## Vercel Deployment

The checked-in `vercel.json` provides the SPA rewrite:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Recommended Vercel settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Node.js version | 20 or later |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Development command | `npm run dev` |
| Root directory | Repository root |

Do not configure:

- API routes
- Serverless functions
- Edge functions
- Middleware
- Runtime secrets
- External service integrations
- Injected analytics or monitoring scripts

After deployment, verify:

1. `/` loads the demo entry.
2. `/signup` loads directly.
3. `/clinical` and `/sre` load the SPA and return safely to `/` without a session.
4. Refreshing a protected route clears the in-memory session.
5. Clinical synthetic profile requests work.
6. SRE fallback and recovery flows work.
7. Browser traffic contains only same-origin static `GET` requests.
8. No WebSocket, analytics, API, or telemetry transmission occurs.

For complete deployment, cache, rollback, and CI/CD guidance, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Deployment on Other Static Hosts

Another static host may be used if it:

1. Publishes `dist/` as the site root.
2. Serves existing static assets directly.
3. Rewrites unknown application routes to `/index.html`.
4. Preserves the requested browser URL.
5. Uses HTTPS and the same origin for application assets.
6. Does not inject external scripts, analytics, authentication, or monitoring.
7. Does not add API proxies, runtime functions, or service workers.

A redirect from `/clinical` to `/index.html` is not equivalent to an SPA rewrite because it changes the visible browser URL.

## Cache Guidance

Recommended cache behavior:

| Resource | Recommendation |
| --- | --- |
| `/index.html` | Revalidate or use a short cache lifetime. |
| `/assets/*` hashed files | Use a long-lived immutable cache. |
| SPA route responses | Follow the `index.html` revalidation policy. |

Do not cache `index.html` indefinitely. The application does not install a service worker and does not manage an offline runtime cache.

## Limitations

This project is intentionally constrained.

- It is a demonstration, not a clinical application.
- It must not be used for care delivery or clinical decision-making.
- It does not authenticate users.
- It does not authorize access.
- It does not provide account security.
- It does not connect to real profile services.
- It does not connect to context or eligibility services.
- It does not send PagerDuty or Slack notifications.
- It does not expose live Prometheus or Grafana data.
- It does not provide durable incident management.
- It does not persist operational activity.
- It does not synchronize state across tabs, devices, or users.
- Refreshing the page clears the session and operational state.
- Timings, failures, profiles, incidents, and alerts are deterministic simulations.
- Browser-local polling represents monitoring activity but performs no dependency checks.
- The application assumes deployment at the origin root.
- The Vercel rewrite must be replaced with equivalent SPA fallback behavior on another host.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Runtime architecture, contracts, state model, transitions, privacy model, and traceability.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Build, verification, Vercel deployment, rollback, caching, and CI/CD guidance.
- [CHANGELOG.md](CHANGELOG.md) — Release history and security/privacy notes.
- [.env.example](.env.example) — Optional public build-label configuration.

## License

Private and proprietary.

This source code and its accompanying documentation are confidential and are not licensed for public use, copying, modification, distribution, sublicensing, or commercial exploitation. All rights are reserved by the project owner. No open-source license is granted.