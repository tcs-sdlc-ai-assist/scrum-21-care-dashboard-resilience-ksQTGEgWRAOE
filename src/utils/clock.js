import { REFERENCE_DATE } from '../domain/constants.js';

export const REFERENCE_TIMESTAMP = Date.parse(
  `${REFERENCE_DATE}T00:00:00.000Z`,
);

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requireTimestamp(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requireDelay(value, name) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new TypeError(`${name} must be a non-negative finite number`);
  }

  return Math.floor(value);
}

/**
 * @param {unknown} callback
 * @returns {(...args: unknown[]) => void}
 */
function requireCallback(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function');
  }

  return callback;
}

/**
 * @param {unknown} clock
 * @returns {{
 *   now: () => number,
 *   setTimeout: (callback: (...args: unknown[]) => void, delay: number, ...args: unknown[]) => unknown,
 *   clearTimeout: (handle: unknown) => void
 * }}
 */
function requireClock(clock) {
  if (
    typeof clock !== 'object' ||
    clock === null ||
    typeof clock.now !== 'function' ||
    typeof clock.setTimeout !== 'function' ||
    typeof clock.clearTimeout !== 'function'
  ) {
    throw new TypeError(
      'clock must provide now, setTimeout, and clearTimeout methods',
    );
  }

  return clock;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function resolveNow(value) {
  if (value === undefined) {
    return Date.now();
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.now === 'function'
  ) {
    return requireTimestamp(value.now(), 'clock.now()');
  }

  return requireTimestamp(value, 'now');
}

/**
 * Clock backed by browser timer APIs and the current system time.
 */
export class SystemClock {
  /**
   * @returns {number}
   */
  now() {
    return Date.now();
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {...unknown} args
   * @returns {ReturnType<typeof globalThis.setTimeout>}
   */
  setTimeout(callback, delay, ...args) {
    requireCallback(callback);
    return globalThis.setTimeout(
      callback,
      requireDelay(delay, 'delay'),
      ...args,
    );
  }

  /**
   * @param {ReturnType<typeof globalThis.setTimeout>} handle
   * @returns {void}
   */
  clearTimeout(handle) {
    globalThis.clearTimeout(handle);
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {...unknown} args
   * @returns {ReturnType<typeof globalThis.setInterval>}
   */
  setInterval(callback, delay, ...args) {
    requireCallback(callback);
    const normalizedDelay = requireDelay(delay, 'delay');

    if (normalizedDelay === 0) {
      throw new RangeError('interval delay must be greater than zero');
    }

    return globalThis.setInterval(callback, normalizedDelay, ...args);
  }

  /**
   * @param {ReturnType<typeof globalThis.setInterval>} handle
   * @returns {void}
   */
  clearInterval(handle) {
    globalThis.clearInterval(handle);
  }
}

/**
 * Clock that maps elapsed time from another clock onto the fixed demonstration
 * reference date.
 */
export class ReferenceDateClock {
  /**
   * @param {{sourceClock?: SystemClock|FakeClock, referenceTimestamp?: number}} [options]
   */
  constructor(options = {}) {
    const sourceClock = options.sourceClock ?? new SystemClock();

    if (
      typeof sourceClock !== 'object' ||
      sourceClock === null ||
      typeof sourceClock.now !== 'function' ||
      typeof sourceClock.setTimeout !== 'function' ||
      typeof sourceClock.clearTimeout !== 'function'
    ) {
      throw new TypeError('sourceClock must implement the clock interface');
    }

    this.sourceClock = sourceClock;
    this.referenceTimestamp = requireTimestamp(
      options.referenceTimestamp ?? REFERENCE_TIMESTAMP,
      'referenceTimestamp',
    );
    this.sourceStartedAt = requireTimestamp(
      sourceClock.now(),
      'sourceClock.now()',
    );
  }

  /**
   * @returns {number}
   */
  now() {
    const sourceNow = requireTimestamp(
      this.sourceClock.now(),
      'sourceClock.now()',
    );
    return this.referenceTimestamp + Math.max(0, sourceNow - this.sourceStartedAt);
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {...unknown} args
   * @returns {unknown}
   */
  setTimeout(callback, delay, ...args) {
    return this.sourceClock.setTimeout(callback, delay, ...args);
  }

  /**
   * @param {unknown} handle
   * @returns {void}
   */
  clearTimeout(handle) {
    this.sourceClock.clearTimeout(handle);
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {...unknown} args
   * @returns {unknown}
   */
  setInterval(callback, delay, ...args) {
    if (typeof this.sourceClock.setInterval !== 'function') {
      throw new TypeError('sourceClock does not support intervals');
    }

    return this.sourceClock.setInterval(callback, delay, ...args);
  }

  /**
   * @param {unknown} handle
   * @returns {void}
   */
  clearInterval(handle) {
    if (typeof this.sourceClock.clearInterval !== 'function') {
      throw new TypeError('sourceClock does not support intervals');
    }

    this.sourceClock.clearInterval(handle);
  }
}

/**
 * Deterministic clock for tests and browser-local scenario replay.
 */
export class FakeClock {
  /**
   * @param {number} [initialTimestamp]
   */
  constructor(initialTimestamp = REFERENCE_TIMESTAMP) {
    this.currentTimestamp = requireTimestamp(
      initialTimestamp,
      'initialTimestamp',
    );
    this.nextTimerId = 1;
    this.timers = new Map();
  }

  /**
   * @returns {number}
   */
  now() {
    return this.currentTimestamp;
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {...unknown} args
   * @returns {number}
   */
  setTimeout(callback, delay, ...args) {
    return this.addTimer(callback, delay, null, args);
  }

  /**
   * @param {number} handle
   * @returns {void}
   */
  clearTimeout(handle) {
    this.timers.delete(handle);
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {...unknown} args
   * @returns {number}
   */
  setInterval(callback, delay, ...args) {
    const normalizedDelay = requireDelay(delay, 'delay');

    if (normalizedDelay === 0) {
      throw new RangeError('interval delay must be greater than zero');
    }

    return this.addTimer(callback, normalizedDelay, normalizedDelay, args);
  }

  /**
   * @param {number} handle
   * @returns {void}
   */
  clearInterval(handle) {
    this.timers.delete(handle);
  }

  /**
   * @param {(...args: unknown[]) => void} callback
   * @param {number} delay
   * @param {number|null} interval
   * @param {unknown[]} args
   * @returns {number}
   */
  addTimer(callback, delay, interval, args) {
    const validCallback = requireCallback(callback);
    const normalizedDelay = requireDelay(delay, 'delay');
    const timerId = this.nextTimerId;

    this.nextTimerId += 1;
    this.timers.set(timerId, {
      id: timerId,
      dueAt: this.currentTimestamp + normalizedDelay,
      interval,
      callback: validCallback,
      args,
    });

    return timerId;
  }

  /**
   * Advances simulated elapsed time and synchronously runs every timer due on
   * or before the resulting timestamp.
   *
   * @param {number} milliseconds
   * @returns {number}
   */
  advance(milliseconds) {
    const duration = requireDelay(milliseconds, 'milliseconds');
    return this.advanceTo(this.currentTimestamp + duration);
  }

  /**
   * @param {number} timestamp
   * @returns {number}
   */
  advanceTo(timestamp) {
    const targetTimestamp = requireTimestamp(timestamp, 'timestamp');

    if (targetTimestamp < this.currentTimestamp) {
      throw new RangeError('timestamp cannot be earlier than the current time');
    }

    let timer = this.findNextTimer(targetTimestamp);

    while (timer !== null) {
      this.currentTimestamp = timer.dueAt;

      if (timer.interval === null) {
        this.timers.delete(timer.id);
      }

      timer.callback(...timer.args);

      if (timer.interval !== null && this.timers.has(timer.id)) {
        const activeTimer = this.timers.get(timer.id);
        activeTimer.dueAt = timer.dueAt + timer.interval;
      }

      timer = this.findNextTimer(targetTimestamp);
    }

    this.currentTimestamp = targetTimestamp;
    return this.currentTimestamp;
  }

  /**
   * @returns {number}
   */
  pendingTimerCount() {
    return this.timers.size;
  }

  /**
   * @param {number} targetTimestamp
   * @returns {{
   *   id: number,
   *   dueAt: number,
   *   interval: number|null,
   *   callback: (...args: unknown[]) => void,
   *   args: unknown[]
   * }|null}
   */
  findNextTimer(targetTimestamp) {
    let nextTimer = null;

    this.timers.forEach((timer) => {
      if (timer.dueAt > targetTimestamp) {
        return;
      }

      if (
        nextTimer === null ||
        timer.dueAt < nextTimer.dueAt ||
        (timer.dueAt === nextTimer.dueAt && timer.id < nextTimer.id)
      ) {
        nextTimer = timer;
      }
    });

    return nextTimer;
  }
}

/**
 * @param {number} timestamp
 * @param {number|{now: () => number}} [now]
 * @returns {string}
 */
export function formatRelativeTime(timestamp, now) {
  const validTimestamp = requireTimestamp(timestamp, 'timestamp');
  const currentTimestamp = resolveNow(now);
  const difference = validTimestamp - currentTimestamp;
  const absoluteDifference = Math.abs(difference);

  if (absoluteDifference < 5 * SECOND_MS) {
    return 'just now';
  }

  let unit = 'second';
  let unitMilliseconds = SECOND_MS;

  if (absoluteDifference >= YEAR_MS) {
    unit = 'year';
    unitMilliseconds = YEAR_MS;
  } else if (absoluteDifference >= MONTH_MS) {
    unit = 'month';
    unitMilliseconds = MONTH_MS;
  } else if (absoluteDifference >= WEEK_MS) {
    unit = 'week';
    unitMilliseconds = WEEK_MS;
  } else if (absoluteDifference >= DAY_MS) {
    unit = 'day';
    unitMilliseconds = DAY_MS;
  } else if (absoluteDifference >= HOUR_MS) {
    unit = 'hour';
    unitMilliseconds = HOUR_MS;
  } else if (absoluteDifference >= MINUTE_MS) {
    unit = 'minute';
    unitMilliseconds = MINUTE_MS;
  }

  const amount = Math.max(1, Math.round(absoluteDifference / unitMilliseconds));
  const label = `${amount} ${unit}${amount === 1 ? '' : 's'}`;

  return difference < 0 ? `${label} ago` : `in ${label}`;
}

export const formatRelativeTimestamp = formatRelativeTime;

/**
 * Formats either a remaining duration, or an expiry timestamp when `now` is
 * supplied.
 *
 * @param {number} value
 * @param {number|{now: () => number}} [now]
 * @returns {string}
 */
export function formatCountdown(value, now) {
  const validValue = requireTimestamp(value, 'value');
  const remaining =
    now === undefined ? validValue : Math.max(0, validValue - resolveNow(now));

  if (remaining <= 0) {
    return 'Expired';
  }

  const totalSeconds = Math.ceil(remaining / SECOND_MS);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * @param {number} expiresAt
 * @param {number|{now: () => number}} [now]
 * @returns {number}
 */
export function getRemainingTime(expiresAt, now) {
  const validExpiresAt = requireTimestamp(expiresAt, 'expiresAt');
  return Math.max(0, validExpiresAt - resolveNow(now));
}

/**
 * Schedules a callback and returns an idempotent cancellation function.
 *
 * @param {SystemClock|ReferenceDateClock|FakeClock} clock
 * @param {(...args: unknown[]) => void} callback
 * @param {number} delay
 * @param {...unknown} args
 * @returns {() => void}
 */
export function scheduleTimeout(clock, callback, delay, ...args) {
  const validClock = requireClock(clock);
  const validCallback = requireCallback(callback);
  let active = true;

  const handle = validClock.setTimeout(() => {
    if (!active) {
      return;
    }

    active = false;
    validCallback(...args);
  }, requireDelay(delay, 'delay'));

  return () => {
    if (!active) {
      return;
    }

    active = false;
    validClock.clearTimeout(handle);
  };
}

/**
 * @param {SystemClock|ReferenceDateClock|FakeClock} clock
 * @param {number} timestamp
 * @param {(...args: unknown[]) => void} callback
 * @param {...unknown} args
 * @returns {() => void}
 */
export function scheduleAt(clock, timestamp, callback, ...args) {
  const validClock = requireClock(clock);
  const validTimestamp = requireTimestamp(timestamp, 'timestamp');
  const currentTimestamp = requireTimestamp(validClock.now(), 'clock.now()');

  return scheduleTimeout(
    validClock,
    callback,
    Math.max(0, validTimestamp - currentTimestamp),
    ...args,
  );
}

export const systemClock = Object.freeze(new SystemClock());