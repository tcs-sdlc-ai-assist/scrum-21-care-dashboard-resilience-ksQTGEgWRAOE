import {
  LIFECYCLE_COMMAND_TYPES,
  createLifecycleCommand,
  getHealthStatusForOutcome,
} from '../contracts/ResilienceLifecycleContract.js';

const REQUIRED_ENGINE_METHODS = Object.freeze([
  'subscribe',
  'getSnapshot',
  'simulateHealth',
  'simulateRecovery',
  'requestProfile',
  'acknowledgeAlert',
  'resetDemo',
]);

/**
 * @param {unknown} engine
 * @returns {Record<string, Function>}
 */
function requireEngine(engine) {
  if (
    typeof engine !== 'object' ||
    engine === null ||
    !REQUIRED_ENGINE_METHODS.every(
      (method) => typeof engine[method] === 'function',
    )
  ) {
    throw new TypeError(
      `engine must provide ${REQUIRED_ENGINE_METHODS.join(', ')} methods`,
    );
  }

  return engine;
}

/**
 * Adapts a browser-local ResilienceEngine to the shell-facing lifecycle
 * contract. Commands are validated and mapped without network or persistence
 * activity.
 *
 * @param {unknown} engine
 * @returns {Readonly<{
 *   subscribe: (listener: Function) => Function,
 *   getSnapshot: () => object,
 *   dispatch: (command: unknown) => unknown,
 *   resetScenario: () => unknown
 * }>}
 */
export function createResilienceLifecycleAdapter(engine) {
  const lifecycleEngine = requireEngine(engine);

  /**
   * @param {Function} listener
   * @returns {Function}
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }

    return lifecycleEngine.subscribe(listener);
  }

  /**
   * @returns {object}
   */
  function getSnapshot() {
    return lifecycleEngine.getSnapshot();
  }

  /**
   * @param {unknown} command
   * @returns {unknown}
   */
  function dispatch(command) {
    const lifecycleCommand = createLifecycleCommand(command);

    switch (lifecycleCommand.type) {
      case LIFECYCLE_COMMAND_TYPES.SIMULATE_HEALTH:
        return lifecycleEngine.simulateHealth({
          dependencyId: lifecycleCommand.dependencyId,
          status: getHealthStatusForOutcome(lifecycleCommand.outcome),
        });

      case LIFECYCLE_COMMAND_TYPES.SIMULATE_RECOVERY:
        return lifecycleEngine.simulateRecovery({
          dependencyId: lifecycleCommand.dependencyId,
          profileId: lifecycleCommand.profileId,
        });

      case LIFECYCLE_COMMAND_TYPES.REQUEST_PROFILE:
        return lifecycleEngine.requestProfile({
          profileId: lifecycleCommand.profileId,
        });

      case LIFECYCLE_COMMAND_TYPES.ACKNOWLEDGE_ALERT:
        return lifecycleEngine.acknowledgeAlert({
          alertId: lifecycleCommand.alertId,
        });

      case LIFECYCLE_COMMAND_TYPES.RESET_DEMO:
        return lifecycleEngine.resetDemo();

      default:
        throw new TypeError('type must be a supported lifecycle command');
    }
  }

  /**
   * Restores the browser-local baseline scenario.
   *
   * @returns {unknown}
   */
  function resetScenario() {
    return lifecycleEngine.resetDemo();
  }

  return Object.freeze({
    subscribe,
    getSnapshot,
    dispatch,
    resetScenario,
  });
}

export default createResilienceLifecycleAdapter;