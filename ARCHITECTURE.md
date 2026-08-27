# Care Dashboard Resilience Demo Architecture

## 1. Purpose

The Care Dashboard Resilience Demo is a static, browser-only React application that demonstrates deterministic profile failover, synthetic fallback, alerting, recovery, and role-specific presentation.

The application:

- Uses synthetic fixtures only.
- Keeps sessions and operational state in browser memory.
- Does not connect to clinical systems, monitoring platforms, identity providers, PagerDuty, Slack, or other external services.
- Does not treat role selection as authentication or authorization.
- Does not send profile, credential, telemetry, alert, or incident data over the network.
- Is not for clinical or production use.

This document defines the architecture and contracts supporting:

- `SCRUM-1385`
- `SCRUM-1386`
- `SCRUM-1392`

## 2. Runtime Architecture

### 2.1 Deployment model

The project builds to a static single-page application using Vite.

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

The production bundle contains HTML, JavaScript, CSS, and static assets only. There is no application server, API route, database, service worker, or server-side rendering layer.

`vercel.json` rewrites all paths to `index.html` so browser refreshes and direct SPA route requests can load the client application. Vite is configured with `appType: 'spa'`.

### 2.2 Browser-local execution boundary

All application actions execute through local JavaScript objects:

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

No component or domain service requires `fetch`, `XMLHttpRequest`, `WebSocket`, event streams, or external SDKs.

The browser acceptance suite monitors requests and permits only same-origin static `GET` requests for documents, scripts, stylesheets, images, and fonts.

## 3. Module Responsibilities

### 3.1 Application composition

| Module | Responsibility |
| --- | --- |
| `src/main.jsx` | Creates the React root and renders `App` inside `StrictMode`. It does not own routing or domain providers. |
| `src/App.jsx` | Creates the single resilience engine and lifecycle adapter, then composes the error boundary, session provider, dashboard provider, and router. |
| `src/routing/router.jsx` | Owns the single `BrowserRouter` and defines the route tree. |
| `src/routing/RouteGuard.jsx` | Applies navigation-only session and role alignment for fixed dashboard routes. It is not a security boundary. |
| `src/components/layout/AppShell.jsx` | Provides authenticated-view layout, navigation, demo notices, reset confirmation, logout controls, and build metadata. |
| `src/components/shared/ErrorBoundary.jsx` | Contains render failures and displays privacy-safe recovery actions without exposing exception details. |

### 3.2 Session and authentication presentation

| Module | Responsibility |
| --- | --- |
| `src/pages/AuthView.jsx` | Presents login/signup modes and navigates an established mock session to its role view. |
| `src/components/auth/MockAuthForm.jsx` | Collects transient demo credentials and role selection without native submission or network activity. |
| `src/components/auth/RoleSelector.jsx` | Provides the accessible mock role radio group. |
| `src/context/SessionContext.jsx` | Exposes one application-wide in-memory mock session. |
| `src/hooks/useMockSession.js` | Connects session actions to the reducer and resets the engine when the session is cleared. |
| `src/session/sessionReducer.js` | Validates input and creates minimal immutable session metadata without retaining raw email or password values. |
| `src/fixtures/demoAccounts.js` | Defines fixed fake clinical and SRE account inputs. |

### 3.3 Shared dashboard state

| Module | Responsibility |
| --- | --- |
| `src/context/DashboardContext.jsx` | Subscribes React to the engine snapshot with `useSyncExternalStore` and exposes validated lifecycle dispatch. |
| `src/adapters/createResilienceLifecycleAdapter.js` | Maps public lifecycle commands to engine methods and domain health statuses. |
| `src/contracts/ResilienceLifecycleContract.js` | Defines, validates, and freezes the public dashboard-to-engine command contract. |
| `src/engine/ResilienceEngine.js` | Orchestrates commands, immutable state, repositories, polling, timers, notifications, and safe command results. |
| `src/engine/ResilienceLifecycleHooks.js` | Defines engine start, stop, reset, and session-clear lifecycle hooks. |
| `src/hooks/usePollingLifecycle.js` | Starts represented polling only while the SRE route is active and the document is visible. |

### 3.4 Domain model and transitions

