import { createInitialSnapshot } from '../domain/model.js';
import { REFERENCE_TIMESTAMP } from '../utils/clock.js';

const REFERENCE_CLOCK = Object.freeze({
  now: () => REFERENCE_TIMESTAMP,
});

/**
 * Resolves a timestamp from an injectable clock.
 *
 * @param {{now: () => number}} clock
 * @returns {number}
 */
function getClockTimestamp(clock) {
  if (
    typeof clock !== 'object' ||
    clock === null ||
    typeof clock.now !== 'function'
  ) {
    throw new TypeError('clock must provide a now method');
  }

  const timestamp = clock.now();

  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new TypeError(
      'clock.now() must return a non-negative safe integer',
    );
  }

  return timestamp;
}

/**
 * Builds a fresh immutable, session-independent resilience engine state.
 *
 * @param {{now: () => number}} [clock]
 * @returns {ReturnType<typeof createInitialSnapshot>}
 */
export function createInitialState(clock = REFERENCE_CLOCK) {
  return createInitialSnapshot(getClockTimestamp(clock));
}

export const createInitialEngineState = createInitialState;
export const createInitialResilienceState = createInitialState;

export const INITIAL_STATE = createInitialState();
export const INITIAL_STATE_FIXTURE = INITIAL_STATE;
export const INITIAL_RESILIENCE_STATE = INITIAL_STATE;

export default createInitialState;