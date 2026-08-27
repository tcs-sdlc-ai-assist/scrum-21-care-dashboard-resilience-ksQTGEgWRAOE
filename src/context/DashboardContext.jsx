import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import PropTypes from 'prop-types';
import {
  LIFECYCLE_COMMAND_TYPES,
  createLifecycleCommand,
} from '../contracts/ResilienceLifecycleContract.js';
import {
  createSnapshot,
  isSnapshot,
} from '../domain/model.js';

/**
 * Creates a validated, immutable dashboard snapshot.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createSnapshot>}
 */
export function createDashboardSnapshot(input) {
  return createSnapshot(input);
}

/**
 * Checks whether a value satisfies the dashboard snapshot contract.
 *
 * @param {unknown} input
 * @returns {boolean}
 */
export function isDashboardSnapshot(input) {
  return isSnapshot(input);
}

export const validateDashboardSnapshot = isDashboardSnapshot;

/**
 * Validates and returns an immutable dashboard snapshot.
 *
 * @param {unknown} input
 * @returns {ReturnType<typeof createSnapshot>}
 */
export function assertDashboardSnapshot(input) {
  return createDashboardSnapshot(input);
}

/**
 * @param {unknown} lifecycle
 * @returns {{
 *   subscribe: (listener: Function) => Function,
 *   getSnapshot: () => object,
 *   dispatch: (command: unknown) => unknown,
 *   resetScenario?: () => unknown
 * }}
 */
function requireLifecycle(lifecycle) {
  if (
    typeof lifecycle !== 'object' ||
    lifecycle === null ||
    typeof lifecycle.subscribe !== 'function' ||
    typeof lifecycle.getSnapshot !== 'function' ||
    typeof lifecycle.dispatch !== 'function'
  ) {
    throw new TypeError(
      'lifecycle must provide subscribe, getSnapshot, and dispatch methods',
    );
  }

  if (
    lifecycle.resetScenario !== undefined &&
    typeof lifecycle.resetScenario !== 'function'
  ) {
    throw new TypeError('resetScenario must be a function');
  }

  return lifecycle;
}

export const DashboardContext = createContext(undefined);
DashboardContext.displayName = 'DashboardContext';

/**
 * Provides the current immutable dashboard snapshot and validated lifecycle
 * actions to dashboard descendants.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   lifecycle: {
 *     subscribe: (listener: Function) => Function,
 *     getSnapshot: () => object,
 *     dispatch: (command: unknown) => unknown,
 *     resetScenario?: () => unknown
 *   }
 * }} props
 * @returns {import('react').ReactElement}
 */
export function DashboardProvider({ children, lifecycle }) {
  const dashboardLifecycle = useMemo(
    () => requireLifecycle(lifecycle),
    [lifecycle],
  );
  const snapshotCacheRef = useRef({
    hasValue: false,
    source: undefined,
    snapshot: undefined,
  });

  const getSnapshot = useCallback(() => {
    const source = dashboardLifecycle.getSnapshot();
    const cache = snapshotCacheRef.current;

    if (cache.hasValue && Object.is(cache.source, source)) {
      return cache.snapshot;
    }

    const snapshot = createDashboardSnapshot(source);
    snapshotCacheRef.current = {
      hasValue: true,
      source,
      snapshot,
    };

    return snapshot;
  }, [dashboardLifecycle]);

  const subscribe = useCallback(
    (onStoreChange) => {
      if (typeof onStoreChange !== 'function') {
        throw new TypeError('subscriber must be a function');
      }

      const unsubscribe = dashboardLifecycle.subscribe(
        (nextSnapshot) => {
          if (
            nextSnapshot !== undefined &&
            !isDashboardSnapshot(nextSnapshot)
          ) {
            throw new TypeError(
              'lifecycle subscription emitted an invalid dashboard snapshot',
            );
          }

          onStoreChange();
        },
      );

      if (typeof unsubscribe !== 'function') {
        throw new TypeError(
          'lifecycle subscribe must return an unsubscribe function',
        );
      }

      let subscribed = true;

      return () => {
        if (!subscribed) {
          return;
        }

        subscribed = false;
        unsubscribe();
      };
    },
    [dashboardLifecycle],
  );

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  const dispatch = useCallback(
    (command) => {
      const validatedCommand = createLifecycleCommand(command);
      return dashboardLifecycle.dispatch(validatedCommand);
    },
    [dashboardLifecycle],
  );

  const resetScenario = useCallback(() => {
    if (typeof dashboardLifecycle.resetScenario === 'function') {
      return dashboardLifecycle.resetScenario();
    }

    return dispatch({
      type: LIFECYCLE_COMMAND_TYPES.RESET_DEMO,
    });
  }, [dashboardLifecycle, dispatch]);

  const value = useMemo(
    () =>
      Object.freeze({
        snapshot,
        dispatch,
        resetScenario,
      }),
    [dispatch, resetScenario, snapshot],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

DashboardProvider.propTypes = {
  children: PropTypes.node.isRequired,
  lifecycle: PropTypes.shape({
    subscribe: PropTypes.func.isRequired,
    getSnapshot: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    resetScenario: PropTypes.func,
  }).isRequired,
};

/**
 * Returns the shared dashboard state and lifecycle actions.
 *
 * @returns {{
 *   snapshot: ReturnType<typeof createSnapshot>,
 *   dispatch: (command: unknown) => unknown,
 *   resetScenario: () => unknown
 * }}
 */
export function useDashboard() {
  const context = useContext(DashboardContext);

  if (context === undefined) {
    throw new Error(
      'useDashboard must be used within a DashboardProvider',
    );
  }

  return context;
}

export default DashboardProvider;