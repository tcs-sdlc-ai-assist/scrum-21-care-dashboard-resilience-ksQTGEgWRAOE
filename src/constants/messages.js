export const ROLE_LABELS = Object.freeze({
  CARE_TEAM: 'Care team',
  SRE: 'Site reliability engineer',
  clinical: 'Care team',
  sre: 'Site reliability engineer',
});

export const STATUS_LABELS = Object.freeze({
  HEALTHY: 'Healthy',
  DEGRADED: 'Degraded',
  TIMEOUT: 'Timed out',
  INVALID_PAYLOAD: 'Invalid payload',
  FAILED: 'Failed',
  CLOSED: 'Closed',
  OPEN: 'Open',
  HALF_OPEN: 'Half-open',
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  FALLBACK: 'Fallback',
  NONE: 'Unavailable',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
  ACTIVE: 'Active',
  RECOVERED: 'Recovered',
});

export const STATUS_DESCRIPTIONS = Object.freeze({
  HEALTHY: 'The mock dependency is responding normally.',
  DEGRADED: 'The mock dependency is responding with reduced performance.',
  TIMEOUT: 'The mock dependency did not respond within the demo time limit.',
  INVALID_PAYLOAD:
    'The mock dependency returned data that did not pass local validation.',
  FAILED: 'The mock dependency is unavailable.',
  CLOSED: 'Requests can use this mock dependency.',
  OPEN: 'Requests are temporarily blocked from this mock dependency.',
  HALF_OPEN: 'A local recovery probe can test this mock dependency.',
  PRIMARY: 'Synthetic profile data came from the primary mock service.',
  SECONDARY: 'Synthetic profile data came from the secondary mock service.',
  FALLBACK: 'Synthetic profile data came from browser-local fallback storage.',
  NONE: 'No synthetic profile source is currently available.',
  ACTIVE: 'The mock incident is active.',
  RECOVERED: 'The mock incident has recovered.',
});

export const MOCK_BOUNDARY_MESSAGES = Object.freeze({
  badge: 'Browser-local demo',
  shortNotice: 'Mock data only. Not for clinical or production use.',
  fullNotice:
    'This browser-local resilience demonstration uses synthetic data and does not connect to clinical systems, monitoring services, or external integrations.',
  authentication:
    'Demo sign-in is simulated in this browser. It does not authenticate or authorize access to any system.',
  syntheticData:
    'All profiles, identifiers, alerts, incidents, and telemetry are synthetic.',
  noNetwork:
    'Demo actions run locally and do not send requests to external services.',
  notSecurityBoundary:
    'Role selection changes the demo view only and is not a security boundary.',
  notClinicalAdvice:
    'This demonstration does not provide clinical guidance or support care decisions.',
});

export const APP_MESSAGES = Object.freeze({
  name: 'Care Dashboard',
  title: 'Care Dashboard resilience demo',
  skipToContent: 'Skip to main content',
  loading: 'Loading the browser-local demo…',
  ready: 'Demo ready',
  unavailable: 'The browser-local demo is unavailable.',
  reload: 'Reload demo',
  retry: 'Try again',
  close: 'Close',
  dismiss: 'Dismiss',
  cancel: 'Cancel',
  save: 'Save',
  back: 'Back',
  lastUpdated: 'Last updated',
  buildLabel: 'Build',
  unexpectedErrorTitle: 'The demo could not be displayed',
  unexpectedErrorBody:
    'Reload the page to restore the synthetic baseline scenario.',
});

export const AUTH_MESSAGES = Object.freeze({
  title: 'Enter the resilience demo',
  subtitle:
    'Choose a role to explore synthetic care and reliability experiences.',
  loginTab: 'Demo login',
  signupTab: 'Demo signup',
  emailLabel: 'Email',
  emailHint:
    'Used only to create a masked in-memory demo label. It is not transmitted or stored.',
  passwordLabel: 'Password',
  passwordHint:
    'Enter 8 to 128 characters. Demo passwords are not transmitted or stored.',
  roleLabel: 'Demo role',
  roleHint: 'Role selection changes the visible demo experience only.',
  loginAction: 'Log in to demo',
  signupAction: 'Create demo session',
  useCareTeamAccount: 'Use care team demo account',
  useSreAccount: 'Use SRE demo account',
  logoutAction: 'Log out of demo',
  logoutComplete: 'The in-memory demo session has been cleared.',
  careTeamDescription:
    'Review a synthetic profile, its current source, and fallback status.',
  sreDescription:
    'Review mock dependency health, telemetry, alerts, and incidents.',
});

