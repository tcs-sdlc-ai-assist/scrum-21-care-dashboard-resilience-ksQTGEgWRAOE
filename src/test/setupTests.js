import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import {
  afterEach,
  beforeEach,
  expect,
  vi,
} from 'vitest';

expect.extend(toHaveNoViolations);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BLOCKED_NETWORK_MESSAGE =
  'Unexpected network access in a browser-local test. Mock fetch, XMLHttpRequest, or WebSocket explicitly.';

/**
 * @returns {Error}
 */
function createBlockedNetworkError() {
  return new Error(BLOCKED_NETWORK_MESSAGE);
}

/**
 * @param {string} name
 * @param {unknown} value
 * @returns {void}
 */
function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

class BlockedXMLHttpRequest {
  static UNSENT = 0;

  static OPENED = 1;

  static HEADERS_RECEIVED = 2;

  static LOADING = 3;

  static DONE = 4;

  constructor() {
    throw createBlockedNetworkError();
  }
}

class BlockedWebSocket {
  static CONNECTING = 0;

  static OPEN = 1;

  static CLOSING = 2;

  static CLOSED = 3;

  constructor() {
    throw createBlockedNetworkError();
  }
}

/**
 * Installs guards that fail synchronously when a test attempts unmocked
 * network access.
 *
 * @returns {void}
 */
function installNetworkGuards() {
  defineGlobal(
    'fetch',
    vi.fn(() => {
      throw createBlockedNetworkError();
    }),
  );
  defineGlobal('XMLHttpRequest', BlockedXMLHttpRequest);
  defineGlobal('WebSocket', BlockedWebSocket);
}

class ResizeObserverShim {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

class IntersectionObserverShim {
  constructor() {
    this.root = null;
    this.rootMargin = '0px';
    this.thresholds = Object.freeze([0]);
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  takeRecords() {
    return [];
  }
}

/**
 * Registers browser APIs commonly used by responsive components but omitted
 * by jsdom.
 *
 * @returns {void}
 */
function installBrowserApiShims() {
  if (typeof globalThis.matchMedia !== 'function') {
    defineGlobal('matchMedia', (query) => ({
      matches: false,
      media: String(query),
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
  }

  if (typeof globalThis.ResizeObserver !== 'function') {
    defineGlobal('ResizeObserver', ResizeObserverShim);
  }

  if (typeof globalThis.IntersectionObserver !== 'function') {
    defineGlobal('IntersectionObserver', IntersectionObserverShim);
  }

  if (typeof globalThis.requestAnimationFrame !== 'function') {
    defineGlobal('requestAnimationFrame', (callback) =>
      globalThis.setTimeout(() => callback(0), 0));
  }

  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    defineGlobal('cancelAnimationFrame', (handle) => {
      globalThis.clearTimeout(handle);
    });
  }

  if (typeof globalThis.scrollTo !== 'function') {
    defineGlobal('scrollTo', () => undefined);
  }

  if (
    typeof globalThis.HTMLElement !== 'undefined' &&
    typeof globalThis.HTMLElement.prototype.scrollIntoView !==
      'function'
  ) {
    Object.defineProperty(
      globalThis.HTMLElement.prototype,
      'scrollIntoView',
      {
        configurable: true,
        value: () => undefined,
        writable: true,
      },
    );
  }

  if (
    typeof globalThis.URL !== 'undefined' &&
    typeof globalThis.URL.createObjectURL !== 'function'
  ) {
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:browser-local-test',
      writable: true,
    });
  }

  if (
    typeof globalThis.URL !== 'undefined' &&
    typeof globalThis.URL.revokeObjectURL !== 'function'
  ) {
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      value: () => undefined,
      writable: true,
    });
  }
}

/**
 * Clears browser storage without allowing unavailable storage APIs to
 * interrupt test cleanup.
 *
 * @returns {void}
 */
function clearBrowserStorage() {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // Storage may be disabled by an individual test.
  }

  try {
    globalThis.sessionStorage?.clear();
  } catch {
    // Storage may be disabled by an individual test.
  }
}

installBrowserApiShims();
installNetworkGuards();

beforeEach(() => {
  installNetworkGuards();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearBrowserStorage();

  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
    document.documentElement.classList.remove('dark');
  }

  installBrowserApiShims();
  installNetworkGuards();
});