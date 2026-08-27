/**
 * @param {unknown} engine
 * @param {ReadonlyArray<string>} methods
 * @returns {Record<string, Function>}
 */
function requireEngineMethods(engine, methods) {
  if (
    typeof engine !== 'object' ||
    engine === null ||
    !methods.every((method) => typeof engine[method] === 'function')
  ) {
    throw new TypeError(
      `engine must provide ${methods.join(', ')} methods`,
    );
  }

  return engine;
}

/**
 * Starts lifecycle timers when a dashboard becomes active.
 *
 * @param {unknown} engine
 * @returns {void}
 */
export function onDashboardActive(engine) {
  const lifecycleEngine = requireEngineMethods(engine, ['start']);
  lifecycleEngine.start();
}

/**
 * Stops lifecycle timers when a dashboard is no longer active. In-memory
 * scenario state is retained.
 *
 * @param {unknown} engine
 * @returns {void}
 */
export function onDashboardInactive(engine) {
  const lifecycleEngine = requireEngineMethods(engine, ['stop']);
  lifecycleEngine.stop();
}

/**
 * Clears all browser-local scenario memory when the demo session ends, then
 * stops lifecycle timers. Starting first ensures cleanup also succeeds when
 * the dashboard was made inactive before the session was cleared.
 *
 * @param {unknown} engine
 * @returns {unknown}
 */
export function onSessionCleared(engine) {
  const lifecycleEngine = requireEngineMethods(engine, [
    'start',
    'resetDemo',
    'stop',
  ]);

  try {
    lifecycleEngine.start();
    return lifecycleEngine.resetDemo();
  } finally {
    lifecycleEngine.stop();
  }
}

/**
 * Restores the synthetic baseline while preserving the active dashboard
 * lifecycle.
 *
 * @param {unknown} engine
 * @returns {unknown}
 */
export function onDemoReset(engine) {
  const lifecycleEngine = requireEngineMethods(engine, ['resetDemo']);
  return lifecycleEngine.resetDemo();
}

const ResilienceLifecycleHooks = Object.freeze({
  onDashboardActive,
  onDashboardInactive,
  onSessionCleared,
  onDemoReset,
});

export default ResilienceLifecycleHooks;