# Care Dashboard Resilience Demo Deployment Guide

## 1. Deployment Model

The Care Dashboard Resilience Demo is a static, client-side React application built with Vite.

The production artifact contains only:

- `index.html`
- Hashed JavaScript bundles
- Hashed CSS bundles
- Static images and fonts

The application does not require or support:

- An application server
- API routes
- Server-side rendering
- Serverless or edge functions
- A database
- A service worker
- Runtime secrets
- External clinical, identity, monitoring, alerting, or incident-management integrations

All sessions and resilience activity remain in browser memory. Deployments must preserve the browser-local and static-only boundaries defined in `ARCHITECTURE.md`.

## 2. Prerequisites

Use:

- Node.js 20 or later
- npm with the checked-in `package-lock.json`
- A static host with single-page application fallback support
- Playwright browser dependencies when running browser acceptance tests

Confirm the installed versions:

```sh
node --version
npm --version
```

Install the exact locked dependencies:

```sh
npm ci
```

Do not replace `npm ci` with an unlocked dependency installation in CI or release workflows.

## 3. Local Verification

### 3.1 Development server

Start the Vite development server:

```sh
npm run dev
```

The development server is intended for local development only and is not a production deployment target.

### 3.2 Required validation

Run the static analysis, unit, component, and production build checks:

```sh
npm run lint
npm test
npm run build
```

A successful production build writes the static artifact to:

```text
dist/
```

The build must not produce API handlers, serverless functions, edge functions, or server runtime entry points.

### 3.3 Production preview

Serve the generated artifact through Vite Preview:

```sh
npm run preview -- --host 127.0.0.1 --port 4173
```

Verify the entry route:

```text
http://127.0.0.1:4173/
```

Also verify direct SPA routes:

```text
http://127.0.0.1:4173/clinical
http://127.0.0.1:4173/sre
http://127.0.0.1:4173/signup
```

Protected routes should load the static application and redirect to the demo entry view when no in-memory session exists. They must not return a host-level 404.

### 3.4 Browser acceptance tests

Install the required Playwright browser if it is not already available:

```sh
npx playwright install chromium
```

Run the browser acceptance suite:

```sh
npm run browser-test
```

The Playwright configuration:

1. Builds the production application.
2. Starts Vite Preview on `127.0.0.1:4173`.
3. Runs desktop, tablet, and mobile projects.
4. Verifies SPA route behavior.
5. Verifies responsive behavior and absence of horizontal overflow.
6. Rejects non-static browser requests and WebSocket connections.
7. Exercises clinical and SRE browser-local workflows.

A release must not proceed if the browser suite detects fetch, XHR, event-stream, WebSocket, mutation, cross-origin, or other non-static application traffic.

## 4. Build Configuration

The checked-in Vite configuration defines:

```text
Application type: SPA
Base path: /
Output directory: dist
Static asset directory: dist/assets
JavaScript target: ES2020
Source maps: disabled
Asset names: content-hashed
```

Build the production artifact with:

```sh
npm run build
```

Only the contents of `dist/` should be published.

The application assumes deployment at the origin root because Vite is configured with:

```text
base: /
```

Deploying under a subdirectory requires coordinated changes to the Vite base path, router behavior, and host rewrite rules. A subdirectory deployment should not be attempted as an environment-only change.

## 5. Environment Variables and Build Metadata

The only supported environment variable is:

```text
VITE_BUILD_LABEL
```

It is optional, non-secret build metadata displayed in the application footer.

Example:

```sh
VITE_BUILD_LABEL="preview-2026-08-27.1" npm run build
```

Leave it empty to omit the build label:

```sh
VITE_BUILD_LABEL= npm run build
```

Suitable values include:

- A release identifier
- A short commit identifier
- A CI build number
- A preview label

Example:

```text
release-2026-08-27
```

All `VITE_*` variables are compiled into the browser bundle and are visible to users. Never place any of the following in `VITE_BUILD_LABEL` or another `VITE_*` variable:

- Passwords
- Tokens
- API keys
- Service credentials
- Endpoint credentials
- Patient or account data
- Private incident details
- Internal diagnostic payloads

The application intentionally does not support endpoint URLs, integration keys, authentication configuration, or monitoring credentials.

Environment variables are evaluated at build time, not runtime. Changing a Vercel environment variable requires a new build and deployment. Promoting an existing deployment preserves the metadata compiled into that deployment.

## 6. Vercel Deployment

### 6.1 Project settings

Configure the Vercel project with:

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

- Serverless functions
- Edge functions
- API routes
- Middleware
- Runtime secrets
- External service integrations

If a build label is desired, define `VITE_BUILD_LABEL` separately for the appropriate Vercel Preview or Production environment. Treat its value as public.

### 6.2 SPA rewrite

The checked-in `vercel.json` contains the required SPA fallback:

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