| Module | Responsibility |
| --- | --- |
| `src/domain/constants.js` | Defines fixed identifiers, states, limits, and timing values. |
| `src/domain/model.js` | Validates and creates immutable profiles, dependencies, fallback records, alerts, incidents, telemetry, snapshots, commands, and results. |
| `src/domain/StateMachine.js` | Applies dependency transitions, profile-source selection, circuit behavior, stale-event protection, and ordered recovery. |
| `src/domain/selectors.js` | Derives immutable dependency, profile, alert, incident, and telemetry projections. |
| `src/domain/errors.js` | Defines expected domain errors with privacy-safe codes, messages, and field details. |

### 3.5 Local adapters and repositories

| Module | Responsibility |
| --- | --- |
| `src/adapters/DependencyAdapter.js` | Returns deterministic local responses for the three fixed mock dependencies. |
| `src/repositories/FallbackRepository.js` | Stores expiring synthetic fallback records in memory. |
| `src/repositories/IncidentRepository.js` | Stores bounded incidents, lifecycle events, and mock alerts in memory. |
| `src/repositories/TelemetryRepository.js` | Stores bounded validated telemetry samples in memory. |
| `src/fixtures/profiles.js` | Generates the bounded synthetic profile fixture set and active profile variants. |
| `src/fixtures/initialState.js` | Creates a fresh immutable baseline snapshot. |

### 3.6 Presentation and selectors

| Module | Responsibility |
| --- | --- |
| `src/pages/ClinicalDashboard.jsx` | Presents profile availability, source, fallback state, context eligibility, and profile request actions. |
| `src/pages/SreDashboard.jsx` | Presents dependency health, controls, telemetry, alerts, incidents, fallback operations, and recovery actions. |
| `src/selectors/ViewModelSelectors.js` | Produces stable clinical and SRE view models and the active fallback banner model. |
| `src/selectors/PrivacySelectors.js` | Restricts UI models to approved clinical and operational fields. |
| `src/components/clinical/*` | Presents synthetic profiles, profile-source badges, and fallback status. |
| `src/components/sre/*` | Presents controls, dependency health, telemetry, alerts, and incident timelines. |
| `src/components/shared/*` | Provides status badges, notices, reset controls, live regions, and error containment. |

### 3.7 Utilities and storage

| Module | Responsibility |
| --- | --- |
| `src/utils/clock.js` | Provides system, reference-date, and deterministic fake clocks plus time formatting and scheduling. |
| `src/utils/privacy.js` | Masks PII, validates synthetic records, sanitizes diagnostics, and detects prohibited fields. |
| `src/utils/collections.js` | Implements immutable bounded append, cap, and upsert operations. |
| `src/storage/preferencesStore.js` | Persists only exact allowlisted UI preferences and baseline scenario selection. |
| `src/services/privacyLogger.js` | Creates allowlisted structured diagnostics and writes them only in development builds. |

## 4. URL Contract

### 4.1 Routes

| URL | Session requirement | Presentation |
| --- | --- | --- |
| `/` | None | Demo login view |
| `/login` | None | Demo login view |
| `/signup` | None | Demo signup view |
| `/clinical` | Active clinical mock session | Care team dashboard in `AppShell` |
| `/sre` | Active SRE mock session | SRE dashboard in `AppShell` |
| Any other path | None | Static not-found view with a fixed safe destination |

### 4.2 Guard behavior

`RouteGuard` is a navigation convenience only.

- A protected route with no active session redirects to `/`.
- A clinical session requesting `/sre` redirects to `/clinical`.
- An SRE session requesting `/clinical` redirects to `/sre`.
- Redirects use fixed internal paths.
- Attempted paths are not copied into query parameters, hashes, or navigation state.
- Session state is intentionally not persisted, so a full refresh starts at the entry view after the route guard runs.

The guard does not provide authentication, authorization, permissions, claims, or access control.

### 4.3 Static-host behavior

The static host must serve `index.html` for client-side routes. The checked-in Vercel configuration provides:

```text
/(.*) -> /index.html
```

A different static host must provide an equivalent SPA fallback.

## 5. Session Contract

The session reducer accepts transient input containing:

```text
email
password
role
```

Supported role inputs are:

```text
clinical
CARE_TEAM
sre
SRE
```

The resulting session contains only:

```text
sessionId
role
emailLabel
createdAt
```

The following values are never retained in session state:

- Raw email address
- Password
- Token
- Authentication status
- Authorization status
- Permissions
- Claims

The email label is masked before entering session state. Password input exists only in the current form/action flow and is cleared when appropriate.

Clearing the session:

1. Starts the engine if necessary.
2. Resets all resilience activity.
3. Stops engine timers.
4. Clears the reducer session.
5. Returns the user to the entry route through normal React routing.

## 6. Lifecycle Action Contract

### 6.1 Public lifecycle interface

The dashboard provider requires a lifecycle object with:

```text
subscribe(listener) -> unsubscribe
getSnapshot() -> immutable snapshot
dispatch(command) -> command result
resetScenario() -> command result
```

The adapter requires the engine to provide:

```text
subscribe
getSnapshot
simulateHealth
simulateRecovery
requestProfile
acknowledgeAlert
resetDemo
```

Commands are exact-schema allowlisted objects. Missing fields and additional fields are rejected.

### 6.2 Supported commands

#### Simulate health

```text
{
  type: "SIMULATE_HEALTH",
  dependencyId: "profile-primary" |
                "profile-secondary" |
                "context-eligibility",
  outcome: "healthy" |
           "degraded" |
           "timeout" |
           "invalid-payload" |
           "failed"
}
```

Outcome mapping:

| Lifecycle outcome | Domain health state |
| --- | --- |
| `healthy` | `HEALTHY` |
| `degraded` | `DEGRADED` |
| `timeout` | `TIMEOUT` |
| `invalid-payload` | `INVALID_PAYLOAD` |
| `failed` | `FAILED` |

#### Simulate recovery

```text
{
  type: "SIMULATE_RECOVERY",
  dependencyId: "profile-primary",
  profileId: "MOCK-####"
}
```

Recovery is supported only for `profile-primary`.

#### Request profile

```text
{
  type: "REQUEST_PROFILE",
  profileId: "MOCK-####"
}
```

#### Acknowledge alert

```text
{
  type: "ACKNOWLEDGE_ALERT",
  alertId: "<bounded privacy-safe identifier>"
}
```

#### Reset demo

```text
{
  type: "RESET_DEMO"
}
```

### 6.3 Command result contract

A successful command returns:

```text
{
  ok: true,
  eventId: "<bounded event identifier>",
  snapshot: "<validated immutable snapshot>"
}
```

An expected command failure returns:

```text
{
  ok: false,
  error: {
    code: "<uppercase privacy-safe code>",
    message: "<privacy-safe message>",
    details?: {
      field: "<safe field name>"
    }
  },
  snapshot: "<current validated immutable snapshot>"
}
```

Expected validation and lifecycle failures are returned as data rather than thrown through React presentation code. Unexpected exceptions are converted to a generic safe error result.

Only one command may run at a time. A nested command receives `INVALID_COMMAND` and cannot interrupt the active command.

## 7. State Model

### 7.1 Snapshot

The engine owns one immutable snapshot:

```text
{
  version: 1,
  referenceDate: "2026-08-27",
  now: number,
  dependencies: DependencyState[3],
  profileSource: "PRIMARY" | "SECONDARY" | "FALLBACK" | "NONE",
  fallback: FallbackState | null,
  alerts: Alert[],
  incidents: IncidentEvent[],
  telemetry: TelemetrySample[],
  lastEventId: string | null
}
```

Every snapshot is validated and frozen before publication.

### 7.2 Fixed dependencies

Exactly three dependency records must exist, in fixed order:

1. `profile-primary`
2. `profile-secondary`
3. `context-eligibility`

A dependency state contains:

```text
{
  dependencyId,
  status,
  latencyMs,
  failureCount,
  circuit,
  lastCheckedAt,
  consecutiveFailureCount,
  probeDueAt
}
```

Supported health states:

```text
HEALTHY
DEGRADED
TIMEOUT
INVALID_PAYLOAD
FAILED
```

Supported circuit states:

```text
CLOSED
OPEN
HALF_OPEN
```

### 7.3 Deterministic response profiles

| Condition | Health state | Latency | Payload valid |
| --- | --- | ---: | --- |
| Normal | `HEALTHY` | 120 ms | Yes |
| Degraded | `DEGRADED` | 800 ms | Yes |
| Timeout | `TIMEOUT` | 1,200 ms | No |
| Invalid payload | `INVALID_PAYLOAD` | 120 ms | No |
| Failure | `FAILED` | 0 ms | No |

The adapter performs no I/O and returns immutable shared response definitions.

### 7.4 Failure accounting

The following states count as failures:

```text
TIMEOUT
INVALID_PAYLOAD
FAILED
```

