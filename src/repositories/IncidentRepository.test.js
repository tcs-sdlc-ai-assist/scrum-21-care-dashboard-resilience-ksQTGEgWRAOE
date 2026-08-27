import {
  CIRCUIT_STATES,
  DEPENDENCY_IDS,
  MAX_RECORDS,
  PROFILE_SOURCES,
  RECOVERY_STATUSES,
  SEVERITIES,
} from '../domain/constants.js';
import {
  ALERT_CHANNELS,
  INCIDENT_TYPES,
} from '../domain/model.js';
import { ACTIVE_PROFILE_ID } from '../fixtures/profiles.js';
import { REFERENCE_TIMESTAMP } from '../utils/clock.js';
import {
  IncidentRepository,
  createFallbackActivationIncident,
  createFallbackExpiryEvent,
  createFailoverIncident,
  createIncidentAlert,
  createOrderedRecoveryEvents,
} from './IncidentRepository.js';

/**
 * @param {number} [sequence]
 * @returns {object}
 */
function createFailoverInput(sequence = 1) {
  return {
    eventId: `evt-failover-${sequence}`,
    alertId: `alert-failover-${sequence}`,
    dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
    profileId: ACTIVE_PROFILE_ID,
    occurredAt: REFERENCE_TIMESTAMP + sequence,
    circuit: CIRCUIT_STATES.OPEN,
    dataSource: PROFILE_SOURCES.SECONDARY,
    severity: SEVERITIES.HIGH,
  };
}

/**
 * @param {number} [sequence]
 * @returns {object}
 */
function createFallbackInput(sequence = 1) {
  return {
    eventId: `evt-fallback-${sequence}`,
    alertId: `alert-fallback-${sequence}`,
    dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
    profileId: ACTIVE_PROFILE_ID,
    occurredAt: REFERENCE_TIMESTAMP + sequence,
    circuit: CIRCUIT_STATES.OPEN,
    severity: SEVERITIES.CRITICAL,
  };
}

/**
 * @param {number} sequence
 * @returns {object}
 */
function createAlertInput(sequence) {
  return {
    id: `alert-${sequence}`,
    incidentId: `evt-${sequence}`,
    channel: ALERT_CHANNELS.MOCK_SLACK,
    severity: SEVERITIES.MEDIUM,
    title: `Mock alert ${sequence}`,
    createdAt: REFERENCE_TIMESTAMP + sequence,
    acknowledged: false,
  };
}

