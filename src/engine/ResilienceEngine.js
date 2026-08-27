import {
  DEPENDENCY_ADAPTERS,
} from '../adapters/DependencyAdapter.js';
import {
  CIRCUIT_STATES,
  DEPENDENCY_IDS,
  FALLBACK_TTL_MS,
  HEALTH_STATES,
  POLL_INTERVAL_MS,
  PROFILE_SOURCES,
  RECOVERY_STATUSES,
  SEVERITIES,
} from '../domain/constants.js';
import {
  DOMAIN_ERROR_CODES,
  FallbackUnavailableError,
  isDomainError,
} from '../domain/errors.js';
import {
  applyOrderedRecovery,
  selectProfileSource,
  transition,
} from '../domain/StateMachine.js';
import {
  createCommandError,
  createCommandSuccess,
  createInitialSnapshot,
  createSnapshot,
  createTelemetrySample,
  isBoundedId,
  isDependencyId,
  isHealthStatus,
  isProfileId,
} from '../domain/model.js';
import { ACTIVE_PROFILE_ID, getProfileFixture } from '../fixtures/profiles.js';
import { FallbackRepository } from '../repositories/FallbackRepository.js';
import { IncidentRepository } from '../repositories/IncidentRepository.js';
import { TelemetryRepository } from '../repositories/TelemetryRepository.js';
import {
  ReferenceDateClock,
  scheduleAt,
} from '../utils/clock.js';

const FAILURE_STATUSES = Object.freeze([
  HEALTH_STATES.TIMEOUT,
  HEALTH_STATES.INVALID_PAYLOAD,
  HEALTH_STATES.FAILED,
]);

const VALIDATION_ERROR_MESSAGE = 'Command input is invalid';
const INVALID_COMMAND_MESSAGE =
  'Command is not available for the current scenario';
const UNKNOWN_ERROR_MESSAGE = 'An unexpected demo error occurred';