A failure:

- Increments cumulative `failureCount`.
- Increments `consecutiveFailureCount`.

A non-failure:

- Preserves cumulative `failureCount`.
- Resets `consecutiveFailureCount` to zero.

Only the primary profile circuit automatically opens after three consecutive failures. Secondary and context dependency failure counts are tracked without opening their circuits.

### 7.5 Profile source

Supported sources are:

```text
PRIMARY
SECONDARY
FALLBACK
NONE
```

Source precedence is:

1. Healthy primary with a closed circuit.
2. Healthy secondary with a closed circuit.
3. Unexpired browser-local fallback.
4. Unavailable.

A fallback cannot take precedence over a usable primary or secondary source.

### 7.6 Fallback state

A fallback record contains:

```text
{
  id,
  profileId,
  data,
  createdAt,
  expiresAt,
  timerRevision
}
```

Properties:

- Stored only in the in-memory `FallbackRepository`.
- Associated with one `MOCK-####` profile.
- Contains a validated synthetic profile with source `FALLBACK`.
- Expires after exactly four hours by default.
- Is valid only while `now < expiresAt`.
- Uses monotonic identifiers and timer revisions.
- Is removed on expiry, recovery, replacement, reset, or session clear.

Timer revision checks prevent callbacks from an old fallback from expiring a replacement record.

### 7.7 Alerts, incidents, and telemetry

Alert records contain:

```text
id
incidentId
channel
severity
title
createdAt
acknowledged
```

Incident records contain:

```text
eventId
type
dependencyId
severity
condition
circuit
dataSource
occurredAt
recoveryStatus
diagnosticSummary
```

Telemetry records contain:

```text
timestamp
dependencyId
status
responseTimeMs
failureCount
circuit
dataSource
incidentActivity
```

All records are validated, immutable, browser-local, and synthetic.

## 8. Transition Order

### 8.1 Baseline

Reset establishes:

```text
All dependencies: HEALTHY
All circuits: CLOSED
All counts: 0
Profile source: NONE
Fallback: null
Alerts: []
Incidents: []
Telemetry: []
```

The reset receives a fresh event identifier as `lastEventId`.

### 8.2 Primary failover

The deterministic failover sequence is:

```text
Primary failure 1
    CLOSED, consecutive failures 1

Primary failure 2
    CLOSED, consecutive failures 2

Primary failure 3
    OPEN, consecutive failures 3
    probe due time assigned
    profile source changes to SECONDARY when usable
    failover incident recorded
    Mock PagerDuty alert recorded
```

Additional primary failures while the circuit remains open do not create duplicate failover incidents.

A healthy non-probe response does not close an open circuit.

### 8.3 Fallback activation

The deterministic fallback sequence is:

```text
1. Reset baseline.
2. Apply three primary failures.
3. Primary circuit opens.
4. Apply a secondary profile failure.
5. Request the fixed synthetic profile.
6. Reuse a valid matching fallback or create one.
7. Select FALLBACK as the profile source.
8. Record a fallback activation incident.
9. Record a mock alert.
10. Schedule authoritative expiry.
11. Publish one updated snapshot.
```

The clinical dashboard receives the fallback through the shared snapshot; it does not load fallback data independently.

### 8.4 Ordered recovery

Recovery is accepted only while the primary circuit is `OPEN`.

The order is:

```text
OPEN
  |
  | successful local probe
  v
HALF_OPEN
  |
  | successful closing transition
  v
CLOSED
```

The engine:

1. Creates distinct half-open and closed event identifiers.
2. Applies `OPEN -> HALF_OPEN`.
3. Verifies the half-open state.
4. Applies `HALF_OPEN -> CLOSED`.
5. Records half-open and closed recovery timeline events in that order.
6. Removes the active fallback.
7. Restores `PRIMARY` as the source.
8. Records recovery telemetry.
9. Publishes the closed snapshot.

A failed probe from `HALF_OPEN` returns the circuit to `OPEN` and schedules another probe boundary.

### 8.5 Fallback expiry

At the exact expiry boundary:

1. The fallback identifier and timer revision are checked.
2. The repository confirms `now >= expiresAt`.
3. The fallback is removed.
4. An expiry timeline event is recorded.
5. Profile source selection is recalculated without fallback.
6. The snapshot publishes `fallback: null`.
7. Clinical and SRE live regions announce the expiry.

Callbacks with stale identifiers or revisions cannot modify current state.

