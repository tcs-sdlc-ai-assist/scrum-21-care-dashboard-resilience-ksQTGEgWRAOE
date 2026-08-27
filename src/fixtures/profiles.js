import {
  MAX_PROFILES,
  PROFILE_SOURCES,
} from '../domain/constants.js';
import { createMockProfile } from '../domain/model.js';
import { REFERENCE_TIMESTAMP } from '../utils/clock.js';

export const ACTIVE_PROFILE_ID = 'MOCK-0042';

const SUPPORTED_PROFILE_SOURCES = Object.freeze([
  PROFILE_SOURCES.PRIMARY,
  PROFILE_SOURCES.SECONDARY,
  PROFILE_SOURCES.FALLBACK,
]);

/**
 * @param {number} sequence
 * @returns {string}
 */
function formatProfileId(sequence) {
  return `MOCK-${String(sequence).padStart(4, '0')}`;
}

/**
 * @param {string} source
 * @returns {string}
 */
function getSourceIdSegment(source) {
  return source.toLowerCase();
}

/**
 * Creates a validated synthetic profile fixture.
 *
 * @param {number} sequence
 * @param {'PRIMARY'|'SECONDARY'|'FALLBACK'} [source]
 * @param {number} [generatedAt]
 * @returns {ReturnType<typeof createMockProfile>}
 */
export function createSyntheticProfileFixture(
  sequence,
  source = PROFILE_SOURCES.PRIMARY,
  generatedAt = REFERENCE_TIMESTAMP,
) {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    sequence > MAX_PROFILES
  ) {
    throw new RangeError(
      `sequence must be an integer between 1 and ${MAX_PROFILES}`,
    );
  }

  if (!SUPPORTED_PROFILE_SOURCES.includes(source)) {
    throw new TypeError(
      'source must be PRIMARY, SECONDARY, or FALLBACK',
    );
  }

  const patientIdentifier = formatProfileId(sequence);
  const suffix = String(sequence).padStart(4, '0');

  return createMockProfile({
    id: `profile-${getSourceIdSegment(source)}-${patientIdentifier}`,
    displayName: `Synthetic Patient ${suffix}`,
    patientIdentifier,
    accountNumber: `****${suffix}`,
    source,
    generatedAt,
  });
}

export const PROFILE_FIXTURES = Object.freeze(
  Array.from({ length: MAX_PROFILES }, (_, index) =>
    createSyntheticProfileFixture(index + 1),
  ),
);

export const GENERATED_PROFILE_FIXTURES = PROFILE_FIXTURES;
export const SYNTHETIC_PROFILE_FIXTURES = PROFILE_FIXTURES;

const PROFILE_FIXTURES_BY_ID = new Map(
  PROFILE_FIXTURES.map((profile) => [profile.patientIdentifier, profile]),
);

export const ACTIVE_PRIMARY_PROFILE = PROFILE_FIXTURES_BY_ID.get(
  ACTIVE_PROFILE_ID,
);

export const ACTIVE_SECONDARY_PROFILE = createSyntheticProfileFixture(
  42,
  PROFILE_SOURCES.SECONDARY,
);

export const PRIMARY_PROFILE_FIXTURE = ACTIVE_PRIMARY_PROFILE;
export const SECONDARY_PROFILE_FIXTURE = ACTIVE_SECONDARY_PROFILE;

export const ACTIVE_PROFILE_FIXTURES = Object.freeze({
  primary: ACTIVE_PRIMARY_PROFILE,
  secondary: ACTIVE_SECONDARY_PROFILE,
});

/**
 * Returns a synthetic fixture for a supported mock profile identifier.
 *
 * @param {unknown} profileId
 * @param {'PRIMARY'|'SECONDARY'|'FALLBACK'} [source]
 * @param {number} [generatedAt]
 * @returns {ReturnType<typeof createMockProfile>|null}
 */
export function getProfileFixture(
  profileId,
  source = PROFILE_SOURCES.PRIMARY,
  generatedAt = REFERENCE_TIMESTAMP,
) {
  if (
    typeof profileId !== 'string' ||
    !PROFILE_FIXTURES_BY_ID.has(profileId)
  ) {
    return null;
  }

  if (!SUPPORTED_PROFILE_SOURCES.includes(source)) {
    throw new TypeError(
      'source must be PRIMARY, SECONDARY, or FALLBACK',
    );
  }

  const primaryFixture = PROFILE_FIXTURES_BY_ID.get(profileId);

  if (
    source === PROFILE_SOURCES.PRIMARY &&
    generatedAt === REFERENCE_TIMESTAMP
  ) {
    return primaryFixture;
  }

  const sequence = Number.parseInt(profileId.slice(-4), 10);
  return createSyntheticProfileFixture(sequence, source, generatedAt);
}

export const getSyntheticProfileFixture = getProfileFixture;

export default PROFILE_FIXTURES;