This allows direct requests and refreshes for routes such as `/clinical`, `/sre`, and `/signup` to load `index.html`, after which React Router handles the route in the browser.

Do not remove the rewrite unless the replacement hosting configuration provides equivalent SPA fallback behavior.

Static files must continue to be served normally. The fallback must not redirect users to a different origin or copy attempted paths into query parameters, hashes, or client navigation state.

### 6.3 Preview deployment

For a pull request or release candidate:

1. Run all CI/CD gates.
2. Build from the locked dependency graph.
3. Create a Vercel Preview deployment.
4. Record the immutable preview deployment URL.
5. Run smoke and browser acceptance checks against the preview.
6. Confirm direct navigation to `/clinical`, `/sre`, and `/signup`.
7. Confirm protected routes return to `/` after refresh because sessions are not persisted.
8. Confirm only same-origin static requests are emitted.
9. Confirm the displayed build label matches the intended public metadata, if configured.

Preview and production deployments must use the same static architecture and rewrite contract.

### 6.4 Promotion to production

Promote only an already-verified deployment artifact when the release process supports immutable promotion.

Before promotion, verify:

- The source revision is approved.
- CI/CD gates passed for that revision.
- The preview deployment passed smoke checks.
- The SPA rewrite is active.
- No runtime function was introduced.
- No secret or endpoint configuration was added.
- The build label is appropriate for public display.
- Clinical and SRE workflows use synthetic browser-local data only.

After promotion:

1. Open the production root route.
2. Open a protected route directly in a new browser session.
3. Refresh a protected route.
4. Complete one clinical synthetic profile request.
5. Complete one SRE fallback and recovery flow.
6. Confirm the browser network log contains only same-origin static `GET` requests.
7. Confirm there are no WebSocket, API, analytics, or telemetry transmissions.

## 7. Rollback

Vercel deployments are immutable. Roll back by promoting a previously verified production deployment through the Vercel dashboard or the organization’s approved deployment tooling.

A rollback should:

1. Select the last known-good deployment.
2. Confirm its source revision and build label.
3. Promote that deployment without rebuilding it.
4. Re-run the production smoke checks.
5. Verify direct SPA routes and refresh behavior.
6. Confirm the static-only network boundary.

Avoid rollback by source-only reversal followed by an unverified rebuild when an immutable known-good deployment is available.

Application state does not require migration during rollback because:

- Sessions are held only in browser memory.
- Fallback records are held only in browser memory.
- Alerts, incidents, and telemetry are held only in browser memory.
- No application database exists.
- No operational application state is persisted between page loads.

Users with an already-open page may continue running the previous JavaScript bundle until they reload. If an urgent rollback is performed, communicate that users should reload the page to receive the restored artifact.

## 8. Cache Considerations

Vite emits content-hashed JavaScript and CSS filenames. These assets may be cached for a long duration because a content change produces a new URL.

Recommended cache behavior:

| Resource | Recommended behavior |
| --- | --- |
| `/index.html` | Revalidate or use a short cache lifetime |
| `/assets/*` hashed files | Long-lived immutable cache |
| Other versioned static assets | Long-lived cache when filenames change with content |
| SPA route responses | Follow the `index.html` revalidation policy |

Do not cache `index.html` indefinitely. A stale HTML document may reference assets from an older release and delay promotion or rollback visibility.

Deployment cleanup must not remove assets still referenced by an active immutable deployment. Vercel normally handles deployment assets atomically.

The application does not install a service worker, so there is no application-managed offline cache to invalidate. Do not add a service worker or runtime caching layer without an architecture review because it could alter fallback expiry, rollback, and static network assumptions.

## 9. Static-Host Deployment Outside Vercel

Another static host may serve the application if it provides all of the following:

1. Publish `dist/` as the site root.
2. Serve existing static assets directly.
3. Return `index.html` for unknown application routes.
4. Preserve HTTPS and the original same-origin URL.
5. Avoid injecting analytics, monitoring, authentication, or external scripts.
6. Avoid adding API proxies, runtime functions, or service workers.
7. Apply suitable cache policies for HTML and hashed assets.

Equivalent fallback behavior is conceptually:

```text
If a requested static file exists:
    serve the file
Otherwise:
    serve /index.html with a successful HTML response
```

A redirect from `/clinical` to `/index.html` is not equivalent because it changes the browser URL. The host should rewrite internally while retaining the requested client-side route.

## 10. No-Runtime Constraints

Every deployment must preserve these constraints:

- The application runs entirely in the browser.
- Operational actions do not perform network I/O.
- Role selection is presentation metadata, not authentication or authorization.
- Sessions are not persisted.
- Profiles and fallback payloads are not persisted.
- Alerts, incidents, telemetry, and snapshots are not persisted.
- No clinical system is contacted.
- No identity provider is contacted.
- No PagerDuty or Slack event is transmitted.
- No Prometheus, Grafana, analytics, or monitoring data is transmitted.
- No runtime endpoint configuration is supported.
- No runtime secret is required.
- No server-side logs contain application records.
- No service worker caches operational state.
- Full page refreshes begin with a new in-memory session state.