### 8.6 Alert acknowledgement

Acknowledgement:

1. Validates the bounded alert identifier.
2. Confirms the alert exists.
3. Replaces the alert with an immutable acknowledged record.
4. Preserves record ordering.
5. Publishes an updated snapshot.

The SRE privacy selector exposes only unacknowledged alerts in the active alert list.

### 8.7 Stale transition protection

A transition is rejected when:

- Its event identifier matches the current `lastEventId`.
- Its timestamp predates the snapshot timestamp.
- Its timestamp predates the target dependency’s last check.
- Its dependency identifier does not match the target record.
- It targets a missing dependency.

Rejected transitions do not mutate the current snapshot.

## 9. Polling and Timer Ownership

### 9.1 Represented polling

Polling is a browser-local representation of monitoring activity. It does not call a dependency.

Polling starts only when:

- The SRE dashboard route is active.
- The mock session is active.
- The selected role is SRE.
- The document is visible.
- At least one engine subscriber exists.

One engine owns at most one polling interval regardless of subscriber count.

Each poll records one telemetry sample for each of the three current dependency states. Polling does not change the selected scenario or invoke dependency adapters.

Polling stops when:

- The document is hidden.
- The SRE dashboard unmounts.
- The final subscriber unsubscribes.
- The engine stops.
- The session is cleared.

### 9.2 Fallback timers

The engine owns the current fallback timer. Replacing, recovering, resetting, stopping, or expiring the fallback cancels or reconciles that timer.

The clock abstraction allows deterministic timer behavior in unit tests.

## 10. Mock Integration Boundaries

The following labels represent local pipeline-aligned mocks only:

| Label | Meaning |
| --- | --- |
| Mock PagerDuty | A local alert record using channel `MOCK_PAGERDUTY`; no PagerDuty event is transmitted. |
| Mock Slack | A local alert record using channel `MOCK_SLACK`; no Slack message is transmitted. |
| Mock telemetry | Local bounded samples; no Prometheus, Grafana, or monitoring backend is connected. |
| Mock dependency | A deterministic adapter object; no service request is made. |
| Mock authentication | In-memory role-based presentation selection; no identity provider is contacted. |

No endpoint URLs, credentials, integration keys, or service secrets are supported.

`VITE_BUILD_LABEL` is the only documented environment variable. It is optional non-secret build metadata. All `VITE_*` values are exposed to the client bundle and must never contain secrets.

## 11. Privacy Model

### 11.1 Synthetic profile constraints

Synthetic profiles use:

```text
Patient identifier: MOCK-####
Masked account: ****####
Display name: Synthetic Patient ####
Source: PRIMARY | SECONDARY | FALLBACK
```

A fixture is rejected if it contains a malformed identifier, unmasked account number, unsupported source, unsafe display name, invalid timestamp, or unsafe repository identifier.

The fixture set contains at most 100 profiles. The active demonstration profile is `MOCK-0042`.

### 11.2 Clinical projection

The clinical view may receive only:

```text
displayName
patientIdentifier
accountNumber
source
generatedAt
```

Repository profile IDs, fallback IDs, timer revisions, credentials, and internal payload containers are omitted.

### 11.3 SRE projection

The SRE view receives operational projections only:

- Dependency status and counters
- Telemetry metrics
- Alert metadata
- Incident lifecycle fields
- Sanitized diagnostic summaries

The SRE model must not expose:

- Profile objects
- Fallback payloads
- Patient identifiers as profile fields
- Account numbers
- Credentials
- Passwords
- Timer revisions

### 11.4 Diagnostic sanitization

Diagnostic summaries are normalized to:

```text
mock-record-MOCK-####
```

If a valid synthetic identifier cannot be found, the value becomes:

```text
mock-record-MOCK-0000
```

Arbitrary diagnostic text is not retained.

### 11.5 Logging

The privacy logger accepts only:

```text
eventCode
eventId or mockEventId
dependencyId
role
timestamp
```

It rejects arbitrary metadata and prohibited logging fields. Validated records are written only in development builds.

Production logging is disabled by construction.

### 11.6 Error containment

Expected domain failures use fixed privacy-safe codes and messages.

Unexpected errors:

- Are not stored in React error-boundary state.
- Are not rendered.
- Are not logged by the error boundary.
- Do not expose component stacks, credentials, profiles, or diagnostic payloads.
- Produce generic reset/reload guidance.