describe('IncidentRepository', () => {
  describe('incident and alert factories', () => {
    it('creates a failover incident with every required field and a sanitized diagnostic', () => {
      const incident = createFailoverIncident(createFailoverInput());

      expect(incident).toEqual({
        eventId: 'evt-failover-1',
        type: INCIDENT_TYPES.FAILOVER,
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        severity: SEVERITIES.HIGH,
        condition: 'Mock primary dependency failover activated',
        circuit: CIRCUIT_STATES.OPEN,
        dataSource: PROFILE_SOURCES.SECONDARY,
        occurredAt: REFERENCE_TIMESTAMP + 1,
        recoveryStatus: RECOVERY_STATUSES.ACTIVE,
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
      expect(Object.keys(incident)).toEqual([
        'eventId',
        'type',
        'dependencyId',
        'severity',
        'condition',
        'circuit',
        'dataSource',
        'occurredAt',
        'recoveryStatus',
        'diagnosticSummary',
      ]);
      expect(Object.isFrozen(incident)).toBe(true);
      expect(incident.diagnosticSummary).not.toContain('account');
      expect(incident.diagnosticSummary).not.toContain('patient');
    });

    it('creates a fallback activation incident with fallback source and critical defaults', () => {
      const input = createFallbackInput();
      delete input.severity;

      const incident = createFallbackActivationIncident(input);

      expect(incident).toEqual({
        eventId: 'evt-fallback-1',
        type: INCIDENT_TYPES.FALLBACK_ACTIVATED,
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        severity: SEVERITIES.CRITICAL,
        condition: 'Browser local synthetic fallback activated',
        circuit: CIRCUIT_STATES.OPEN,
        dataSource: PROFILE_SOURCES.FALLBACK,
        occurredAt: REFERENCE_TIMESTAMP + 1,
        recoveryStatus: RECOVERY_STATUSES.ACTIVE,
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
    });

    it('creates a local-only alert with the complete validated alert contract', () => {
      const alert = createIncidentAlert(createAlertInput(1));

      expect(alert).toEqual({
        id: 'alert-1',
        incidentId: 'evt-1',
        channel: ALERT_CHANNELS.MOCK_SLACK,
        severity: SEVERITIES.MEDIUM,
        title: 'Mock alert 1',
        createdAt: REFERENCE_TIMESTAMP + 1,
        acknowledged: false,
      });
      expect(Object.keys(alert)).toEqual([
        'id',
        'incidentId',
        'channel',
        'severity',
        'title',
        'createdAt',
        'acknowledged',
      ]);
      expect(Object.isFrozen(alert)).toBe(true);
    });

    it('creates a fallback expiry event without retaining fallback profile data', () => {
      const event = createFallbackExpiryEvent({
        eventId: 'evt-expiry-1',
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        profileId: ACTIVE_PROFILE_ID,
        occurredAt: REFERENCE_TIMESTAMP + 100,
        circuit: CIRCUIT_STATES.OPEN,
      });

      expect(event).toMatchObject({
        eventId: 'evt-expiry-1',
        type: INCIDENT_TYPES.EXPIRY,
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        severity: SEVERITIES.MEDIUM,
        condition: 'Browser local synthetic fallback expired',
        circuit: CIRCUIT_STATES.OPEN,
        dataSource: PROFILE_SOURCES.NONE,
        recoveryStatus: RECOVERY_STATUSES.ACTIVE,
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
      expect(event).not.toHaveProperty('profile');
      expect(event).not.toHaveProperty('fallback');
      expect(event).not.toHaveProperty('accountNumber');
    });

    it('rejects malformed incident and alert input without storing unsafe records', () => {
      expect(() =>
        createFailoverIncident({
          ...createFailoverInput(),
          dependencyId: 'external-profile-service',
        }),
      ).toThrow('dependencyId must be a supported dependency');

      expect(() =>
        createFallbackActivationIncident({
          ...createFallbackInput(),
          profileId: 'MRN-123456',
        }),
      ).toThrow('profileId must match MOCK-####');

      expect(() =>
        createIncidentAlert({
          ...createAlertInput(1),
          channel: 'PAGERDUTY',
        }),
      ).toThrow('channel must be a supported mock alert channel');
    });
  });

  describe('failover and fallback recording', () => {
    it('records one failover incident, timeline event, and mock alert', () => {
      const repository = new IncidentRepository();

      const result = repository.recordFailover(
        createFailoverInput(),
      );

      expect(result.incident.type).toBe(INCIDENT_TYPES.FAILOVER);
      expect(result.alert).toMatchObject({
        id: 'alert-failover-1',
        incidentId: 'evt-failover-1',
        channel: ALERT_CHANNELS.MOCK_PAGERDUTY,
        severity: SEVERITIES.HIGH,
        title: 'Mock dependency failover',
        acknowledged: false,
      });
      expect(repository.getIncidents()).toEqual([result.incident]);
      expect(repository.getTimeline()).toEqual([result.incident]);
      expect(repository.getAlerts()).toEqual([result.alert]);
      expect(repository.getIncidentById(result.incident.eventId)).toBe(
        result.incident,
      );
      expect(repository.getAlertById(result.alert.id)).toBe(
        result.alert,
      );
    });

    it('records one fallback activation incident and corresponding critical alert', () => {
      const repository = new IncidentRepository();

      const result = repository.recordFallbackActivation(
        createFallbackInput(),
      );

      expect(result.incident).toMatchObject({
        type: INCIDENT_TYPES.FALLBACK_ACTIVATED,
        dataSource: PROFILE_SOURCES.FALLBACK,
        severity: SEVERITIES.CRITICAL,
        diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
      });
      expect(result.alert).toMatchObject({
        id: 'alert-fallback-1',
        incidentId: result.incident.eventId,
        channel: ALERT_CHANNELS.MOCK_PAGERDUTY,
        severity: SEVERITIES.CRITICAL,
        title: 'Mock synthetic fallback activated',
        acknowledged: false,
      });
      expect(repository.getIncidents()).toHaveLength(1);
      expect(repository.getTimeline()).toHaveLength(1);
      expect(repository.getAlerts()).toHaveLength(1);
    });

    it('treats a duplicate incident event identifier as idempotent', () => {
      const repository = new IncidentRepository();
      const input = createFailoverInput();

      const firstResult = repository.recordFailover(input);
      const duplicateResult = repository.recordFailover({
        ...input,
        alertId: 'alert-duplicate',
      });

      expect(duplicateResult.incident).toBe(firstResult.incident);
      expect(duplicateResult.alert).toBe(firstResult.alert);
      expect(repository.getIncidents()).toHaveLength(1);
      expect(repository.getTimeline()).toHaveLength(1);
      expect(repository.getAlerts()).toHaveLength(1);
      expect(
        repository.getAlertById('alert-duplicate'),
      ).toBeNull();
    });
  });

  describe('alert acknowledgement', () => {
    it('acknowledges an existing alert without creating a duplicate record', () => {
      const repository = new IncidentRepository();
      const firstAlert = repository.appendAlert(
        createAlertInput(1),
      );
      repository.appendAlert(createAlertInput(2));

      const acknowledged = repository.acknowledgeAlert(
        firstAlert.id,
      );

      expect(acknowledged).toEqual({
        ...firstAlert,
        acknowledged: true,
      });
      expect(Object.isFrozen(acknowledged)).toBe(true);
      expect(repository.getAlerts()).toHaveLength(2);
      expect(repository.getAlertById(firstAlert.id)).toBe(
        acknowledged,
      );
      expect(
        repository.getAlerts().filter(
          (alert) => alert.id === firstAlert.id,
        ),
      ).toHaveLength(1);
      expect(
        repository.acknowledgeAlert(firstAlert.id),
      ).toBe(acknowledged);
    });

    it('returns null when acknowledging an unknown alert identifier', () => {
      const repository = new IncidentRepository();

      expect(
        repository.acknowledgeAlert('alert-missing'),
      ).toBeNull();
      expect(repository.getAlerts()).toEqual([]);
    });
  });

  describe('ordered recovery timeline', () => {
    it('creates and stores HALF_OPEN before CLOSED recovery events', () => {
      const repository = new IncidentRepository();
      const input = {
        halfOpenEventId: 'evt-recovery-half-open',
        closedEventId: 'evt-recovery-closed',
        dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
        profileId: ACTIVE_PROFILE_ID,
        occurredAt: REFERENCE_TIMESTAMP + 500,
        severity: SEVERITIES.HIGH,
        dataSource: PROFILE_SOURCES.PRIMARY,
      };

      const createdEvents = createOrderedRecoveryEvents(input);
      const storedEvents = repository.recordRecovery(input);

      expect(createdEvents.map((event) => event.circuit)).toEqual([
        CIRCUIT_STATES.HALF_OPEN,
        CIRCUIT_STATES.CLOSED,
      ]);
      expect(storedEvents).toEqual(createdEvents);
      expect(repository.getTimeline()).toEqual([
        expect.objectContaining({
          eventId: 'evt-recovery-half-open',
          type: INCIDENT_TYPES.RECOVERY,
          condition: 'Mock recovery probe succeeded',
          circuit: CIRCUIT_STATES.HALF_OPEN,
          recoveryStatus: RECOVERY_STATUSES.RECOVERED,
          diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
        }),
        expect.objectContaining({
          eventId: 'evt-recovery-closed',
          type: INCIDENT_TYPES.RECOVERY,
          condition: 'Mock dependency recovery completed',
          circuit: CIRCUIT_STATES.CLOSED,
          recoveryStatus: RECOVERY_STATUSES.RECOVERED,
          diagnosticSummary: `mock-record-${ACTIVE_PROFILE_ID}`,
        }),
      ]);
      expect(repository.getIncidents()).toEqual([]);
      expect(repository.getAlerts()).toEqual([]);
      expect(Object.isFrozen(storedEvents)).toBe(true);
    });

    it('rejects recovery events with unsupported circuit state input', () => {
      expect(() =>
        createOrderedRecoveryEvents({
          halfOpenEventId: 'evt-recovery-half-open',
          closedEventId: 'evt-recovery-closed',
          dependencyId: 'unsupported-dependency',
          profileId: ACTIVE_PROFILE_ID,
          occurredAt: REFERENCE_TIMESTAMP,
        }),
      ).toThrow('dependencyId must be a supported dependency');
    });
  });

  describe('bounded records and reset', () => {
    it('keeps only the newest fifty incidents, timeline events, and alerts', () => {
      const repository = new IncidentRepository();
      const totalRecords = MAX_RECORDS + 5;

      for (let sequence = 1; sequence <= totalRecords; sequence += 1) {
        repository.appendIncident(
          createFailoverIncident(createFailoverInput(sequence)),
        );
        repository.appendAlert(
          createIncidentAlert(createAlertInput(sequence)),
        );
      }

      expect(repository.getIncidents()).toHaveLength(MAX_RECORDS);
      expect(repository.getTimeline()).toHaveLength(MAX_RECORDS);
      expect(repository.getAlerts()).toHaveLength(MAX_RECORDS);

      expect(repository.getIncidents()[0].eventId).toBe(
        'evt-failover-6',
      );
      expect(repository.getTimeline()[0].eventId).toBe(
        'evt-failover-6',
      );
      expect(repository.getAlerts()[0].id).toBe('alert-6');

      expect(
        repository.getIncidents()[MAX_RECORDS - 1].eventId,
      ).toBe(`evt-failover-${totalRecords}`);
      expect(
        repository.getAlerts()[MAX_RECORDS - 1].id,
      ).toBe(`alert-${totalRecords}`);

      expect(Object.isFrozen(repository.getIncidents())).toBe(true);
      expect(Object.isFrozen(repository.getTimeline())).toBe(true);
      expect(Object.isFrozen(repository.getAlerts())).toBe(true);
    });

    it('clears every repository record and deduplication identifier', () => {
      const repository = new IncidentRepository();
      const input = createFailoverInput();

      repository.recordFailover(input);
      repository.clear();

      expect(repository.getIncidents()).toEqual([]);
      expect(repository.getTimeline()).toEqual([]);
      expect(repository.getAlerts()).toEqual([]);
      expect(
        repository.getIncidentById(input.eventId),
      ).toBeNull();
      expect(
        repository.getAlertById(input.alertId),
      ).toBeNull();

      const recordedAgain = repository.recordFailover(input);

      expect(recordedAgain.incident.eventId).toBe(input.eventId);
      expect(repository.getIncidents()).toHaveLength(1);
      expect(repository.getTimeline()).toHaveLength(1);
      expect(repository.getAlerts()).toHaveLength(1);
    });
  });
});