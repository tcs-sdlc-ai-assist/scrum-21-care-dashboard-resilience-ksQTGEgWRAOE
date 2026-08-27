import { MAX_RECORDS } from '../domain/constants.js';
import {
  createTelemetrySample,
  isDependencyId,
} from '../domain/model.js';
import { appendBounded } from '../utils/collections.js';

/**
 * @param {unknown} dependencyId
 * @returns {string}
 */
function requireDependencyId(dependencyId) {
  if (!isDependencyId(dependencyId)) {
    throw new TypeError('dependencyId must be a supported dependency');
  }

  return dependencyId;
}

/**
 * Memory-only repository for validated mock telemetry samples. Records remain
 * in insertion order and the oldest sample is evicted when the fixed limit is
 * exceeded.
 */
export class TelemetryRepository {
  constructor() {
    this.records = Object.freeze([]);
  }

  /**
   * Validates and appends a telemetry sample.
   *
   * @param {unknown} sample
   * @returns {ReturnType<typeof createTelemetrySample>}
   */
  append(sample) {
    const telemetrySample = createTelemetrySample(sample);
    this.records = appendBounded(
      this.records,
      telemetrySample,
      MAX_RECORDS,
    );

    return telemetrySample;
  }

  /**
   * Alias for appending a telemetry sample.
   *
   * @param {unknown} sample
   * @returns {ReturnType<typeof createTelemetrySample>}
   */
  record(sample) {
    return this.append(sample);
  }

  /**
   * Returns all telemetry samples in oldest-to-newest order.
   *
   * @returns {ReadonlyArray<ReturnType<typeof createTelemetrySample>>}
   */
  getAll() {
    return this.records;
  }

  /**
   * Returns telemetry samples for one fixed mock dependency.
   *
   * @param {string} dependencyId
   * @returns {ReadonlyArray<ReturnType<typeof createTelemetrySample>>}
   */
  getByDependency(dependencyId) {
    const validDependencyId = requireDependencyId(dependencyId);

    return Object.freeze(
      this.records.filter(
        (sample) => sample.dependencyId === validDependencyId,
      ),
    );
  }

  /**
   * Returns the newest telemetry sample, if one exists.
   *
   * @returns {ReturnType<typeof createTelemetrySample>|null}
   */
  getLatest() {
    return this.records.length === 0
      ? null
      : this.records[this.records.length - 1];
  }

  /**
   * Returns the newest telemetry sample for one fixed mock dependency.
   *
   * @param {string} dependencyId
   * @returns {ReturnType<typeof createTelemetrySample>|null}
   */
  getLatestByDependency(dependencyId) {
    const validDependencyId = requireDependencyId(dependencyId);

    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      if (this.records[index].dependencyId === validDependencyId) {
        return this.records[index];
      }
    }

    return null;
  }

  /**
   * Removes every telemetry sample.
   *
   * @returns {void}
   */
  clear() {
    this.records = Object.freeze([]);
  }
}

export default TelemetryRepository;