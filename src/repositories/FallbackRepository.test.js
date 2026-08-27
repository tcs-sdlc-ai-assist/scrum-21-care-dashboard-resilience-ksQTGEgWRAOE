import {
  FALLBACK_TTL_MS,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import {
  ACTIVE_PROFILE_ID,
  getProfileFixture,
} from '../fixtures/profiles.js';
import { REFERENCE_TIMESTAMP } from '../utils/clock.js';
import { FallbackRepository } from './FallbackRepository.js';

/**
 * @param {string} [profileId]
 * @param {number} [generatedAt]
 * @returns {NonNullable<ReturnType<typeof getProfileFixture>>}
 */
function getFallbackProfile(
  profileId = ACTIVE_PROFILE_ID,
  generatedAt = REFERENCE_TIMESTAMP,
) {
  const profile = getProfileFixture(
    profileId,
    PROFILE_SOURCES.FALLBACK,
    generatedAt,
  );

  if (profile === null) {
    throw new Error('Expected a synthetic fallback profile fixture');
  }

  return profile;
}

describe('FallbackRepository', () => {
  describe('memory-only storage and profile association', () => {
    it('stores and retrieves an immutable fallback for its synthetic profile', () => {
      const repository = new FallbackRepository();
      const profile = getFallbackProfile();

      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        profile,
        REFERENCE_TIMESTAMP,
      );

      expect(fallback).toEqual({
        id: 'fallback-1',
        profileId: ACTIVE_PROFILE_ID,
        data: profile,
        createdAt: REFERENCE_TIMESTAMP,
        expiresAt: REFERENCE_TIMESTAMP + FALLBACK_TTL_MS,
        timerRevision: 1,
      });
      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        REFERENCE_TIMESTAMP,
      )).toBe(fallback);
      expect(repository.getById(fallback.id)).toBe(fallback);
      expect(Object.isFrozen(fallback)).toBe(true);
      expect(Object.isFrozen(fallback.data)).toBe(true);
    });

    it('returns null when no fallback exists for a supported profile', () => {
      const repository = new FallbackRepository();

      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        REFERENCE_TIMESTAMP,
      )).toBeNull();
      expect(repository.getById('fallback-missing')).toBeNull();
    });

    it('rejects a fallback profile associated with a different profile identifier', () => {
      const repository = new FallbackRepository();
      const otherProfile = getFallbackProfile(
        'MOCK-0043',
        REFERENCE_TIMESTAMP,
      );

      expect(() =>
        repository.put(
          ACTIVE_PROFILE_ID,
          otherProfile,
          REFERENCE_TIMESTAMP,
        ),
      ).toThrow('fallback profile must belong to profileId');

      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        REFERENCE_TIMESTAMP,
      )).toBeNull();
    });
  });

  describe('four-hour TTL and countdown boundaries', () => {
    it('uses the exact four-hour TTL by default', () => {
      const repository = new FallbackRepository();
      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );

      expect(FALLBACK_TTL_MS).toBe(14_400_000);
      expect(fallback.expiresAt - fallback.createdAt).toBe(
        FALLBACK_TTL_MS,
      );
      expect(fallback.expiresAt).toBe(
        REFERENCE_TIMESTAMP + 4 * 60 * 60 * 1_000,
      );
    });

    it('returns the fallback immediately before expiry and removes it at the exact expiry boundary', () => {
      const repository = new FallbackRepository();
      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );

      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        fallback.expiresAt - 1,
      )).toBe(fallback);
      expect(fallback.expiresAt - (fallback.expiresAt - 1)).toBe(1);

      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        fallback.expiresAt,
      )).toBeNull();
      expect(repository.getById(fallback.id)).toBeNull();
    });

    it('supports a positive custom TTL while rejecting invalid durations', () => {
      const repository = new FallbackRepository();
      const profile = getFallbackProfile();
      const customTtlMs = 1_000;

      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        profile,
        REFERENCE_TIMESTAMP,
        customTtlMs,
      );

      expect(fallback.expiresAt).toBe(
        REFERENCE_TIMESTAMP + customTtlMs,
      );

      expect(() =>
        repository.put(
          ACTIVE_PROFILE_ID,
          profile,
          REFERENCE_TIMESTAMP,
          0,
        ),
      ).toThrow('ttlMs must be a positive safe integer');
    });
  });

  describe('explicit expiry and removal', () => {
    it('expires a matching revision only after the expiry timestamp is reached', () => {
      const repository = new FallbackRepository();
      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );

      expect(repository.expire(
        fallback.id,
        fallback.timerRevision,
        fallback.expiresAt - 1,
      )).toBe(false);
      expect(repository.getById(fallback.id)).toBe(fallback);

      expect(repository.expire(
        fallback.id,
        fallback.timerRevision,
        fallback.expiresAt,
      )).toBe(true);
      expect(repository.getById(fallback.id)).toBeNull();
      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        fallback.expiresAt,
      )).toBeNull();
    });

    it('does not expire a current fallback when the timer revision is stale', () => {
      const repository = new FallbackRepository();
      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );

      expect(repository.expire(
        fallback.id,
        fallback.timerRevision + 1,
        fallback.expiresAt,
      )).toBe(false);
      expect(repository.getById(fallback.id)).toBe(fallback);
    });

    it('removes a fallback by repository identifier idempotently', () => {
      const repository = new FallbackRepository();
      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );

      expect(repository.remove(fallback.id)).toBe(true);
      expect(repository.remove(fallback.id)).toBe(false);
      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        REFERENCE_TIMESTAMP,
      )).toBeNull();
    });
  });

  describe('replacement revisions and reset clearing', () => {
    it('replaces the fallback for a profile with a new identifier and timer revision', () => {
      const repository = new FallbackRepository();
      const firstFallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );
      const replacementTime = REFERENCE_TIMESTAMP + 1_000;
      const replacement = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(ACTIVE_PROFILE_ID, replacementTime),
        replacementTime,
      );

      expect(replacement.id).not.toBe(firstFallback.id);
      expect(replacement.timerRevision).toBe(
        firstFallback.timerRevision + 1,
      );
      expect(replacement.createdAt).toBe(replacementTime);
      expect(repository.getById(firstFallback.id)).toBeNull();
      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        replacementTime,
      )).toBe(replacement);

      expect(repository.expire(
        firstFallback.id,
        firstFallback.timerRevision,
        firstFallback.expiresAt,
      )).toBe(false);
      expect(repository.getById(replacement.id)).toBe(replacement);
    });

    it('clears all memory-only fallback records while preserving monotonic revisions', () => {
      const repository = new FallbackRepository();
      const firstFallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );

      repository.clear();

      expect(repository.getValid(
        ACTIVE_PROFILE_ID,
        REFERENCE_TIMESTAMP,
      )).toBeNull();
      expect(repository.getById(firstFallback.id)).toBeNull();

      const nextTimestamp = REFERENCE_TIMESTAMP + 1;
      const nextFallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(ACTIVE_PROFILE_ID, nextTimestamp),
        nextTimestamp,
      );

      expect(nextFallback.id).toBe('fallback-2');
      expect(nextFallback.timerRevision).toBe(2);
      expect(nextFallback.id).not.toBe(firstFallback.id);
      expect(nextFallback.timerRevision).toBeGreaterThan(
        firstFallback.timerRevision,
      );
    });
  });

  describe('local retrieval performance', () => {
    it('retrieves a valid in-memory fallback in less than 500 milliseconds', () => {
      const repository = new FallbackRepository();
      const fallback = repository.put(
        ACTIVE_PROFILE_ID,
        getFallbackProfile(),
        REFERENCE_TIMESTAMP,
      );
      const startedAt = performance.now();

      const result = repository.getValid(
        ACTIVE_PROFILE_ID,
        REFERENCE_TIMESTAMP + 1,
      );

      const elapsedMs = performance.now() - startedAt;

      expect(result).toBe(fallback);
      expect(elapsedMs).toBeGreaterThanOrEqual(0);
      expect(elapsedMs).toBeLessThan(500);
    });
  });
});