import PropTypes from 'prop-types';
import { PROFILE_SOURCES } from '../../domain/constants.js';
import StatusBadge from '../shared/StatusBadge.jsx';

const SOURCE_PRESENTATION = Object.freeze({
  [PROFILE_SOURCES.PRIMARY]: Object.freeze({
    label: 'Primary',
    description:
      'Synthetic profile data came from the primary mock service.',
  }),
  [PROFILE_SOURCES.SECONDARY]: Object.freeze({
    label: 'Secondary',
    description:
      'Synthetic profile data came from the secondary mock service.',
  }),
  [PROFILE_SOURCES.FALLBACK]: Object.freeze({
    label: 'Fallback',
    description:
      'Synthetic profile data came from browser-local fallback storage.',
  }),
  [PROFILE_SOURCES.NONE]: Object.freeze({
    label: 'Unavailable',
    description:
      'No synthetic profile source is currently available.',
  }),
});

/**
 * Renders an accessible, non-color-only indicator for the current synthetic
 * profile source. Unsupported values are presented as unavailable rather than
 * exposing an ambiguous source.
 *
 * @param {{
 *   source: 'PRIMARY'|'SECONDARY'|'FALLBACK'|'NONE',
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function ProfileSourceBadge({
  source,
  className = '',
}) {
  const normalizedSource = Object.prototype.hasOwnProperty.call(
    SOURCE_PRESENTATION,
    source,
  )
    ? source
    : PROFILE_SOURCES.NONE;
  const presentation = SOURCE_PRESENTATION[normalizedSource];

  return (
    <StatusBadge
      className={className}
      description={presentation.description}
      label={presentation.label}
      status={normalizedSource}
    />
  );
}

ProfileSourceBadge.propTypes = {
  source: PropTypes.oneOf(Object.values(PROFILE_SOURCES)).isRequired,
  className: PropTypes.string,
};

export default ProfileSourceBadge;