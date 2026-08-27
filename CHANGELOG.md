# Changelog

All notable changes to the Care Dashboard Resilience Demo are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-27

### Added

- Static, browser-only React dashboard built with Vite, React Router, and Tailwind CSS.
- Browser-memory-only mock login and signup flows for care team and SRE presentation roles.
- Fixed synthetic demo accounts with masked session labels and no credential retention, persistence, or transmission.
- Navigation guards for session-aware and role-aligned clinical and SRE routes.
- Three deterministic mock dependencies:
  - Primary profile service.
  - Secondary profile service.
  - Context eligibility service.
- Local dependency simulations for healthy, degraded, timeout, invalid-payload, and failed responses.
- Primary circuit breaker behavior that opens after three consecutive failures.
- Deterministic primary-to-secondary profile failover.
- In-memory synthetic fallback activation when primary and secondary profile sources are unavailable.
- Four-hour fallback lifetime with authoritative expiry, timer revision checks, and stale-callback protection.
- Ordered primary recovery through `OPEN -> HALF_OPEN -> CLOSED`.
- Browser-local mock PagerDuty and Slack alert records with explicit non-integration notices.
- Alert acknowledgement and bounded incident lifecycle timelines.
- Bounded mock telemetry with represented polling while the SRE dashboard is active and visible.
- Clinical dashboard for synthetic profile availability, masked profile fields, source status, context eligibility, fallback activation, expiry, and recovery.
- SRE dashboard for dependency health, scenario controls, telemetry, alerts, incident timelines, fallback operations, and recovery.
- Deterministic baseline, degraded, failover, and fallback-active scenario presets.
- Shared immutable resilience snapshots and exact-schema lifecycle commands.
- Privacy-safe command errors and render-error containment.
- Synthetic profile fixtures limited to `MOCK-####` identifiers, masked account numbers, and approved display fields.
- Separate clinical and SRE privacy projections that prevent profile and fallback payloads from reaching operational views.
- Diagnostic sanitization using the `mock-record-MOCK-####` format.
- Development-only allowlisted structured logging.
- Exact-schema persistence for non-sensitive UI preferences and the baseline scenario selection only.
- Persistent notices that the application uses synthetic browser-local data and is not for clinical or production use.
- Accessible semantic forms, headings, tables, status regions, alerts, alert dialogs, keyboard controls, skip links, and live announcements.
- Non-color status indicators, reduced-motion behavior, dark-mode styles, minimum touch targets, and responsive layouts.
- Desktop, tablet, and mobile dependency-table presentation without horizontal overflow.
- Unit, component, accessibility, privacy, lifecycle, repository, session, and network-boundary test coverage.
- Playwright acceptance coverage for clinical and SRE workflows, guarded routes, refresh behavior, keyboard navigation, responsive layouts, and static-only network activity.
- Static Vercel deployment configuration with SPA route rewriting.
- Optional public build metadata through `VITE_BUILD_LABEL`.
- Deployment, verification, rollback, cache, and CI/CD guidance.

### Security and Privacy

- No clinical systems, identity providers, monitoring platforms, PagerDuty, Slack, or other external services are contacted.
- No application API, database, serverless function, edge function, service worker, or server-side runtime is included.
- Sessions, credentials, profiles, fallback records, alerts, incidents, telemetry, diagnostics, and snapshots are not persisted.
- Role selection is presentation metadata only and is not authentication, authorization, or a security boundary.
- Automated tests block unintended `fetch`, `XMLHttpRequest`, and `WebSocket` access.
- Browser acceptance tests permit only same-origin static `GET` requests.