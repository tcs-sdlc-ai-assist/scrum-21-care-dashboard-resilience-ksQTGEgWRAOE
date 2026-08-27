import {
  DEFAULT_PREFERENCES,
  DEFAULT_SCENARIO,
  PREFERENCES_STORAGE_KEY,
  SCENARIO_STORAGE_KEY,
  clearStoredSettings,
  loadPreferences,
  loadScenario,
  savePreferences,
  saveScenario,
} from './preferencesStore.js';

/**
 * @param {Record<string, string>} [initialValues]
 * @returns {{
 *   getItem: ReturnType<typeof vi.fn>,
 *   setItem: ReturnType<typeof vi.fn>,
 *   removeItem: ReturnType<typeof vi.fn>,
 *   values: Map<string, string>
 * }}
 */
function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    values,
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      values.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
  };
}

describe('preferencesStore', () => {
  describe('preference persistence', () => {
    it('saves and loads exact allowlisted preferences', () => {
      const storage = createMemoryStorage();
      const preferences = {
        reducedMotion: true,
        density: 'compact',
      };

      expect(savePreferences(preferences, storage)).toBe(true);
      expect(storage.setItem).toHaveBeenCalledWith(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );

      const loadedPreferences = loadPreferences(storage);

      expect(loadedPreferences).toEqual(preferences);
      expect(Object.isFrozen(loadedPreferences)).toBe(true);
    });

    it('returns immutable defaults when no preference record exists', () => {
      const storage = createMemoryStorage();

      expect(loadPreferences(storage)).toBe(DEFAULT_PREFERENCES);
      expect(loadPreferences(storage)).toEqual({
        reducedMotion: false,
        density: 'comfortable',
      });
      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'an unknown field',
        value: {
          reducedMotion: false,
          density: 'comfortable',
          theme: 'dark',
        },
      },
      {
        name: 'a missing field',
        value: {
          density: 'comfortable',
        },
      },
      {
        name: 'an unsupported density',
        value: {
          reducedMotion: false,
          density: 'dense',
        },
      },
      {
        name: 'an invalid reduced-motion type',
        value: {
          reducedMotion: 'false',
          density: 'comfortable',
        },
      },
    ])('rejects preferences containing $name', ({ value }) => {
      const storage = createMemoryStorage({
        [PREFERENCES_STORAGE_KEY]: 'previous-value',
      });

      expect(savePreferences(value, storage)).toBe(false);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).toHaveBeenCalledWith(
        PREFERENCES_STORAGE_KEY,
      );
      expect(storage.values.has(PREFERENCES_STORAGE_KEY)).toBe(false);
    });

    it.each([
      ['credentials', { credentials: { password: 'synthetic-secret' } }],
      [
        'patient profiles',
        {
          profile: {
            patientIdentifier: 'MOCK-0042',
            accountNumber: '****0042',
          },
        },
      ],
      ['incidents', { incidents: [{ eventId: 'evt-1' }] }],
      [
        'diagnostics',
        { diagnosticSummary: 'mock-record-MOCK-0042' },
      ],
      [
        'telemetry',
        {
          telemetry: [
            {
              dependencyId: 'profile-primary',
              responseTimeMs: 120,
            },
          ],
        },
      ],
    ])('does not persist %s in the preference record', (_, sensitiveValue) => {
      const storage = createMemoryStorage();
      const attemptedPreferences = {
        reducedMotion: false,
        density: 'comfortable',
        ...sensitiveValue,
      };

      expect(savePreferences(attemptedPreferences, storage)).toBe(false);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.values.has(PREFERENCES_STORAGE_KEY)).toBe(false);
    });

    it('removes malformed preference JSON and restores defaults', () => {
      const storage = createMemoryStorage({
        [PREFERENCES_STORAGE_KEY]: '{"reducedMotion":true,',
      });

      expect(loadPreferences(storage)).toBe(DEFAULT_PREFERENCES);
      expect(storage.removeItem).toHaveBeenCalledWith(
        PREFERENCES_STORAGE_KEY,
      );
      expect(storage.values.has(PREFERENCES_STORAGE_KEY)).toBe(false);
    });

    it('removes oversized preference values without parsing them', () => {
      const storage = createMemoryStorage({
        [PREFERENCES_STORAGE_KEY]: 'x'.repeat(2_049),
      });

      expect(loadPreferences(storage)).toBe(DEFAULT_PREFERENCES);
      expect(storage.removeItem).toHaveBeenCalledWith(
        PREFERENCES_STORAGE_KEY,
      );
      expect(storage.values.has(PREFERENCES_STORAGE_KEY)).toBe(false);
    });

    it('removes parsed preference objects with extra persisted fields', () => {
      const storage = createMemoryStorage({
        [PREFERENCES_STORAGE_KEY]: JSON.stringify({
          reducedMotion: false,
          density: 'comfortable',
          password: 'not-a-real-password',
        }),
      });

      expect(loadPreferences(storage)).toBe(DEFAULT_PREFERENCES);
      expect(storage.removeItem).toHaveBeenCalledWith(
        PREFERENCES_STORAGE_KEY,
      );
    });
  });

  describe('scenario persistence', () => {
    it('saves and loads the allowlisted baseline scenario', () => {
      const storage = createMemoryStorage();
      const scenario = {
        scenarioId: 'baseline',
      };

      expect(saveScenario(scenario, storage)).toBe(true);
      expect(storage.setItem).toHaveBeenCalledWith(
        SCENARIO_STORAGE_KEY,
        JSON.stringify(scenario),
      );

      const loadedScenario = loadScenario(storage);

      expect(loadedScenario).toEqual(scenario);
      expect(Object.isFrozen(loadedScenario)).toBe(true);
    });

    it('returns the default scenario when no scenario record exists', () => {
      const storage = createMemoryStorage();

      expect(loadScenario(storage)).toBe(DEFAULT_SCENARIO);
      expect(loadScenario(storage)).toEqual({
        scenarioId: 'baseline',
      });
    });

    it.each([
      {
        scenarioId: 'primary-failover',
      },
      {
        scenarioId: 'baseline',
        telemetry: [],
      },
      {
        scenarioId: 'baseline',
        incident: {
          eventId: 'evt-1',
        },
      },
      {
        scenarioId: 'baseline',
        credential: {
          password: 'not-a-real-password',
        },
      },
    ])('rejects a non-allowlisted scenario schema', (scenario) => {
      const storage = createMemoryStorage({
        [SCENARIO_STORAGE_KEY]: 'previous-value',
      });

      expect(saveScenario(scenario, storage)).toBe(false);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).toHaveBeenCalledWith(
        SCENARIO_STORAGE_KEY,
      );
      expect(storage.values.has(SCENARIO_STORAGE_KEY)).toBe(false);
    });

    it('cleans up malformed or unknown stored scenarios', () => {
      const malformedStorage = createMemoryStorage({
        [SCENARIO_STORAGE_KEY]: '{not-json',
      });
      const unknownStorage = createMemoryStorage({
        [SCENARIO_STORAGE_KEY]: JSON.stringify({
          scenarioId: 'unknown-scenario',
        }),
      });

      expect(loadScenario(malformedStorage)).toBe(DEFAULT_SCENARIO);
      expect(malformedStorage.removeItem).toHaveBeenCalledWith(
        SCENARIO_STORAGE_KEY,
      );

      expect(loadScenario(unknownStorage)).toBe(DEFAULT_SCENARIO);
      expect(unknownStorage.removeItem).toHaveBeenCalledWith(
        SCENARIO_STORAGE_KEY,
      );
    });
  });

  describe('storage failure handling and cleanup', () => {
    it('returns defaults and false results when storage is unavailable', () => {
      expect(loadPreferences(null)).toBe(DEFAULT_PREFERENCES);
      expect(loadScenario(null)).toBe(DEFAULT_SCENARIO);
      expect(
        savePreferences(DEFAULT_PREFERENCES, null),
      ).toBe(false);
      expect(saveScenario(DEFAULT_SCENARIO, null)).toBe(false);
      expect(clearStoredSettings(null)).toBe(false);
    });

    it('handles storage read, write, and removal exceptions safely', () => {
      const readFailureStorage = {
        getItem: vi.fn(() => {
          throw new Error('Storage read blocked');
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const writeFailureStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('Storage write blocked');
        }),
        removeItem: vi.fn(),
      };
      const removeFailureStorage = {
        getItem: vi.fn(() => '{malformed'),
        setItem: vi.fn(),
        removeItem: vi.fn(() => {
          throw new Error('Storage removal blocked');
        }),
      };

      expect(loadPreferences(readFailureStorage)).toBe(
        DEFAULT_PREFERENCES,
      );
      expect(
        savePreferences(DEFAULT_PREFERENCES, writeFailureStorage),
      ).toBe(false);
      expect(loadPreferences(removeFailureStorage)).toBe(
        DEFAULT_PREFERENCES,
      );
      expect(clearStoredSettings(removeFailureStorage)).toBe(false);
    });

    it('clears only the two permitted application records', () => {
      const storage = createMemoryStorage({
        [PREFERENCES_STORAGE_KEY]: JSON.stringify(DEFAULT_PREFERENCES),
        [SCENARIO_STORAGE_KEY]: JSON.stringify(DEFAULT_SCENARIO),
        'unrelated.application.key': 'retain-me',
      });

      expect(clearStoredSettings(storage)).toBe(true);
      expect(storage.removeItem).toHaveBeenCalledTimes(2);
      expect(storage.removeItem).toHaveBeenNthCalledWith(
        1,
        PREFERENCES_STORAGE_KEY,
      );
      expect(storage.removeItem).toHaveBeenNthCalledWith(
        2,
        SCENARIO_STORAGE_KEY,
      );
      expect(storage.values.get('unrelated.application.key')).toBe(
        'retain-me',
      );
    });
  });
});