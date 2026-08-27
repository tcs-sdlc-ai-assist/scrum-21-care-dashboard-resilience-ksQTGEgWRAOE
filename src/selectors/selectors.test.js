import {
  CIRCUIT_FAILURE_THRESHOLD,
  DEPENDENCY_IDS,
  HEALTH_STATES,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import { createInitialSnapshot } from '../domain/model.js';
import { createResilienceEngine } from '../engine/ResilienceEngine.js';
import { ACTIVE_PROFILE_ID } from '../fixtures/profiles.js';
import {
  selectPrivacySafeClinicalModel,
  selectPrivacySafeSreModel,
} from './PrivacySelectors.js';
import {
  selectClinicalModel,
  selectFallbackBanner,
  selectSreModel,
} from './ViewModelSelectors.js';
import {
  FakeClock,
  REFERENCE_TIMESTAMP,
} from '../utils/clock.js';
import { findProhibitedFields } from '../utils/privacy.js';

const FIXED_DEPENDENCY_IDS = Object.freeze([
  DEPENDENCY_IDS.PROFILE_PRIMARY,
  DEPENDENCY_IDS.PROFILE_SECONDARY,
  DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
]);

/**
 * @param {ReturnType<typeof createResilienceEngine>} engine
 * @param {string} dependencyId
 * @param {string} status
 * @returns {object}
 */
function applyHealth(engine, dependencyId, status) {
  const result = engine.simulateHealth({
    dependencyId,
    status,
  });

  if (!result.ok) {
    throw new Error(
      `Expected health simulation to succeed: ${result.error.code}`,
    );
  }

  return result;
}

/**
 * @param {ReturnType<typeof createResilienceEngine>} engine
 * @returns {object}
 */
function activateFallback(engine) {
  for (
    let attempt = 0;
    attempt < CIRCUIT_FAILURE_THRESHOLD;
    attempt += 1
  ) {
    applyHealth(
      engine,
      DEPENDENCY_IDS.PROFILE_PRIMARY,
      HEALTH_STATES.FAILED,
    );
  }

  applyHealth(
    engine,
    DEPENDENCY_IDS.PROFILE_SECONDARY,
    HEALTH_STATES.FAILED,
  );

  const result = engine.requestProfile({
    profileId: ACTIVE_PROFILE_ID,
  });

  if (!result.ok) {
    throw new Error(
      `Expected fallback activation to succeed: ${result.error.code}`,
    );
  }

  return result;
}

describe('cross-cluster selector contracts', () => {
  it('derives consistent Clinical and SRE view models from one immutable snapshot', () => {
    const snapshot = createInitialSnapshot(REFERENCE_TIMESTAMP);
    const clinicalModel = selectClinicalModel(snapshot);
    const sreModel = selectSreModel(snapshot);
    const privacySafeClinicalModel =
      selectPrivacySafeClinicalModel(snapshot);
    const privacySafeSreModel = selectPrivacySafeSreModel(snapshot);
    const contextDependency = sreModel.dependencies.find(
      (dependency) =>
        dependency.dependencyId ===
        DEPENDENCY_IDS.CONTEXT_ELIGIBILITY,
    );

    expect(clinicalModel).toMatchObject({
      profile: null,
      profileSource: PROFILE_SOURCES.NONE,
      available: false,
      fallbackActive: false,
      fallbackExpiresAt: null,
    });
    expect(privacySafeClinicalModel).toMatchObject({
      profile: null,
      profileSource: clinicalModel.profileSource,
      available: clinicalModel.available,
      fallbackActive: clinicalModel.fallbackActive,
      fallbackExpiresAt: clinicalModel.fallbackExpiresAt,
    });

    expect(sreModel.dependencies).toHaveLength(3);
    expect(
      sreModel.dependencies.map(
        (dependency) => dependency.dependencyId,
      ),
    ).toEqual(FIXED_DEPENDENCY_IDS);
    expect(
      privacySafeSreModel.dependencies.map(
        (dependency) => dependency.dependencyId,
      ),
    ).toEqual(FIXED_DEPENDENCY_IDS);

    expect(clinicalModel.contextEligibility).toEqual({
      dependencyId: contextDependency.dependencyId,
      displayName: contextDependency.displayName,
      status: contextDependency.status,
      available: contextDependency.isUsable,
      lastCheckedAt: contextDependency.lastCheckedAt,
    });
    expect(
      privacySafeClinicalModel.contextEligibility.status,
    ).toBe(contextDependency.status);

    expect(Object.isFrozen(clinicalModel)).toBe(true);
    expect(Object.isFrozen(sreModel)).toBe(true);
    expect(Object.isFrozen(sreModel.dependencies)).toBe(true);
    expect(Object.isFrozen(privacySafeClinicalModel)).toBe(true);
    expect(Object.isFrozen(privacySafeSreModel)).toBe(true);
  });

  it('projects fallback state without exposing raw fallback or profile payload fields to the SRE model', () => {
    const clock = new FakeClock(REFERENCE_TIMESTAMP);
    const engine = createResilienceEngine({ clock });
    const activation = activateFallback(engine);
    const snapshot = activation.snapshot;
    const clinicalModel =
      selectPrivacySafeClinicalModel(snapshot);
    const sreModel = selectPrivacySafeSreModel(snapshot);

    expect(clinicalModel).toMatchObject({
      profileSource: PROFILE_SOURCES.FALLBACK,
      available: true,
      fallbackActive: true,
      fallbackExpiresAt: snapshot.fallback.expiresAt,
    });
    expect(Object.keys(clinicalModel)).toEqual([
      'profile',
      'profileSource',
      'available',
      'fallbackActive',
      'fallbackExpiresAt',
      'contextEligibility',
    ]);
    expect(clinicalModel.profile).not.toBeNull();
    expect(Object.keys(clinicalModel.profile)).toEqual([
      'displayName',
      'patientIdentifier',
      'accountNumber',
      'source',
      'generatedAt',
    ]);
    expect(clinicalModel.profile).not.toHaveProperty('id');
    expect(clinicalModel.profile).not.toHaveProperty('profileId');
    expect(clinicalModel.profile).not.toHaveProperty('timerRevision');

    expect(
      findProhibitedFields(sreModel, [
        'profile',
        'profiles',
        'fallback',
        'data',
        'patientIdentifier',
        'accountNumber',
        'timerRevision',
        'credentials',
        'password',
      ]),
    ).toEqual([]);
    expect(JSON.stringify(sreModel)).not.toContain(
      clinicalModel.profile.displayName,
    );
    expect(JSON.stringify(sreModel)).not.toContain(
      clinicalModel.profile.accountNumber,
    );
    expect(sreModel.dependencies).toHaveLength(3);
    expect(
      sreModel.dependencies.map(
        (dependency) => dependency.dependencyId,
      ),
    ).toEqual(FIXED_DEPENDENCY_IDS);

    engine.stop();
  });

  it('re-keys the fallback banner when a later fallback activation creates a new event', () => {
    const clock = new FakeClock(REFERENCE_TIMESTAMP);
    const engine = createResilienceEngine({ clock });
    const firstActivation = activateFallback(engine);
    const firstBanner = selectFallbackBanner(
      firstActivation.snapshot,
    );
    const firstFallbackId = firstActivation.snapshot.fallback.id;

    const recovery = engine.simulateRecovery({
      dependencyId: DEPENDENCY_IDS.PROFILE_PRIMARY,
      profileId: ACTIVE_PROFILE_ID,
    });

    expect(recovery.ok).toBe(true);
    expect(selectFallbackBanner(recovery.snapshot)).toBeNull();

    const secondActivation = activateFallback(engine);
    const secondBanner = selectFallbackBanner(
      secondActivation.snapshot,
    );
    const bannerWithOldDismissal = selectFallbackBanner(
      secondActivation.snapshot,
      firstBanner.eventId,
    );

    expect(firstBanner).not.toBeNull();
    expect(secondBanner).not.toBeNull();
    expect(secondBanner.eventId).not.toBe(firstBanner.eventId);
    expect(secondActivation.snapshot.fallback.id).not.toBe(
      firstFallbackId,
    );
    expect(secondBanner).toMatchObject({
      eventId: secondActivation.eventId,
      critical: true,
      dismissible: false,
      profileSource: PROFILE_SOURCES.FALLBACK,
    });
    expect(bannerWithOldDismissal?.eventId).toBe(
      secondBanner.eventId,
    );

    engine.stop();
  });

  it('rejects malformed snapshots that do not contain exactly the three fixed dependencies', () => {
    const snapshot = createInitialSnapshot(REFERENCE_TIMESTAMP);
    const malformedSnapshot = {
      ...snapshot,
      dependencies: snapshot.dependencies.slice(0, 2),
    };

    expect(() =>
      selectClinicalModel(malformedSnapshot),
    ).toThrow('dependencies must contain exactly 3 records');
    expect(() =>
      selectSreModel(malformedSnapshot),
    ).toThrow('dependencies must contain exactly 3 records');
    expect(() =>
      selectPrivacySafeClinicalModel(malformedSnapshot),
    ).toThrow('dependencies must contain exactly 3 records');
    expect(() =>
      selectPrivacySafeSreModel(malformedSnapshot),
    ).toThrow('dependencies must contain exactly 3 records');
  });
});