The only permitted browser storage records are the exact UI preference and baseline scenario schemas documented in `ARCHITECTURE.md`.

## 11. CI/CD Gates

A release pipeline should use Node.js 20 or later and run the following gates in order:

```sh
npm ci
npm run lint
npm test
npm run build
npm run browser-test
```

Recommended gate requirements are:

### Dependency gate

- `npm ci` succeeds using `package-lock.json`.
- The lockfile is not regenerated during deployment.
- Dependency audit or policy checks follow the organization’s release policy.
- No undeclared runtime package is installed.

### Static analysis gate

- ESLint completes without errors.
- React Hooks and accessibility rules pass.
- No unintended console logging is introduced.

### Unit and component gate

- Domain transition tests pass.
- Fallback TTL boundary tests pass.
- Privacy and persistence tests pass.
- Session credential non-retention tests pass.
- Accessibility tests pass.
- Network guards report no unmocked network access.

### Build gate

- `npm run build` exits successfully.
- `dist/index.html` exists.
- Hashed bundles exist under `dist/assets/`.
- No server or function artifact is produced.
- Source maps remain disabled unless explicitly approved.
- Build output contains no secret values.

### Browser acceptance gate

- Desktop, tablet, and mobile projects pass.
- Clinical and SRE journeys pass.
- Direct SPA routes load successfully.
- Refresh behavior returns safely to the entry view.
- Responsive tables and navigation remain usable.
- No horizontal overflow is detected.
- Fallback and recovery presentation meets the three-second target.
- Only same-origin static `GET` requests are observed.
- No WebSocket connection is opened.

### Deployment gate

- The preview URL is available over HTTPS.
- SPA rewrites are verified on the deployed host.
- The build label contains only approved public metadata.
- No runtime, serverless, edge, or external integration resource is attached.
- A known-good rollback deployment is identified before promotion.

## 12. Release Verification Checklist

### Before deployment

- [ ] Node.js 20 or later is in use.
- [ ] Dependencies were installed with `npm ci`.
- [ ] Lint passed.
- [ ] Unit and component tests passed.
- [ ] Production build passed.
- [ ] Browser acceptance tests passed.
- [ ] No secret was added to a `VITE_*` variable.
- [ ] No endpoint URL or integration credential was introduced.
- [ ] `vercel.json` still provides the SPA rewrite.
- [ ] The deployment output is `dist/`.

### Preview

- [ ] `/` loads the demo entry.
- [ ] `/signup` loads the signup presentation.
- [ ] `/clinical` loads the SPA and safely returns to `/` without a session.
- [ ] `/sre` loads the SPA and safely returns to `/` without a session.
- [ ] Clinical synthetic profile display works.
- [ ] SRE failover, fallback, acknowledgement, and recovery work.
- [ ] Refresh clears the in-memory session.
- [ ] Only same-origin static requests occur.
- [ ] No WebSocket is opened.
- [ ] No real clinical or operational integration is contacted.

### Production promotion

- [ ] The verified preview artifact or exact verified revision is promoted.
- [ ] The production build label is correct and non-sensitive.
- [ ] Production direct-route and refresh checks pass.
- [ ] Production network-boundary checks pass.
- [ ] The previous known-good deployment remains available for rollback.

## 13. Deployment Failure Guidance

If the root page fails to load:

1. Confirm `dist/index.html` was published.
2. Confirm the host output directory is `dist`.
3. Confirm static assets under `/assets/` return successful responses.
4. Confirm the deployment uses Node.js 20 or later during build.
5. Review build output without exposing environment values.

If direct routes return 404:

1. Confirm `vercel.json` is included in the deployment.
2. Confirm the SPA rewrite is active.
3. Confirm the host serves `index.html` without changing the requested URL.
4. Confirm the application is deployed at the origin root.

If a new deployment is not visible:

1. Reload the page.
2. Confirm `index.html` is not cached indefinitely.
3. Confirm the expected immutable deployment is assigned to the production domain.
4. Confirm the displayed build label matches the deployed artifact.

If unexpected network activity appears:

1. Stop promotion immediately.
2. Inspect the browser network initiator.
3. Remove any injected analytics, external script, SDK, API call, or runtime integration.
4. Re-run unit and browser network-boundary tests.
5. Deploy a new verified static artifact or roll back to the last known-good deployment.

If production behavior is degraded after promotion:

1. Promote the last known-good immutable Vercel deployment.
2. Ask users to reload the page.
3. Re-run direct-route, clinical, SRE, and network-boundary smoke checks.
4. Investigate the failed release without using production patient or operational data.