## 12. Persistence Contract

Operational state is never persisted.

The only permitted local-storage records are:

### Preferences

Key:

```text
care-dashboard.preferences.v1
```

Exact schema:

```text
{
  reducedMotion: boolean,
  density: "comfortable" | "compact"
}
```

### Scenario preference

Key:

```text
care-dashboard.scenario.v1
```

Exact schema:

```text
{
  scenarioId: "baseline"
}
```

Persistence behavior:

- Unknown fields are rejected.
- Missing fields are rejected.
- Unsupported values are rejected.
- Malformed JSON is removed.
- Values larger than 2,048 characters are removed.
- Storage exceptions fall back safely.
- Profiles, fallback data, credentials, incidents, diagnostics, alerts, snapshots, and telemetry are prohibited.
- Cleanup removes only the two application-owned keys.

The in-memory session is intentionally not persisted.

## 13. Limits and Timing Contracts

| Contract | Value |
| --- | ---: |
| Fixed dependencies | 3 |
| Maximum profiles | 100 |
| Maximum identifier length | 128 characters |
| Maximum alerts | 50 |
| Maximum incidents/timeline records | 50 |
| Maximum telemetry samples | 50 |
| Primary circuit failure threshold | 3 consecutive failures |
| Poll interval | 30,000 ms |
| Primary recovery probe delay | 300,000 ms |
| Fallback TTL | 14,400,000 ms |
| Fallback read target | Less than 500 ms |
| Subscriber presentation target | Less than 3,000 ms |
| Maximum persisted value length | 2,048 characters |
| Telemetry visualization points | 12 |

Bounded repositories retain the newest records and evict the oldest records when limits are exceeded.

## 14. Accessibility and Responsive Contracts

The UI uses semantic headings, forms, tables, lists, status regions, alerts, and alert dialogs.

Required behavior includes:

- A skip link to `#main-content`.
- Keyboard-operable login/signup tabs.
- Keyboard-operable native form controls.
- Error summaries associated with invalid fields.
- Focus movement to validation and confirmation controls.
- Escape handling for reset confirmation.
- Text and symbols in status badges so state is not conveyed by color alone.
- Polite recovery announcements.
- Assertive fallback activation and expiry announcements.
- Reduced-motion support.
- Dark-mode presentation support.
- Touch targets with a minimum height of 2.75rem.
- No horizontal overflow at supported desktop, tablet, and mobile widths.

The dependency health table remains semantic while rows render as card-like blocks below the `md` breakpoint and as table rows at larger widths.

## 15. Testing Architecture

### 15.1 Unit and component tests

Vitest and React Testing Library verify:

- Domain validation and immutable models.
- Dependency and circuit transitions.
- Exact fallback TTL boundaries.
- Stale timer and stale transition handling.
- Repository limits and idempotency.
- Privacy masking and prohibited-field detection.
- Session validation and credential non-retention.
- Lifecycle contract validation.
- Clinical and SRE user behavior.
- Keyboard interaction.
- Accessibility with `jest-axe`.
- Absence of network access.

The test setup blocks unmocked `fetch`, `XMLHttpRequest`, and `WebSocket` construction.

### 15.2 Browser acceptance tests

Playwright verifies complete user journeys across desktop, tablet, and mobile projects:

- Clinical demo account entry and synthetic profile request.
- SRE fallback activation.
- Primary circuit opening.
- Alert acknowledgement.
- Ordered local recovery.
- Guarded deep links and refresh behavior.
- Keyboard-only auth selection and account entry.
- Responsive table behavior.
- Absence of horizontal overflow.
- Same-origin static network activity only.
- Fallback and recovery presentation within the three-second target.

## 16. Low-Level Design Traceability

### SCRUM-1385 — Static browser-local demo and role journeys

Implemented by:

- `src/main.jsx`
- `src/App.jsx`
- `src/routing/router.jsx`
- `src/routing/RouteGuard.jsx`
- `src/pages/AuthView.jsx`
- `src/components/auth/MockAuthForm.jsx`
- `src/components/auth/RoleSelector.jsx`
- `src/context/SessionContext.jsx`
- `src/hooks/useMockSession.js`
- `src/session/sessionReducer.js`
- `src/fixtures/demoAccounts.js`
- `src/components/layout/AppShell.jsx`
- `vercel.json`
- `vite.config.js`

Contract coverage:

- Static SPA deployment.
- Single router ownership.
- Browser-memory-only session.
- Login and signup presentation.
- Fixed clinical and SRE demo accounts.
- Role-specific navigation.
- Safe deep-link redirects.
- No credential persistence or transmission.
- Explicit non-security-boundary messaging.

### SCRUM-1386 — Resilience lifecycle, failover, fallback, and recovery

Implemented by:

- `src/contracts/ResilienceLifecycleContract.js`
- `src/adapters/createResilienceLifecycleAdapter.js`
- `src/adapters/DependencyAdapter.js`
- `src/context/DashboardContext.jsx`
- `src/domain/StateMachine.js`
- `src/domain/model.js`
- `src/domain/constants.js`
- `src/engine/ResilienceEngine.js`
- `src/engine/ResilienceLifecycleHooks.js`
- `src/hooks/usePollingLifecycle.js`
- `src/repositories/FallbackRepository.js`
- `src/repositories/IncidentRepository.js`
- `src/repositories/TelemetryRepository.js`
- `src/pages/ClinicalDashboard.jsx`
- `src/pages/SreDashboard.jsx`
- `src/components/sre/DemoControls.jsx`

Contract coverage:

- Exact lifecycle command schemas.
- Three fixed dependencies.
- Deterministic health outcomes.
- Three-failure primary circuit threshold.
- Primary-to-secondary failover.
- Browser-local synthetic fallback.
- Four-hour fallback expiry.
- Mock alerts and incidents.
- Alert acknowledgement.
- Ordered `OPEN -> HALF_OPEN -> CLOSED` recovery.
- Bounded telemetry and represented polling.
- Immutable snapshot publication.
- Reset and session-clear cleanup.

### SCRUM-1392 — Privacy, accessibility, observability boundaries, and validation

Implemented by:

- `src/utils/privacy.js`
- `src/selectors/PrivacySelectors.js`
- `src/selectors/ViewModelSelectors.js`
- `src/services/privacyLogger.js`
- `src/storage/preferencesStore.js`
- `src/components/shared/ErrorBoundary.jsx`
- `src/components/shared/DemoNotice.jsx`
- `src/components/shared/LiveRegion.jsx`
- `src/components/shared/StatusBadge.jsx`
- `src/components/clinical/PatientProfileCard.jsx`
- `src/components/clinical/FallbackStatusBanner.jsx`
- `src/components/sre/AlertList.jsx`
- `src/components/sre/IncidentList.jsx`
- `src/components/sre/TelemetryPanel.jsx`
- `src/components/sre/DependencyHealthTable.jsx`
- `src/index.css`
- Unit, component, accessibility, and browser acceptance tests

Contract coverage:

- Synthetic fixture validation.
- Masked identifiers and accounts.
- Clinical and SRE field allowlists.
- Diagnostic sanitization.
- Prohibited persistence and logging fields.
- Development-only privacy logger.
- Privacy-safe error containment.
- Explicit mock integration labels.
- No external network activity.
- Bounded records.
- Accessible live announcements and controls.
- Responsive desktop, tablet, and mobile layouts.

## 17. Architectural Invariants

Changes to the application must preserve these invariants:

1. The application remains deployable as static files.
2. The router has exactly one browser-history owner.
3. Operational actions do not perform network I/O.
4. Sessions, profiles, fallback data, alerts, incidents, and telemetry are not persisted.
5. Role selection remains presentation metadata, not a security claim.
6. Exactly three fixed dependency records exist in every valid snapshot.
7. Public lifecycle commands use exact allowlisted schemas.
8. Snapshots and repository records remain validated and immutable.
9. Primary recovery follows `OPEN -> HALF_OPEN -> CLOSED`.
10. Fallback expiry is authoritative at `now >= expiresAt`.
11. Stale events and stale timer revisions cannot modify current state.
12. Clinical views receive only approved masked profile fields.
13. SRE views never receive profile or fallback payloads.
14. Diagnostics remain in the `mock-record-MOCK-####` format.
15. Alerts, incidents, and telemetry remain bounded to the newest 50 records.
16. PagerDuty, Slack, authentication, monitoring, and dependency integrations remain explicit mocks.
17. Expected failures return privacy-safe result objects.
18. Unexpected render failures do not expose raw exception details.
19. Keyboard, live-region, responsive, reduced-motion, and non-color status behavior remain supported.
20. Automated tests continue to reject unintended network access.