const ERROR_MESSAGES = Object.freeze({
  [DOMAIN_ERROR_CODES.VALIDATION_ERROR]: VALIDATION_ERROR_MESSAGE,
  [DOMAIN_ERROR_CODES.UNSUPPORTED_DEPENDENCY]:
    VALIDATION_ERROR_MESSAGE,
  [DOMAIN_ERROR_CODES.UNSUPPORTED_CONDITION]:
    VALIDATION_ERROR_MESSAGE,
  [DOMAIN_ERROR_CODES.STALE_TRANSITION]:
    'Transition is stale and was not applied',
  [DOMAIN_ERROR_CODES.STALE_TIMER]:
    'Fallback expiry timer is stale',
  [DOMAIN_ERROR_CODES.PROFILE_UNAVAILABLE]:
    'Synthetic profile data is unavailable',
  [DOMAIN_ERROR_CODES.NOT_FOUND]: 'Requested record was not found',
  [DOMAIN_ERROR_CODES.ENGINE_STOPPED]: 'Resilience engine is stopped',
  INVALID_COMMAND: INVALID_COMMAND_MESSAGE,
  UNKNOWN: UNKNOWN_ERROR_MESSAGE,
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} clock
 * @returns {{
 *   now: () => number,
 *   setTimeout: Function,
 *   clearTimeout: Function,
 *   setInterval: Function,
 *   clearInterval: Function
 * }}
 */
function requireClock(clock) {
  if (
    typeof clock !== 'object' ||
    clock === null ||
    typeof clock.now !== 'function' ||
    typeof clock.setTimeout !== 'function' ||
    typeof clock.clearTimeout !== 'function' ||
    typeof clock.setInterval !== 'function' ||
    typeof clock.clearInterval !== 'function'
  ) {
    throw new TypeError(
      'clock must provide now, setTimeout, clearTimeout, setInterval, and clearInterval methods',
    );
  }

  return clock;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {Record<string, unknown>}
 */
function requireInput(value, field) {
  if (!isPlainObject(value)) {
    const error = new TypeError(`${field} must be an object`);
    error.field = field;
    throw error;
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireDependencyId(value, field = 'dependencyId') {
  if (!isDependencyId(value)) {
    const error = new TypeError(
      'dependencyId must be a supported dependency',
    );
    error.field = field;
    throw error;
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireHealthStatus(value, field = 'status') {
  if (!isHealthStatus(value)) {
    const error = new TypeError(
      'status must be a supported health status',
    );
    error.field = field;
    throw error;
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireProfileId(value, field = 'profileId') {
  if (!isProfileId(value)) {
    const error = new TypeError(`${field} must match MOCK-####`);
    error.field = field;
    throw error;
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  if (!isBoundedId(value)) {
    const error = new TypeError(
      `${field} must be a non-empty privacy-safe identifier`,
    );
    error.field = field;
    throw error;
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    const error = new TypeError(
      `${field} must be a non-negative safe integer`,
    );
    error.field = field;
    throw error;
  }

  return value;
}

/**
 * @param {unknown} dependencies
 * @returns {ReadonlyArray<object>}
 */
function requireAdapters(dependencies) {
  if (!Array.isArray(dependencies) || dependencies.length !== 3) {
    throw new TypeError(
      'dependencies must contain exactly three adapters',
    );
  }

  const adapters = dependencies.map((adapter) => {
    if (
      typeof adapter !== 'object' ||
      adapter === null ||
      typeof adapter.check !== 'function'
    ) {
      throw new TypeError('each dependency adapter must provide check');
    }

    const dependencyId = adapter.dependencyId ?? adapter.id;

    if (!isDependencyId(dependencyId)) {
      throw new TypeError(
        'each dependency adapter must use a supported dependency',
      );
    }

    return adapter;
  });

  const adapterIds = new Set(
    adapters.map((adapter) => adapter.dependencyId ?? adapter.id),
  );

  if (
    adapterIds.size !== 3 ||
    !Object.values(DEPENDENCY_IDS).every((dependencyId) =>
      adapterIds.has(dependencyId),
    )
  ) {
    throw new TypeError(
      'dependencies must contain each fixed dependency exactly once',
    );
  }

  return Object.freeze([...adapters]);
}

/**
 * @param {unknown} repository
 * @param {ReadonlyArray<string>} methods
 * @param {string} name
 * @returns {object}
 */
function requireRepository(repository, methods, name) {
  if (
    typeof repository !== 'object' ||
    repository === null ||
    !methods.every((method) => typeof repository[method] === 'function')
  ) {
    throw new TypeError(`${name} does not implement its repository contract`);
  }

  return repository;
}

/**
 * @param {unknown} reducer
 * @returns {Function}
 */
function requireReducer(reducer) {
  if (typeof reducer !== 'function') {
    throw new TypeError('reducer must be a function');
  }

  return reducer;
}

/**
 * @param {unknown} callback
 * @returns {Function|null}
 */
function requireOptionalCallback(callback) {
  if (callback === undefined || callback === null) {
    return null;
  }

  if (typeof callback !== 'function') {
    throw new TypeError('onTelemetry must be a function');
  }

  return callback;
}

/**
 * Browser-local orchestration engine for deterministic resilience scenarios.
 * It owns only in-memory state and never performs network or persistence I/O.
 */
export class ResilienceEngine {
  /**
   * @param {{
   *   clock?: object,
   *   dependencies?: ReadonlyArray<object>,
   *   fallbackRepository?: FallbackRepository,
   *   incidentRepository?: IncidentRepository,
   *   telemetryRepository?: TelemetryRepository,
   *   reducer?: Function,
   *   onTelemetry?: Function
   * }} [options]
   */
  constructor(options = {}) {
    if (!isPlainObject(options)) {
      throw new TypeError('options must be an object');
    }

    this.clock = requireClock(
      options.clock ?? new ReferenceDateClock(),
    );
    this.dependencies = requireAdapters(
      options.dependencies ?? DEPENDENCY_ADAPTERS,
    );
    this.adaptersById = new Map(
      this.dependencies.map((adapter) => [
        adapter.dependencyId ?? adapter.id,
        adapter,
      ]),
    );
    this.fallbackRepository = requireRepository(
      options.fallbackRepository ?? new FallbackRepository(),
      ['put', 'getValid', 'getById', 'remove', 'expire', 'clear'],
      'fallbackRepository',
    );
    this.incidentRepository = requireRepository(
      options.incidentRepository ?? new IncidentRepository(),
      [
        'recordFailover',
        'recordFallbackActivation',
        'recordRecovery',
        'recordFallbackExpiry',
        'acknowledgeAlert',
        'getAlertById',
        'getTimeline',
        'getAlerts',
        'clear',
      ],
      'incidentRepository',
    );
    this.telemetryRepository = requireRepository(
      options.telemetryRepository ?? new TelemetryRepository(),
      ['append', 'getAll', 'clear'],
      'telemetryRepository',
    );
    this.reducer = requireReducer(options.reducer ?? transition);
    this.onTelemetry = requireOptionalCallback(options.onTelemetry);

    const now = requireTimestamp(this.clock.now(), 'clock.now()');

    this.state = createInitialSnapshot(now);
    this.activeProfileId = null;
    this.listeners = new Set();
    this.pollingHandle = null;
    this.cancelFallbackTimer = null;
    this.running = true;
    this.commandRunning = false;
    this.notificationPending = false;
    this.nextEventSequence = 1;
    this.nextAlertSequence = 1;
  }

  /**
   * Enables lifecycle timers. Starting an already running engine is a no-op.
   *
   * @returns {void}
   */
  start() {
    if (this.running) {
      this.reconcilePolling();
      this.scheduleCurrentFallback();
      return;
    }

    this.running = true;
    this.reconcilePolling();
    this.scheduleCurrentFallback();
  }

  /**
   * Stops polling and fallback timers. In-memory state is retained.
   *
   * @returns {void}
   */
  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.clearPolling();
    this.clearFallbackTimer();
  }

  /**
   * Subscribes to immutable state updates and immediately supplies the current
   * snapshot.
   *
   * @param {(snapshot: ReturnType<typeof createSnapshot>) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }

    this.listeners.add(listener);
    this.reconcilePolling();

    try {
      listener(this.state);
    } catch {
      // A consumer callback cannot interrupt engine lifecycle ownership.
    }

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.listeners.delete(listener);
      this.reconcilePolling();
    };
  }

  /**
   * Returns the current immutable resilience snapshot.
   *
   * @returns {ReturnType<typeof createSnapshot>}
   */
  getSnapshot() {
    return this.state;
  }

  /**
   * Applies one deterministic local health response.
   *
   * @param {unknown} input
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  simulateHealth(input) {
    return this.runCommand(() => {
      const value = requireInput(input, 'input');
      const dependencyId = requireDependencyId(value.dependencyId);
      const status = requireHealthStatus(value.status);
      const profileId =
        value.profileId === undefined
          ? ACTIVE_PROFILE_ID
          : requireProfileId(value.profileId);
      const now = this.captureNow();
      const eventId = this.createEventId();
      const currentDependency = this.getDependency(dependencyId);
      const previousCircuit = currentDependency.circuit;

      const adapter = this.adaptersById.get(dependencyId);
      const result = adapter.check(status);

      const transitionedState = this.reducer(this.state, {
        eventId,
        dependencyId,
        status: result.status,
        now,
        profileId,
        probe: false,
      });

      const dependency = transitionedState.dependencies.find(
        (item) => item.dependencyId === dependencyId,
      );

      if (
        dependencyId === DEPENDENCY_IDS.PROFILE_PRIMARY &&
        previousCircuit !== CIRCUIT_STATES.OPEN &&
        dependency.circuit === CIRCUIT_STATES.OPEN
      ) {
        this.incidentRepository.recordFailover({
          eventId,
          alertId: this.createAlertId(),
          dependencyId,
          profileId,
          occurredAt: now,
          circuit: dependency.circuit,
          dataSource:
            transitionedState.profileSource === PROFILE_SOURCES.NONE
              ? PROFILE_SOURCES.SECONDARY
              : transitionedState.profileSource,
          severity: SEVERITIES.HIGH,
        });
      }

      this.recordTelemetry({
        timestamp: now,
        dependencyId,
        status: dependency.status,
        responseTimeMs: result.latencyMs,
        failureCount: dependency.failureCount,
        circuit: dependency.circuit,
        dataSource: transitionedState.profileSource,
      });

      this.state = this.buildSnapshot({
        base: transitionedState,
        now,
        lastEventId: eventId,
      });
      this.queueNotification();

      return createCommandSuccess({
        ok: true,
        eventId,
        snapshot: this.state,
      });
    });
  }

  /**
   * Resolves a synthetic profile source and activates a browser-local fallback
   * when both mock profile dependencies are unavailable.
   *
   * @param {unknown} input
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  requestProfile(input) {
    return this.runCommand(() => {
      const value = requireInput(input, 'input');
      const profileId = requireProfileId(value.profileId);
      const now = this.captureNow();
      const primaryFixture = getProfileFixture(
        profileId,
        PROFILE_SOURCES.PRIMARY,
        now,
      );

      if (primaryFixture === null) {
        throw new FallbackUnavailableError();
      }

      if (
        this.activeProfileId !== null &&
        this.activeProfileId !== profileId
      ) {
        this.removeCurrentFallback();
      }

      const eventId = this.createEventId();
      const primary = this.getDependency(
        DEPENDENCY_IDS.PROFILE_PRIMARY,
      );
      const secondary = this.getDependency(
        DEPENDENCY_IDS.PROFILE_SECONDARY,
      );

      let source = PROFILE_SOURCES.NONE;
      let fallback = null;

      if (
        primary.status === HEALTH_STATES.HEALTHY &&
        primary.circuit === CIRCUIT_STATES.CLOSED
      ) {
        source = PROFILE_SOURCES.PRIMARY;
      } else if (
        secondary.status === HEALTH_STATES.HEALTHY &&
        secondary.circuit === CIRCUIT_STATES.CLOSED
      ) {
        source = PROFILE_SOURCES.SECONDARY;
      } else {
        fallback = this.fallbackRepository.getValid(profileId, now);

        if (fallback === null) {
          const fallbackProfile = getProfileFixture(
            profileId,
            PROFILE_SOURCES.FALLBACK,
            now,
          );

          if (fallbackProfile === null) {
            throw new FallbackUnavailableError();
          }

          fallback = this.fallbackRepository.put(
            profileId,
            fallbackProfile,
            now,
            FALLBACK_TTL_MS,
          );

          this.incidentRepository.recordFallbackActivation({
            eventId,
            alertId: this.createAlertId(),
            dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
            profileId,
            occurredAt: now,
            circuit: primary.circuit,
            severity: SEVERITIES.CRITICAL,
          });
        }

        source = PROFILE_SOURCES.FALLBACK;
      }

      this.activeProfileId = profileId;
      this.state = this.buildSnapshot({
        base: this.state,
        now,
        profileSource: source,
        fallback,
        lastEventId: eventId,
      });

      if (fallback !== null) {
        this.scheduleFallback(fallback);
      }

      this.queueNotification();

      return createCommandSuccess({
        ok: true,
        eventId,
        snapshot: this.state,
      });
    });
  }

  /**
   * Applies the ordered OPEN to HALF_OPEN to CLOSED primary recovery.
   *
   * @param {unknown} input
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  simulateRecovery(input) {
    return this.runCommand(() => {
      const value = requireInput(input, 'input');
      const dependencyId = requireDependencyId(value.dependencyId);
      const profileId = requireProfileId(value.profileId);

      if (dependencyId !== DEPENDENCY_IDS.PROFILE_PRIMARY) {
        return this.createErrorResult(
          'INVALID_COMMAND',
          INVALID_COMMAND_MESSAGE,
          'dependencyId',
        );
      }

      const currentDependency = this.getDependency(dependencyId);

      if (currentDependency.circuit !== CIRCUIT_STATES.OPEN) {
        return this.createErrorResult(
          'INVALID_COMMAND',
          INVALID_COMMAND_MESSAGE,
          'dependencyId',
        );
      }

      const now = this.captureNow();
      const halfOpenEventId = this.createEventId();
      const closedEventId = this.createEventId();
      const recovery = applyOrderedRecovery(this.state, {
        halfOpenEventId,
        closedEventId,
        dependencyId,
        profileId,
        now,
      });

      this.incidentRepository.recordRecovery({
        halfOpenEventId,
        closedEventId,
        dependencyId,
        profileId,
        occurredAt: now,
        severity: SEVERITIES.HIGH,
        dataSource: PROFILE_SOURCES.PRIMARY,
      });

      this.removeCurrentFallback();
      this.activeProfileId = profileId;

      const recoveredDependency =
        recovery.snapshot.dependencies.find(
          (dependency) => dependency.dependencyId === dependencyId,
        );

      this.recordTelemetry({
        timestamp: now,
        dependencyId,
        status: recoveredDependency.status,
        responseTimeMs: recoveredDependency.latencyMs,
        failureCount: recoveredDependency.failureCount,
        circuit: recoveredDependency.circuit,
        dataSource: PROFILE_SOURCES.PRIMARY,
      });

      this.state = this.buildSnapshot({
        base: recovery.snapshot,
        now,
        profileSource: PROFILE_SOURCES.PRIMARY,
        fallback: null,
        lastEventId: closedEventId,
      });
      this.queueNotification();

      return createCommandSuccess({
        ok: true,
        eventId: closedEventId,
        snapshot: this.state,
      });
    });
  }

  /**
   * Marks one existing local mock alert as acknowledged.
   *
   * @param {unknown} input
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  acknowledgeAlert(input) {
    return this.runCommand(() => {
      const value = requireInput(input, 'input');
      const alertId = requireId(value.alertId, 'alertId');

      if (this.incidentRepository.getAlertById(alertId) === null) {
        return this.createErrorResult(
          DOMAIN_ERROR_CODES.NOT_FOUND,
          ERROR_MESSAGES[DOMAIN_ERROR_CODES.NOT_FOUND],
          'alertId',
        );
      }

      this.incidentRepository.acknowledgeAlert(alertId);

      const now = this.captureNow();
      const eventId = this.createEventId();

      this.state = this.buildSnapshot({
        base: this.state,
        now,
        lastEventId: eventId,
      });
      this.queueNotification();

      return createCommandSuccess({
        ok: true,
        eventId,
        snapshot: this.state,
      });
    });
  }

  /**
   * Restores the synthetic baseline and clears every in-memory record.
   *
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  resetDemo() {
    return this.runCommand(() => {
      const now = this.captureNow();
      const eventId = this.createEventId();

      this.clearFallbackTimer();
      this.fallbackRepository.clear();
      this.incidentRepository.clear();
      this.telemetryRepository.clear();
      this.activeProfileId = null;

      const initialState = createInitialSnapshot(now);
      this.state = createSnapshot({
        ...initialState,
        lastEventId: eventId,
      });
      this.queueNotification();

      return createCommandSuccess({
        ok: true,
        eventId,
        snapshot: this.state,
      });
    });
  }

  /**
   * Expires the current fallback when its exact expiry boundary is reached.
   *
   * @param {unknown} [input]
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  expireFallback(input = {}) {
    return this.runCommand(() => {
      const value = requireInput(input, 'input');
      const fallback = this.state.fallback;

      if (fallback === null) {
        return this.createErrorResult(
          DOMAIN_ERROR_CODES.NOT_FOUND,
          ERROR_MESSAGES[DOMAIN_ERROR_CODES.NOT_FOUND],
          'fallbackId',
        );
      }

      const fallbackId =
        value.fallbackId === undefined
          ? fallback.id
          : requireId(value.fallbackId, 'fallbackId');

      if (fallbackId !== fallback.id) {
        return this.createErrorResult(
          DOMAIN_ERROR_CODES.NOT_FOUND,
          ERROR_MESSAGES[DOMAIN_ERROR_CODES.NOT_FOUND],
          'fallbackId',
        );
      }

      return this.applyFallbackExpiry(
        fallback.id,
        fallback.timerRevision,
      );
    });
  }

  /**
   * @param {() => object} operation
   * @returns {object}
   */
  runCommand(operation) {
    if (!this.running) {
      return this.createErrorResult(
        DOMAIN_ERROR_CODES.ENGINE_STOPPED,
        ERROR_MESSAGES[DOMAIN_ERROR_CODES.ENGINE_STOPPED],
      );
    }

    if (this.commandRunning) {
      return this.createErrorResult(
        'INVALID_COMMAND',
        INVALID_COMMAND_MESSAGE,
      );
    }

    this.commandRunning = true;

    let result;

    try {
      result = operation();
    } catch (error) {
      result = this.createErrorFromException(error);
    } finally {
      this.commandRunning = false;
      this.flushNotification();
    }

    return result;
  }

  /**
   * @param {unknown} error
   * @returns {ReturnType<typeof createCommandError>}
   */
  createErrorFromException(error) {
    if (isDomainError(error)) {
      const code =
        error.code === DOMAIN_ERROR_CODES.UNSUPPORTED_DEPENDENCY ||
        error.code === DOMAIN_ERROR_CODES.UNSUPPORTED_CONDITION
          ? DOMAIN_ERROR_CODES.VALIDATION_ERROR
          : error.code;

      return this.createErrorResult(
        code,
        ERROR_MESSAGES[code] ?? error.message,
        error.details?.field,
      );
    }

    if (error instanceof TypeError || error instanceof RangeError) {
      return this.createErrorResult(
        DOMAIN_ERROR_CODES.VALIDATION_ERROR,
        VALIDATION_ERROR_MESSAGE,
        error.field,
      );
    }

    return this.createErrorResult('UNKNOWN', UNKNOWN_ERROR_MESSAGE);
  }

  /**
   * @param {string} code
   * @param {string} message
   * @param {unknown} [field]
   * @returns {ReturnType<typeof createCommandError>}
   */
  createErrorResult(code, message, field) {
    const error = {
      code,
      message,
    };

    if (
      typeof field === 'string' &&
      /^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(field)
    ) {
      error.details = Object.freeze({ field });
    }

    return createCommandError({
      ok: false,
      error,
      snapshot: this.state,
    });
  }

  /**
   * @returns {number}
   */
  captureNow() {
    return requireTimestamp(this.clock.now(), 'clock.now()');
  }

  /**
   * @returns {string}
   */
  createEventId() {
    const eventId = `evt-${this.nextEventSequence}`;
    this.nextEventSequence += 1;
    return eventId;
  }

  /**
   * @returns {string}
   */
  createAlertId() {
    const alertId = `alert-${this.nextAlertSequence}`;
    this.nextAlertSequence += 1;
    return alertId;
  }

  /**
   * @param {string} dependencyId
   * @returns {object}
   */
  getDependency(dependencyId) {
    const dependency = this.state.dependencies.find(
      (item) => item.dependencyId === dependencyId,
    );

    if (dependency === undefined) {
      throw new TypeError('dependency state is unavailable');
    }

    return dependency;
  }

  /**
   * @param {{
   *   base: object,
   *   now: number,
   *   profileSource?: string,
   *   fallback?: object|null,
   *   lastEventId?: string|null
   * }} input
   * @returns {ReturnType<typeof createSnapshot>}
   */
  buildSnapshot(input) {
    return createSnapshot({
      ...input.base,
      now: input.now,
      profileSource:
        input.profileSource === undefined
          ? input.base.profileSource
          : input.profileSource,
      fallback:
        input.fallback === undefined
          ? input.base.fallback
          : input.fallback,
      alerts: this.incidentRepository.getAlerts(),
      incidents: this.incidentRepository.getTimeline(),
      telemetry: this.telemetryRepository.getAll(),
      lastEventId:
        input.lastEventId === undefined
          ? input.base.lastEventId
          : input.lastEventId,
    });
  }

  /**
   * @param {object} sample
   * @returns {object}
   */
  recordTelemetry(sample) {
    const incidentActivity =
      this.incidentRepository
        .getTimeline()
        .filter(
          (event) =>
            event.dependencyId === sample.dependencyId &&
            event.recoveryStatus === RECOVERY_STATUSES.ACTIVE,
        ).length;

    const telemetry = createTelemetrySample({
      ...sample,
      incidentActivity,
    });

    const storedTelemetry =
      this.telemetryRepository.append(telemetry);

    if (this.onTelemetry !== null) {
      try {
        this.onTelemetry(storedTelemetry);
      } catch {
        // Observability consumers cannot interrupt browser-local commands.
      }
    }

    return storedTelemetry;
  }

  /**
   * @returns {void}
   */
  reconcilePolling() {
    if (this.running && this.listeners.size > 0) {
      if (this.pollingHandle === null) {
        this.pollingHandle = this.clock.setInterval(
          () => this.pollDependencies(),
          POLL_INTERVAL_MS,
        );
      }
      return;
    }

    this.clearPolling();
  }

  /**
   * @returns {void}
   */
  clearPolling() {
    if (this.pollingHandle === null) {
      return;
    }

    this.clock.clearInterval(this.pollingHandle);
    this.pollingHandle = null;
  }

  /**
   * Records represented browser-local polling telemetry without changing the
   * selected scenario or performing dependency I/O.
   *
   * @returns {void}
   */
  pollDependencies() {
    if (
      !this.running ||
      this.listeners.size === 0 ||
      this.commandRunning
    ) {
      return;
    }

    const now = this.captureNow();

    this.state.dependencies.forEach((dependency) => {
      this.recordTelemetry({
        timestamp: now,
        dependencyId: dependency.dependencyId,
        status: dependency.status,
        responseTimeMs: dependency.latencyMs,
        failureCount: dependency.failureCount,
        circuit: dependency.circuit,
        dataSource: this.state.profileSource,
      });
    });

    this.state = this.buildSnapshot({
      base: this.state,
      now,
    });
    this.notifyListeners();
  }

  /**
   * @param {object} fallback
   * @returns {void}
   */
  scheduleFallback(fallback) {
    this.clearFallbackTimer();

    if (!this.running) {
      return;
    }

    this.cancelFallbackTimer = scheduleAt(
      this.clock,
      fallback.expiresAt,
      () => {
        this.cancelFallbackTimer = null;

        if (!this.running) {
          return;
        }

        this.runCommand(() =>
          this.applyFallbackExpiry(
            fallback.id,
            fallback.timerRevision,
          ),
        );
      },
    );
  }

  /**
   * @returns {void}
   */
  scheduleCurrentFallback() {
    if (
      this.running &&
      this.state.fallback !== null &&
      this.cancelFallbackTimer === null
    ) {
      this.scheduleFallback(this.state.fallback);
    }
  }

  /**
   * @returns {void}
   */
  clearFallbackTimer() {
    if (this.cancelFallbackTimer === null) {
      return;
    }

    this.cancelFallbackTimer();
    this.cancelFallbackTimer = null;
  }

  /**
   * @returns {void}
   */
  removeCurrentFallback() {
    this.clearFallbackTimer();

    if (this.state.fallback !== null) {
      this.fallbackRepository.remove(this.state.fallback.id);
    }
  }

  /**
   * @param {string} fallbackId
   * @param {number} timerRevision
   * @returns {ReturnType<typeof createCommandSuccess>|ReturnType<typeof createCommandError>}
   */
  applyFallbackExpiry(fallbackId, timerRevision) {
    const fallback = this.fallbackRepository.getById(fallbackId);

    if (
      fallback === null ||
      fallback.timerRevision !== timerRevision ||
      this.state.fallback?.id !== fallbackId
    ) {
      return this.createErrorResult(
        DOMAIN_ERROR_CODES.STALE_TIMER,
        ERROR_MESSAGES[DOMAIN_ERROR_CODES.STALE_TIMER],
      );
    }

    const now = this.captureNow();

    if (now < fallback.expiresAt) {
      this.scheduleFallback(fallback);
      return this.createErrorResult(
        DOMAIN_ERROR_CODES.STALE_TIMER,
        ERROR_MESSAGES[DOMAIN_ERROR_CODES.STALE_TIMER],
      );
    }

    if (
      !this.fallbackRepository.expire(
        fallbackId,
        timerRevision,
        now,
      )
    ) {
      return this.createErrorResult(
        DOMAIN_ERROR_CODES.STALE_TIMER,
        ERROR_MESSAGES[DOMAIN_ERROR_CODES.STALE_TIMER],
      );
    }

    this.clearFallbackTimer();

    const eventId = this.createEventId();
    const primary = this.getDependency(
      DEPENDENCY_IDS.PROFILE_PRIMARY,
    );

    this.incidentRepository.recordFallbackExpiry({
      eventId,
      dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
      profileId: fallback.profileId,
      occurredAt: now,
      circuit: primary.circuit,
      severity: SEVERITIES.MEDIUM,
    });

    const profileSource = selectProfileSource(
      this.state.dependencies,
      null,
      now,
    );

    this.state = this.buildSnapshot({
      base: this.state,
      now,
      profileSource,
      fallback: null,
      lastEventId: eventId,
    });
    this.queueNotification();

    return createCommandSuccess({
      ok: true,
      eventId,
      snapshot: this.state,
    });
  }

  /**
   * @returns {void}
   */
  queueNotification() {
    this.notificationPending = true;
  }

  /**
   * @returns {void}
   */
  flushNotification() {
    if (!this.notificationPending) {
      return;
    }

    this.notificationPending = false;
    this.notifyListeners();
  }

  /**
   * @returns {void}
   */
  notifyListeners() {
    const snapshot = this.state;

    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // One subscriber cannot prevent updates to remaining subscribers.
      }
    });
  }
}

export const createResilienceEngine = (options) =>
  new ResilienceEngine(options);

export {
  FAILURE_STATUSES,
};

export default ResilienceEngine;