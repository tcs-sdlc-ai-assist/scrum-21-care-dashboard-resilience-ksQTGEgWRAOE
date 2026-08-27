import { Component } from 'react';
import PropTypes from 'prop-types';
import {
  APP_MESSAGES,
  DEMO_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../../constants/messages.js';

const INITIAL_STATE = Object.freeze({
  hasError: false,
  recoveryPending: false,
  recoveryFailed: false,
});

/**
 * Contains unexpected rendering failures and presents only privacy-safe,
 * static recovery guidance. Raw exceptions and component details are never
 * retained in state, rendered, or logged.
 */
export class ErrorBoundary extends Component {
  /**
   * @param {{children: import('react').ReactNode, onReset?: Function}} props
   */
  constructor(props) {
    super(props);
    this.state = INITIAL_STATE;
    this.mounted = false;

    this.handleReset = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  /**
   * @returns {Readonly<{
   *   hasError: boolean,
   *   recoveryPending: boolean,
   *   recoveryFailed: boolean
   * }>}
   */
  static getDerivedStateFromError() {
    return {
      hasError: true,
      recoveryPending: false,
      recoveryFailed: false,
    };
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  /**
   * Attempts the supplied browser-local reset action without exposing error
   * details. Both synchronous and promise-returning actions are supported.
   *
   * @returns {void}
   */
  handleReset() {
    const { onReset } = this.props;

    if (typeof onReset !== 'function') {
      this.handleReload();
      return;
    }

    this.setState({
      recoveryPending: true,
      recoveryFailed: false,
    });

    let result;

    try {
      result = onReset();
    } catch {
      if (this.mounted) {
        this.setState({
          recoveryPending: false,
          recoveryFailed: true,
        });
      }
      return;
    }

    Promise.resolve(result)
      .then((recoveryResult) => {
        if (!this.mounted) {
          return;
        }

        if (
          recoveryResult !== undefined &&
          recoveryResult !== null &&
          typeof recoveryResult === 'object' &&
          recoveryResult.ok === false
        ) {
          this.setState({
            recoveryPending: false,
            recoveryFailed: true,
          });
          return;
        }

        this.setState(INITIAL_STATE);
      })
      .catch(() => {
        if (this.mounted) {
          this.setState({
            recoveryPending: false,
            recoveryFailed: true,
          });
        }
      });
  }

  /**
   * Reloads the static application to restore its synthetic baseline.
   *
   * @returns {void}
   */
  handleReload() {
    try {
      if (typeof globalThis.location?.reload !== 'function') {
        throw new Error('Reload is unavailable');
      }

      globalThis.location.reload();
    } catch {
      if (this.mounted) {
        this.setState({
          recoveryPending: false,
          recoveryFailed: true,
        });
      }
    }
  }

  /**
   * @returns {import('react').ReactNode}
   */
  render() {
    const { children, onReset } = this.props;
    const {
      hasError,
      recoveryPending,
      recoveryFailed,
    } = this.state;

    if (!hasError) {
      return children;
    }

    return (
      <main
        className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-content dark:bg-canvas-inverse dark:text-content-inverse sm:px-6 lg:px-8"
        id="main-content"
      >
        <section
          aria-labelledby="error-boundary-title"
          className="w-full max-w-2xl rounded-panel border border-slate-300 bg-surface p-6 shadow-panel dark:border-slate-700 dark:bg-surface-inverse sm:p-8"
          role="alert"
        >
          <div
            aria-hidden="true"
            className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-status-critical-border bg-status-critical-surface text-2xl font-bold text-status-critical"
          >
            !
          </div>

          <h1
            className="text-2xl font-bold text-content dark:text-content-inverse sm:text-3xl"
            id="error-boundary-title"
          >
            {APP_MESSAGES.unexpectedErrorTitle}
          </h1>

          <p className="mt-3 max-w-prose text-content-muted dark:text-slate-200">
            {APP_MESSAGES.unexpectedErrorBody}
          </p>

          <div
            className="mt-6 rounded-lg border border-care-300 bg-care-50 p-4 text-sm text-content dark:border-care-700 dark:bg-care-950 dark:text-care-100"
            role="note"
          >
            <p className="font-semibold">
              {MOCK_BOUNDARY_MESSAGES.badge}
            </p>
            <p className="mt-1">
              {MOCK_BOUNDARY_MESSAGES.shortNotice}
            </p>
            <p className="mt-1">
              No exception details, profiles, or credentials are displayed.
            </p>
          </div>

          {recoveryFailed ? (
            <p
              className="mt-5 rounded-lg border border-status-critical-border bg-status-critical-surface p-3 text-sm font-semibold text-status-critical"
              role="status"
            >
              {DEMO_MESSAGES.resetFailed}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {typeof onReset === 'function' ? (
              <button
                className="min-h-touch rounded-lg bg-care-700 px-4 py-2.5 font-semibold text-white transition-colors duration-fast hover:bg-care-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-care-200 dark:text-care-950 dark:hover:bg-care-100"
                disabled={recoveryPending}
                onClick={this.handleReset}
                type="button"
              >
                {recoveryPending
                  ? APP_MESSAGES.loading
                  : APP_MESSAGES.retry}
              </button>
            ) : null}

            <button
              className="min-h-touch rounded-lg border border-care-700 bg-surface px-4 py-2.5 font-semibold text-care-800 transition-colors duration-fast hover:bg-care-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-care-200 dark:bg-surface-inverse dark:text-care-100 dark:hover:bg-care-950"
              disabled={recoveryPending}
              onClick={this.handleReload}
              type="button"
            >
              {APP_MESSAGES.reload}
            </button>
          </div>
        </section>
      </main>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  onReset: PropTypes.func,
};

export default ErrorBoundary;