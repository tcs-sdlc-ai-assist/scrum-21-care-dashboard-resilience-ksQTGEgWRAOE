import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ACCESSIBILITY_MESSAGES } from '../../constants/messages.js';

const EMPTY_ANNOUNCEMENT = Object.freeze({
  key: '',
  message: '',
});

/**
 * Renders a visually hidden live region and announces each event only once.
 * When no event identifier is supplied, the message itself is used for
 * deduplication.
 *
 * @param {{
 *   message?: string,
 *   eventId?: string,
 *   politeness?: 'polite'|'assertive',
 *   priority?: 'polite'|'assertive',
 *   label?: string,
 *   className?: string
 * }} props
 * @returns {import('react').ReactElement}
 */
export function LiveRegion({
  message = '',
  eventId = undefined,
  politeness = undefined,
  priority = undefined,
  label = undefined,
  className = '',
}) {
  const requestedPriority = priority ?? politeness;
  const livePriority =
    requestedPriority === 'assertive' ? 'assertive' : 'polite';
  const lastAnnouncementKeyRef = useRef(null);
  const [announcement, setAnnouncement] = useState(
    EMPTY_ANNOUNCEMENT,
  );

  useEffect(() => {
    const nextMessage = message.trim();

    if (nextMessage.length === 0) {
      setAnnouncement((current) =>
        current.message.length === 0
          ? current
          : EMPTY_ANNOUNCEMENT,
      );
      return;
    }

    const announcementKey =
      eventId === undefined || eventId.length === 0
        ? nextMessage
        : eventId;

    if (lastAnnouncementKeyRef.current === announcementKey) {
      return;
    }

    lastAnnouncementKeyRef.current = announcementKey;
    setAnnouncement({
      key: announcementKey,
      message: nextMessage,
    });
  }, [eventId, message]);

  const accessibleLabel =
    label ??
    (livePriority === 'assertive'
      ? ACCESSIBILITY_MESSAGES.criticalRegionLabel
      : ACCESSIBILITY_MESSAGES.statusRegionLabel);

  return (
    <div
      aria-atomic="true"
      aria-label={accessibleLabel}
      aria-live={livePriority}
      aria-relevant="additions text"
      className={['sr-only', className].filter(Boolean).join(' ')}
      role={livePriority === 'assertive' ? 'alert' : 'status'}
    >
      {announcement.message.length > 0 ? (
        <span key={announcement.key}>{announcement.message}</span>
      ) : null}
    </div>
  );
}

LiveRegion.propTypes = {
  message: PropTypes.string,
  eventId: PropTypes.string,
  politeness: PropTypes.oneOf(['polite', 'assertive']),
  priority: PropTypes.oneOf(['polite', 'assertive']),
  label: PropTypes.string,
  className: PropTypes.string,
};

export default LiveRegion;