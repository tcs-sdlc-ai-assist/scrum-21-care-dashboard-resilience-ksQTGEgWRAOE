import {
  assertSafeForLogging,
  assertSafeForPersistence,
  containsProhibitedFields,
  findProhibitedFields,
  getSyntheticRecordValidationErrors,
  isSafeForLogging,
  isSafeForPersistence,
  maskAccountNumber,
  maskDateOfBirth,
  maskEmail,
  maskPatientIdentifier,
  maskPhoneNumber,
  maskPii,
  maskPiiValue,
  sanitizeDiagnosticSummary,
  validateSyntheticRecord,
} from './privacy.js';
import { PROFILE_FIXTURES } from '../fixtures/profiles.js';

describe('privacy utilities', () => {
  describe('direct masking helpers', () => {
    it('masks supported PII while retaining only approved identifying fragments', () => {
      expect(maskEmail('clinical.staff@demo.example')).toBe(
        'c***@d***.example',
      );
      expect(maskPhoneNumber('+1 (555) 867-5309')).toBe(
        '***-***-5309',
      );
      expect(maskAccountNumber('12345678')).toBe('****5678');
      expect(maskAccountNumber('****0042')).toBe('****0042');
      expect(maskPatientIdentifier('MOCK-0042')).toBe('MOCK-0042');
      expect(maskDateOfBirth('1980-01-02')).toBe('****-**-**');
    });

    it('redacts malformed or realistic identifiers that cannot be safely masked', () => {
      expect(maskEmail('not-an-email')).toBe('[redacted]');
      expect(maskEmail(null)).toBe('[redacted]');
      expect(maskPhoneNumber('123')).toBe('[redacted]');
      expect(maskAccountNumber('12')).toBe('[redacted]');
      expect(maskPatientIdentifier('MRN-123456')).toBe('[redacted]');
      expect(maskPatientIdentifier('123-45-6789')).toBe('[redacted]');
      expect(maskDateOfBirth(undefined)).toBe('[redacted]');
    });

    it('uses field-aware masking without exposing credentials or names', () => {
      expect(maskPiiValue('emailAddress', 'person@example.com')).toBe(
        'p***@e***.com',
      );
      expect(maskPiiValue('phone_number', '5558675309')).toBe(
        '***-***-5309',
      );
      expect(maskPiiValue('account-number', '99887766')).toBe(
        '****7766',
      );
      expect(maskPiiValue('patientId', 'REAL-1234')).toBe(
        '[redacted]',
      );
      expect(maskPiiValue('password', 'not-a-real-password')).toBe(
        '[redacted]',
      );
      expect(maskPiiValue('full_name', 'Example Person')).toBe(
        '[redacted]',
      );
      expect(maskPiiValue('dependencyId', 'profile-primary')).toBe(
        'profile-primary',
      );
    });
  });

  describe('recursive PII masking', () => {
    it('returns a masked copy without mutating nested source data', () => {
      const input = {
        email: 'person@example.com',
        patientIdentifier: 'MOCK-0042',
        nested: {
          accountNumber: '12345678',
          password: 'not-a-real-password',
          dependencyId: 'profile-primary',
        },
        createdAt: new Date('2026-08-27T00:00:00.000Z'),
      };

      const result = maskPii(input);

      expect(result).toEqual({
        email: 'p***@e***.com',
        patientIdentifier: 'MOCK-0042',
        nested: {
          accountNumber: '****5678',
          password: '[redacted]',
          dependencyId: 'profile-primary',
        },
        createdAt: '2026-08-27T00:00:00.000Z',
      });
      expect(input.email).toBe('person@example.com');
      expect(input.nested.accountNumber).toBe('12345678');
      expect(input.nested.password).toBe('not-a-real-password');
    });

    it('redacts cyclic references instead of traversing indefinitely', () => {
      const input = {
        eventId: 'evt-1',
      };
      input.self = input;

      expect(maskPii(input)).toEqual({
        eventId: 'evt-1',
        self: '[redacted]',
      });
    });
  });

  describe('diagnostic sanitization', () => {
    it('retains only a valid synthetic mock record identifier', () => {
      expect(
        sanitizeDiagnosticSummary(
          'Recovery completed for MOCK-0042 after a local probe',
        ),
      ).toBe('mock-record-MOCK-0042');
      expect(
        sanitizeDiagnosticSummary('mock-record-MOCK-0099'),
      ).toBe('mock-record-MOCK-0099');
    });

    it('replaces realistic, malformed, or non-string diagnostics with the safe default', () => {
      expect(
        sanitizeDiagnosticSummary(
          'Patient MRN 123456 and account 99887766 failed',
        ),
      ).toBe('mock-record-MOCK-0000');
      expect(sanitizeDiagnosticSummary('MOCK-42')).toBe(
        'mock-record-MOCK-0000',
      );
      expect(sanitizeDiagnosticSummary({ recordId: 'MOCK-0042' })).toBe(
        'mock-record-MOCK-0000',
      );
    });
  });

  describe('synthetic fixture validation', () => {
    it('accepts every bounded synthetic profile fixture without validation errors', () => {
      expect(PROFILE_FIXTURES).toHaveLength(100);

      PROFILE_FIXTURES.forEach((profile) => {
        expect(validateSyntheticRecord(profile)).toBe(true);
        expect(getSyntheticRecordValidationErrors(profile)).toEqual([]);
        expect(profile.patientIdentifier).toMatch(/^MOCK-\d{4}$/);
        expect(profile.accountNumber).toMatch(/^\*{4}\d{4}$/);
        expect(profile.displayName).toMatch(
          /^Synthetic Patient \d{4}$/,
        );
        expect(['PRIMARY', 'SECONDARY', 'FALLBACK']).toContain(
          profile.source,
        );
      });
    });

    it('finds no realistic email, social security number, or unmasked account in profile fixtures', () => {
      const serializedFixtures = JSON.stringify(PROFILE_FIXTURES);

      expect(serializedFixtures).not.toMatch(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      );
      expect(serializedFixtures).not.toMatch(
        /\b\d{3}-\d{2}-\d{4}\b/,
      );

      PROFILE_FIXTURES.forEach((profile) => {
        expect(profile.accountNumber).not.toMatch(/^\d{8,}$/);
        expect(profile.patientIdentifier).not.toMatch(/^(?:MRN|PAT)-/i);
      });
    });

    it('rejects realistic or unmasked profile records and reports unsafe fields', () => {
      const realisticRecord = {
        id: 'patient-12345',
        displayName: 'Jane Patient',
        patientIdentifier: 'MRN-123456',
        accountNumber: '99887766',
        source: 'PRIMARY',
        generatedAt: Date.parse('2026-08-27T00:00:00.000Z'),
      };

      expect(validateSyntheticRecord(realisticRecord)).toBe(false);
      expect(
        getSyntheticRecordValidationErrors(realisticRecord),
      ).toEqual(
        expect.arrayContaining([
          'patientIdentifier',
          'accountNumber',
          'displayName',
        ]),
      );

      expect(
        validateSyntheticRecord({
          ...PROFILE_FIXTURES[0],
          accountNumber: '12345678',
        }),
      ).toBe(false);
    });

    it('rejects missing, malformed, and unsupported synthetic record fields', () => {
      expect(validateSyntheticRecord(null)).toBe(false);
      expect(getSyntheticRecordValidationErrors(null)).toEqual([
        'record',
      ]);

      const errors = getSyntheticRecordValidationErrors({
        id: 'unsafe id',
        displayName: 'Real Person',
        patientIdentifier: 'MOCK-000',
        accountNumber: '****123',
        source: 'REMOTE',
        generatedAt: 'not-a-date',
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          'patientIdentifier',
          'accountNumber',
          'displayName',
          'id',
          'source',
          'generatedAt',
        ]),
      );
    });
  });

  describe('forbidden-field detection', () => {
    it('finds normalized prohibited fields and returns their nested paths', () => {
      const value = {
        preferences: {
          reducedMotion: true,
          density: 'comfortable',
        },
        runtime: {
          profile: {
            patientIdentifier: 'MOCK-0042',
          },
          incidents: [],
          diagnostic_payload: 'details',
        },
      };

      const paths = findProhibitedFields(value);

      expect(paths).toEqual(
        expect.arrayContaining([
          'runtime.profile',
          'runtime.profile.patientIdentifier',
          'runtime.incidents',
          'runtime.diagnostic_payload',
        ]),
      );
      expect(containsProhibitedFields(value)).toBe(true);
    });

    it('supports custom prohibited-field allowlists and safely handles clean values', () => {
      const value = {
        eventId: 'evt-1',
        metadata: {
          secretToken: 'synthetic-token',
        },
      };

      expect(
        findProhibitedFields(value, ['secret-token']),
      ).toEqual(['metadata.secretToken']);
      expect(
        containsProhibitedFields(
          {
            eventId: 'evt-1',
            dependencyId: 'profile-primary',
            timestamp: 0,
          },
          ['profile', 'password'],
        ),
      ).toBe(false);
    });
  });

  describe('persistence and logging guards', () => {
    it('accepts allowlisted operational metadata for persistence and logging', () => {
      const metadata = {
        eventId: 'evt-1',
        dependencyId: 'profile-primary',
        role: 'sre',
        timestamp: 0,
      };

      expect(isSafeForPersistence(metadata)).toBe(true);
      expect(isSafeForLogging(metadata)).toBe(true);
      expect(() => assertSafeForPersistence(metadata)).not.toThrow();
      expect(() => assertSafeForLogging(metadata)).not.toThrow();
    });

    it('rejects credentials, profile data, realistic PII, and diagnostic payloads', () => {
      const unsafePersistenceValue = {
        preferences: {
          density: 'comfortable',
        },
        profile: {
          displayName: 'Jane Patient',
          accountNumber: '99887766',
        },
      };
      const unsafeLogValue = {
        eventId: 'evt-1',
        email: 'person@example.com',
        password: 'not-a-real-password',
        diagnosticSummary: 'Patient account 99887766',
      };

      expect(isSafeForPersistence(unsafePersistenceValue)).toBe(false);
      expect(isSafeForLogging(unsafeLogValue)).toBe(false);
      expect(() =>
        assertSafeForPersistence(unsafePersistenceValue),
      ).toThrow('Value contains fields prohibited from persistence');
      expect(() => assertSafeForLogging(unsafeLogValue)).toThrow(
        'Value contains fields prohibited from logging',
      );
    });
  });
});