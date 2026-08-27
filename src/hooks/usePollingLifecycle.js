import { useEffect, useRef } from 'react';
import {
  onDashboardActive,
  onDashboardInactive,
} from '../engine/ResilienceLifecycleHooks.js';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * @param {unknown} engine
 * @returns {{start: Function, stop: Function}}
 */
function requireEngine(engine) {
  if (
    !isObject(engine) ||
    typeof engine.start !== 'function' ||
    typeof engine.stop !== 'function'
  ) {
    throw new TypeError('engine must provide start and stop methods');
  }

  return engine;
}

/**
 * @param {unknown} role
 * @returns {boolean}
 */
function isSreRole(role) {
  return role === 'sre' || role === 'SRE';
}

/**
 * @param {Record<string, unknown>} options
 * @returns {boolean}
 */
function resolveRouteActivity(options) {
  const routeActivity =
    options.isRouteActive ??
    options.routeActive ??
    options.isActive ??
    options.active ??
    false;

  return routeActivity === true;
}

/**
 * @param {Record<string, unknown>} options
 * @returns {boolean}
 */
function resolveSreActivity(options) {
  if (options.role !== undefined) {
    return isSreRole(options.role);
  }

  if (options.isSreDashboard !== undefined) {
    return options.isSreDashboard === true;
  }

  return true;
}

/**
 * @param {Record<string, unknown>} options
 * @returns {boolean}
 */
function resolveSessionActivity(options) {
  if (options.sessionActive !== undefined) {
    return options.sessionActive === true;
  }

  if (options.hasSession !== undefined) {
    return options.hasSession === true;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'session')) {
    return options.session !== null && options.session !== undefined;
  }

  return true;
}

/**
 * Supports the canonical `(engine, options)` signature and a boolean shorthand
 * where the boolean represents an active SRE dashboard route.
 *
 * @param {unknown} engineOrOptions
 * @param {unknown} optionsOrActive
 * @param {unknown} lifecycleKey
 * @returns {{
 *   engine: {start: Function, stop: Function},
 *   active: boolean,
 *   lifecycleKey: unknown
 * }}
 */
function resolveArguments(
  engineOrOptions,
  optionsOrActive,
  lifecycleKey,
) {
  let engine = engineOrOptions;
  let options = optionsOrActive;

  if (
    isObject(engineOrOptions) &&
    Object.prototype.hasOwnProperty.call(engineOrOptions, 'engine')
  ) {
    engine = engineOrOptions.engine;
    options = engineOrOptions;
  }

  if (typeof options === 'boolean') {
    return {
      engine: requireEngine(engine),
      active: options,
      lifecycleKey,
    };
  }

  const normalizedOptions = isObject(options) ? options : {};

  return {
    engine: requireEngine(engine),
    active:
      resolveRouteActivity(normalizedOptions) &&
      resolveSreActivity(normalizedOptions) &&
      resolveSessionActivity(normalizedOptions),
    lifecycleKey:
      normalizedOptions.lifecycleKey ??
      normalizedOptions.resetKey ??
      normalizedOptions.resetRevision ??
      lifecycleKey,
  };
}

/**
 * @returns {boolean}
 */
function isDocumentVisible() {
  if (typeof document === 'undefined') {
    return false;
  }

  if (document.visibilityState !== undefined) {
    return document.visibilityState === 'visible';
  }

  return document.hidden === false;
}

/**
 * Starts represented polling only while the SRE dashboard route is active and
 * the document is visible. Changing the lifecycle key forces cleanup and
 * reconciliation after a browser-local reset.
 *
 * The preferred signature is:
 * `usePollingLifecycle(engine, { isRouteActive, role, sessionActive, resetKey })`.
 * A boolean second argument may be used when role and session eligibility have
 * already been resolved by the caller.
 *
 * @param {unknown} engineOrOptions
 * @param {unknown} [optionsOrActive]
 * @param {unknown} [lifecycleKey]
 * @returns {void}
 */
export function usePollingLifecycle(
  engineOrOptions,
  optionsOrActive,
  lifecycleKey,
) {
  const resolved = resolveArguments(
    engineOrOptions,
    optionsOrActive,
    lifecycleKey,
  );
  const pollingStateRef = useRef({
    engine: null,
    active: false,
    initialized: false,
  });

  useEffect(() => {
    const pollingEngine = resolved.engine;
    const pollingState = pollingStateRef.current;

    if (pollingState.engine !== pollingEngine) {
      pollingState.engine = pollingEngine;
      pollingState.active = false;
      pollingState.initialized = false;
    }

    function activatePolling() {
      const current = pollingStateRef.current;

      if (
        current.engine !== pollingEngine ||
        (current.initialized && current.active)
      ) {
        return;
      }

      onDashboardActive(pollingEngine);
      current.active = true;
      current.initialized = true;
    }

    function deactivatePolling() {
      const current = pollingStateRef.current;

      if (
        current.engine !== pollingEngine ||
        (current.initialized && !current.active)
      ) {
        return;
      }

      onDashboardInactive(pollingEngine);
      current.active = false;
      current.initialized = true;
    }

    function reconcilePolling() {
      if (resolved.active && isDocumentVisible()) {
        activatePolling();
        return;
      }

      deactivatePolling();
    }

    reconcilePolling();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', reconcilePolling);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          reconcilePolling,
        );
      }

      const current = pollingStateRef.current;

      if (current.engine === pollingEngine && current.active) {
        onDashboardInactive(pollingEngine);
        current.active = false;
        current.initialized = true;
      }
    };
  }, [resolved.active, resolved.engine, resolved.lifecycleKey]);
}

export default usePollingLifecycle;