export const VALIDATION_MESSAGES = Object.freeze({
  summaryTitle: 'Check the highlighted fields',
  emailRequired: 'Enter an email address.',
  emailInvalid: 'Enter an email address in a valid format.',
  emailTooLong: 'Email must be 254 characters or fewer.',
  passwordRequired: 'Enter a password.',
  passwordTooShort: 'Password must contain at least 8 characters.',
  passwordTooLong: 'Password must contain no more than 128 characters.',
  roleRequired: 'Choose a demo role.',
  invalidRole: 'Choose a supported demo role.',
  invalidCommand: 'This demo action is not supported.',
  dependencyRequired: 'Choose a mock dependency.',
  outcomeRequired: 'Choose a mock response condition.',
});

export const CLINICAL_MESSAGES = Object.freeze({
  dashboardTitle: 'Care team dashboard',
  dashboardDescription:
    'Review synthetic profile availability and browser-local resilience status.',
  profileTitle: 'Synthetic patient profile',
  profileIdentifierLabel: 'Mock patient identifier',
  accountNumberLabel: 'Masked account number',
  sourceLabel: 'Profile source',
  generatedAtLabel: 'Generated at',
  requestProfile: 'Request synthetic profile',
  profileLoading: 'Loading the synthetic profile…',
  profileUnavailableTitle: 'Synthetic profile unavailable',
  profileUnavailableBody:
    'No valid mock source or browser-local fallback is currently available.',
  noProfileTitle: 'No synthetic profile requested',
  noProfileBody: 'Request a synthetic profile to begin the demonstration.',
  fallbackTitle: 'Browser-local fallback active',
  fallbackBody:
    'The primary and secondary mock sources are unavailable. A time-limited synthetic fallback is being shown.',
  fallbackExpiryLabel: 'Fallback expires',
  fallbackExpired:
    'The browser-local fallback has expired and can no longer be displayed.',
  contextTitle: 'Context eligibility',
  contextAvailable: 'Mock context eligibility is available.',
  contextUnavailable: 'Mock context eligibility is unavailable.',
});

export const SRE_MESSAGES = Object.freeze({
  dashboardTitle: 'SRE dashboard',
  dashboardDescription:
    'Review browser-local mock health, telemetry, alerts, incidents, and recovery state.',
  dependencyHealthTitle: 'Mock dependency health',
  dependencyName: 'Dependency',
  healthStatus: 'Health status',
  responseTime: 'Response time',
  failureCount: 'Failure count',
  consecutiveFailures: 'Consecutive failures',
  circuitState: 'Circuit state',
  dataSource: 'Data source',
  lastChecked: 'Last checked',
  probeDue: 'Recovery probe due',
  telemetryTitle: 'Mock telemetry',
  telemetryNotice: 'Demo telemetry — not live Prometheus or Grafana data.',
  incidentActivity: 'Incident activity',
  alertsTitle: 'Mock alerts',
  incidentsTitle: 'Mock incidents',
  noAlertsTitle: 'No mock alerts',
  noAlertsBody: 'Alerts generated by the local scenario will appear here.',
  noIncidentsTitle: 'No mock incidents',
  noIncidentsBody: 'Incidents generated by the local scenario will appear here.',
  noTelemetryTitle: 'No mock telemetry',
  noTelemetryBody:
    'Telemetry generated by browser-local demo actions will appear here.',
  acknowledgeAlert: 'Acknowledge mock alert',
  alertAcknowledged: 'Mock alert acknowledged.',
  simulateRecovery: 'Simulate local recovery',
});

