import { useId } from 'react';
import PropTypes from 'prop-types';
import {
  AUTH_MESSAGES,
  MOCK_BOUNDARY_MESSAGES,
} from '../../constants/messages.js';

const ROLE_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'clinical',
    label: 'Clinical staff',
    description: AUTH_MESSAGES.careTeamDescription,
  }),
  Object.freeze({
    value: 'sre',
    label: 'Site reliability engineer (SRE)',
    description: AUTH_MESSAGES.sreDescription,
  }),
]);

/**
 * Renders a keyboard-accessible mock role radio group. Role selection changes
 * presentation only and does not grant access to any system.
 *
 * @param {{
 *   value?: string,
 *   onChange: (role: 'clinical'|'sre') => void,
 *   error?: string,
 *   disabled?: boolean,
 *   required?: boolean,
 *   name?: string,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function RoleSelector({
  value = '',
  onChange,
  error = '',
  disabled = false,
  required = true,
  name = 'role',
  className = '',
}) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  const describedBy = error.length > 0
    ? `${hintId} ${errorId}`
    : hintId;

  return (
    <fieldset
      aria-describedby={describedBy}
      aria-invalid={error.length > 0 ? 'true' : undefined}
      className={['min-w-0', className].filter(Boolean).join(' ')}
      disabled={disabled}
    >
      <legend className="text-sm font-semibold text-content dark:text-content-inverse">
        {AUTH_MESSAGES.roleLabel}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-status-critical">
            *
          </span>
        ) : null}
      </legend>

      <p
        className="mt-1 max-w-prose text-sm text-content-muted dark:text-slate-200"
        id={hintId}
      >
        {AUTH_MESSAGES.roleHint}{' '}
        {MOCK_BOUNDARY_MESSAGES.notSecurityBoundary}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const optionId = `${generatedId}-${option.value}`;
          const descriptionId = `${optionId}-description`;
          const selected = value === option.value;

          return (
            <label
              className={[
                'flex min-h-touch cursor-pointer items-start gap-3 rounded-panel border p-4 shadow-sm transition-colors duration-fast',
                'focus-within:outline-none focus-within:ring-4 focus-within:ring-focus/40',
                'disabled:cursor-not-allowed',
                selected
                  ? 'border-care-700 bg-care-50 dark:border-care-200 dark:bg-care-950'
                  : 'border-slate-300 bg-surface hover:border-care-500 hover:bg-care-50 dark:border-slate-600 dark:bg-surface-inverse dark:hover:border-care-300 dark:hover:bg-care-950',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              htmlFor={optionId}
              key={option.value}
            >
              <input
                aria-describedby={descriptionId}
                checked={selected}
                className="mt-1 h-5 w-5 shrink-0 accent-care-700 focus:outline-none dark:accent-care-200"
                id={optionId}
                name={name}
                onChange={() => onChange(option.value)}
                required={required}
                type="radio"
                value={option.value}
              />

              <span className="min-w-0">
                <span className="block font-semibold text-content dark:text-content-inverse">
                  {option.label}
                </span>
                <span
                  className="mt-1 block text-sm leading-5 text-content-muted dark:text-slate-200"
                  id={descriptionId}
                >
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error.length > 0 ? (
        <p
          className="mt-2 text-sm font-semibold text-status-critical"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

RoleSelector.propTypes = {
  value: PropTypes.oneOf(['', 'clinical', 'sre']),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  name: PropTypes.string,
  className: PropTypes.string,
};

export default RoleSelector;