export const DEMO_MESSAGES = Object.freeze({
  controlsTitle: 'Demo controls',
  controlsDescription:
    'Change the browser-local scenario without contacting external services.',
  dependencyLabel: 'Mock dependency',
  responseConditionLabel: 'Mock response condition',
  simulateHealth: 'Apply mock health response',
  simulateRecovery: 'Simulate recovery',
  requestProfile: 'Request synthetic profile',
  reset: 'Reset demo',
  resetConfirmation:
    'Reset the browser-local scenario and clear the current demo session?',
  resetComplete: 'The synthetic baseline scenario has been restored.',
  resetFailed:
    'The demo could not be reset. Reload the page to restore the baseline scenario.',
  actionComplete: 'The browser-local demo action completed.',
  actionFailed:
    'The browser-local demo action could not be completed. Review the selected options and try again.',
  normalCondition: 'Normal response',
  degradedCondition: 'Degraded response',
  timeoutCondition: 'Timeout',
  invalidPayloadCondition: 'Invalid payload',
  failureCondition: 'Failure',
});

export const INTEGRATION_MESSAGES = Object.freeze({
  pagerDuty: 'Mock PagerDuty',
  slack: 'Mock Slack',
  pagerDutyHint:
    'Pipeline-aligned mock only. No PagerDuty event is transmitted.',
  slackHint: 'Pipeline-aligned mock only. No Slack message is transmitted.',
  telemetryHint:
    'Browser-local mock telemetry. No monitoring platform is connected.',
  lifecycleHint:
    'State transitions are simulated locally by the resilience demo.',
});

export const ERROR_MESSAGES = Object.freeze({
  VALIDATION_ERROR:
    'Check the highlighted fields and correct the demo input.',
  SESSION_UNAVAILABLE:
    'The demo session could not be created. Review the fields and try again.',
  LIFECYCLE_UNAVAILABLE:
    'The browser-local resilience lifecycle is unavailable. Reload the demo to try again.',
  INVALID_COMMAND:
    'That action is not available for the current browser-local scenario.',
  SCENARIO_RESET_FAILED:
    'The scenario could not be reset. Reload the page to restore the synthetic baseline.',
  PROFILE_UNAVAILABLE:
    'Synthetic profile data is unavailable from all mock sources.',
  NOT_FOUND: 'The requested browser-local record could not be found.',
  ENGINE_STOPPED:
    'The resilience demo has stopped. Reload the page to start again.',
  UNKNOWN:
    'An unexpected demo error occurred. Reload the page to restore the synthetic baseline.',
});

export const ACCESSIBILITY_MESSAGES = Object.freeze({
  statusRegionLabel: 'Demo status updates',
  criticalRegionLabel: 'Critical demo updates',
  navigationLabel: 'Primary navigation',
  accountMenuLabel: 'Demo account menu',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  tableCaption: 'Current health of the three fixed mock dependencies',
  newFallbackAnnouncement:
    'Critical demo update: browser-local synthetic fallback is active.',
  recoveryAnnouncement: 'Demo update: the mock dependency has recovered.',
  reducedMotionLabel: 'Reduce motion',
  comfortableDensityLabel: 'Comfortable density',
  compactDensityLabel: 'Compact density',
});

export const EMPTY_STATE_MESSAGES = Object.freeze({
  title: 'Nothing to display',
  body: 'Browser-local demo activity will appear here.',
});

export const MESSAGES = Object.freeze({
  app: APP_MESSAGES,
  auth: AUTH_MESSAGES,
  roles: ROLE_LABELS,
  statuses: STATUS_LABELS,
  statusDescriptions: STATUS_DESCRIPTIONS,
  mockBoundary: MOCK_BOUNDARY_MESSAGES,
  validation: VALIDATION_MESSAGES,
  clinical: CLINICAL_MESSAGES,
  sre: SRE_MESSAGES,
  demo: DEMO_MESSAGES,
  integrations: INTEGRATION_MESSAGES,
  errors: ERROR_MESSAGES,
  accessibility: ACCESSIBILITY_MESSAGES,
  emptyState: EMPTY_STATE_MESSAGES,
});

export default MESSAGES;