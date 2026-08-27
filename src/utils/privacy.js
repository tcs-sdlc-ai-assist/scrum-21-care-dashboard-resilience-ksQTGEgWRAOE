const REDACTED_VALUE = '[redacted]';
const UNKNOWN_MOCK_RECORD_ID = 'MOCK-0000';
const MAX_TRAVERSAL_DEPTH = 20;
const MAX_TRAVERSAL_NODES = 2_000;

const MOCK_RECORD_PATTERN = /^MOCK-[0-9]{4}$/;
const MOCK_RECORD_SEARCH_PATTERN = /\bMOCK-[0-9]{4}\b/;
const MASKED_ACCOUNT_PATTERN = /^\*{4}[0-9]{4}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_DISPLAY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ,.'()-]{0,159}$/;
const SYNTHETIC_NAME_PATTERN = /\b(?:mock|synthetic)\b/i;
const PROFILE_SOURCE_VALUES = Object.freeze([
  'PRIMARY',
  'SECONDARY',
  'FALLBACK',
  'primary',
  'secondary',
  'fallback',
]);

export const PII_FIELD_NAMES = Object.freeze([
  'account',
  'accountNumber',
  'address',
  'dateOfBirth',
  'dob',
  'email',
  'emailAddress',
  'fullName',
  'name',
  'patientId',
  'patientIdentifier',
  'password',
  'phone',
  'phoneNumber',
]);

export const PROHIBITED_PERSISTENCE_FIELDS = Object.freeze([
  ...PII_FIELD_NAMES,
  'alert',
  'alerts',
  'credential',
  'credentials',
  'diagnostic',
  'diagnosticPayload',
  'diagnosticSummary',
  'fallback',
  'incident',
  'incidents',
  'profile',
  'profiles',
  'snapshot',
  'telemetry',
]);

export const PROHIBITED_LOGGING_FIELDS = Object.freeze([
  ...PII_FIELD_NAMES,
  'credential',
  'credentials',
  'diagnostic',
  'diagnosticPayload',
  'diagnosticSummary',
  'profile',
  'profiles',
  'snapshot',
  'url',
]);

function normalizeFieldName(fieldName) {
  return typeof fieldName === 'string'
    ? fieldName.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
    : '';
}

const NORMALIZED_PII_FIELDS = new Set(PII_FIELD_NAMES.map(normalizeFieldName));
const NORMALIZED_PERSISTENCE_FIELDS = new Set(
  PROHIBITED_PERSISTENCE_FIELDS.map(normalizeFieldName),
);
const NORMALIZED_LOGGING_FIELDS = new Set(
  PROHIBITED_LOGGING_FIELDS.map(normalizeFieldName),
);

function getLastDigits(value, count) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  return String(value).replace(/\D/g, '').slice(-count);
}

function maskToken(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return REDACTED_VALUE;
  }

  const characters = Array.from(value);
  return characters.length === 1
    ? '*'
    : `${characters[0]}${'*'.repeat(Math.min(characters.length - 1, 3))}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function maskEmail(value) {
  if (typeof value !== 'string') {
    return REDACTED_VALUE;
  }

  const email = value.trim();
  const separatorIndex = email.lastIndexOf('@');

  if (
    separatorIndex <= 0 ||
    separatorIndex === email.length - 1 ||
    email.indexOf('@') !== separatorIndex
  ) {
    return REDACTED_VALUE;
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1);
  const labels = domain.split('.');

  if (
    labels.some((label) => label.length === 0) ||
    labels.length < 2
  ) {
    return REDACTED_VALUE;
  }

  const topLevelDomain = labels.pop();
  const maskedDomain = labels.map(maskToken).join('.');

  return `${maskToken(localPart)}@${maskedDomain}.${topLevelDomain}`;
}

export const maskEmailAddress = maskEmail;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function maskPhoneNumber(value) {
  const lastFour = getLastDigits(value, 4);
  return lastFour.length === 4 ? `***-***-${lastFour}` : REDACTED_VALUE;
}

export const maskPhone = maskPhoneNumber;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function maskAccountNumber(value) {
  if (typeof value === 'string' && MASKED_ACCOUNT_PATTERN.test(value)) {
    return value;
  }

  const lastFour = getLastDigits(value, 4);
  return lastFour.length === 4 ? `****${lastFour}` : REDACTED_VALUE;
}

/**
 * Synthetic mock identifiers are safe to display. Other identifiers are
 * replaced rather than partially exposed.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function maskPatientIdentifier(value) {
  return typeof value === 'string' && MOCK_RECORD_PATTERN.test(value)
    ? value
    : REDACTED_VALUE;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function maskDateOfBirth(value) {
  return value === null || value === undefined || value === ''
    ? REDACTED_VALUE
    : '****-**-**';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function maskAddress(value) {
  return value === null || value === undefined || value === ''
    ? REDACTED_VALUE
    : REDACTED_VALUE;
}

/**
 * @param {unknown} fieldName
 * @param {unknown} value
 * @returns {unknown}
 */
export function maskPiiValue(fieldName, value) {
  const normalizedField = normalizeFieldName(fieldName);

  if (normalizedField === 'email' || normalizedField === 'emailaddress') {
    return maskEmail(value);
  }

  if (normalizedField === 'phone' || normalizedField === 'phonenumber') {
    return maskPhoneNumber(value);
  }

  if (normalizedField === 'account' || normalizedField === 'accountnumber') {
    return maskAccountNumber(value);
  }

  if (
    normalizedField === 'patientid' ||
    normalizedField === 'patientidentifier'
  ) {
    return maskPatientIdentifier(value);
  }

  if (normalizedField === 'dateofbirth' || normalizedField === 'dob') {
    return maskDateOfBirth(value);
  }

  if (normalizedField === 'address') {
    return maskAddress(value);
  }

  if (NORMALIZED_PII_FIELDS.has(normalizedField)) {
    return REDACTED_VALUE;
  }

  return value;
}

/**
 * Returns a recursively copied value with known PII fields masked. Cycles and
 * excessively deep structures are replaced rather than traversed indefinitely.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function maskPii(value) {
  const ancestors = new WeakSet();
  let visitedNodes = 0;

  function visit(currentValue, depth) {
    visitedNodes += 1;

    if (
      depth > MAX_TRAVERSAL_DEPTH ||
      visitedNodes > MAX_TRAVERSAL_NODES
    ) {
      return REDACTED_VALUE;
    }

    if (currentValue === null || typeof currentValue !== 'object') {
      return currentValue;
    }

    if (ancestors.has(currentValue)) {
      return REDACTED_VALUE;
    }

    ancestors.add(currentValue);

    if (Array.isArray(currentValue)) {
      const result = currentValue.map((item) => visit(item, depth + 1));
      ancestors.delete(currentValue);
      return result;
    }

    if (currentValue instanceof Date) {
      const result = Number.isNaN(currentValue.getTime())
        ? REDACTED_VALUE
        : currentValue.toISOString();
      ancestors.delete(currentValue);
      return result;
    }

    const result = {};

    try {
      Object.entries(currentValue).forEach(([key, item]) => {
        result[key] = NORMALIZED_PII_FIELDS.has(normalizeFieldName(key))
          ? maskPiiValue(key, item)
          : visit(item, depth + 1);
      });
    } catch {
      ancestors.delete(currentValue);
      return REDACTED_VALUE;
    }

    ancestors.delete(currentValue);
    return result;
  }

  return visit(value, 0);
}

export const maskPII = maskPii;

/**
 * Converts diagnostic input to the fixed non-identifying mock record format.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeDiagnosticSummary(value) {
  if (typeof value !== 'string') {
    return `mock-record-${UNKNOWN_MOCK_RECORD_ID}`;
  }

  const match = value.match(MOCK_RECORD_SEARCH_PATTERN);
  const recordId = match?.[0] ?? UNKNOWN_MOCK_RECORD_ID;
  return `mock-record-${recordId}`;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidTimestamp(value) {
  if (Number.isSafeInteger(value) && value >= 0) {
    return true;
  }

  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

/**
 * @param {unknown} record
 * @returns {ReadonlyArray<string>}
 */
export function getSyntheticRecordValidationErrors(record) {
  if (
    typeof record !== 'object' ||
    record === null ||
    Array.isArray(record)
  ) {
    return Object.freeze(['record']);
  }

  const errors = [];
  const patientIdentifier =
    record.patientIdentifier ?? record.recordId ?? record.profileId;
  const accountNumber =
    record.accountNumber ?? record.maskedAccountNumber;
  const displayName = record.displayName;

  if (
    typeof patientIdentifier !== 'string' ||
    !MOCK_RECORD_PATTERN.test(patientIdentifier)
  ) {
    errors.push('patientIdentifier');
  }

  if (
    typeof accountNumber !== 'string' ||
    !MASKED_ACCOUNT_PATTERN.test(accountNumber)
  ) {
    errors.push('accountNumber');
  }

  if (
    typeof displayName !== 'string' ||
    !SAFE_DISPLAY_NAME_PATTERN.test(displayName) ||
    !SYNTHETIC_NAME_PATTERN.test(displayName)
  ) {
    errors.push('displayName');
  }

  if (
    record.id !== undefined &&
    (typeof record.id !== 'string' || !SAFE_ID_PATTERN.test(record.id))
  ) {
    errors.push('id');
  }

  if (
    record.source !== undefined &&
    !PROFILE_SOURCE_VALUES.includes(record.source)
  ) {
    errors.push('source');
  }

  if (
    record.generatedAt !== undefined &&
    !isValidTimestamp(record.generatedAt)
  ) {
    errors.push('generatedAt');
  }

  return Object.freeze(errors);
}

/**
 * @param {unknown} record
 * @returns {boolean}
 */
export function validateSyntheticRecord(record) {
  return getSyntheticRecordValidationErrors(record).length === 0;
}

export const isSyntheticRecord = validateSyntheticRecord;

/**
 * @param {unknown} fields
 * @returns {Set<string>}
 */
function createNormalizedFieldSet(fields) {
  if (fields === undefined) {
    return NORMALIZED_PERSISTENCE_FIELDS;
  }

  if (!Array.isArray(fields) && !(fields instanceof Set)) {
    throw new TypeError('fields must be an array or Set');
  }

  const normalizedFields = new Set();

  fields.forEach((field) => {
    if (typeof field !== 'string' || field.length === 0) {
      throw new TypeError('field names must be non-empty strings');
    }

    normalizedFields.add(normalizeFieldName(field));
  });

  return normalizedFields;
}

/**
 * Recursively finds prohibited object keys. Returned paths contain field names
 * only and never include corresponding values.
 *
 * @param {unknown} value
 * @param {ReadonlyArray<string>|Set<string>} [fields]
 * @returns {ReadonlyArray<string>}
 */
export function findProhibitedFields(value, fields) {
  const prohibitedFields = createNormalizedFieldSet(fields);
  const matches = new Set();
  const visited = new WeakSet();
  let visitedNodes = 0;

  function visit(currentValue, path, depth) {
    visitedNodes += 1;

    if (
      depth > MAX_TRAVERSAL_DEPTH ||
      visitedNodes > MAX_TRAVERSAL_NODES
    ) {
      matches.add(path ? `${path}.[uninspectable]` : '[uninspectable]');
      return;
    }

    if (
      currentValue === null ||
      typeof currentValue !== 'object' ||
      currentValue instanceof Date
    ) {
      return;
    }

    if (visited.has(currentValue)) {
      return;
    }

    visited.add(currentValue);

    if (Array.isArray(currentValue)) {
      currentValue.forEach((item, index) => {
        visit(item, `${path}[${index}]`, depth + 1);
      });
      return;
    }

    try {
      Object.entries(currentValue).forEach(([key, item]) => {
        const itemPath = path ? `${path}.${key}` : key;

        if (prohibitedFields.has(normalizeFieldName(key))) {
          matches.add(itemPath);
        }

        visit(item, itemPath, depth + 1);
      });
    } catch {
      matches.add(path ? `${path}.[uninspectable]` : '[uninspectable]');
    }
  }

  visit(value, '', 0);
  return Object.freeze(Array.from(matches));
}

/**
 * @param {unknown} value
 * @param {ReadonlyArray<string>|Set<string>} [fields]
 * @returns {boolean}
 */
export function containsProhibitedFields(value, fields) {
  return findProhibitedFields(value, fields).length > 0;
}

export const hasProhibitedFields = containsProhibitedFields;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeForPersistence(value) {
  return !containsProhibitedFields(value, NORMALIZED_PERSISTENCE_FIELDS);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeForLogging(value) {
  return !containsProhibitedFields(value, NORMALIZED_LOGGING_FIELDS);
}

/**
 * @param {unknown} value
 * @returns {void}
 */
export function assertSafeForPersistence(value) {
  if (!isSafeForPersistence(value)) {
    throw new TypeError('Value contains fields prohibited from persistence');
  }
}

/**
 * @param {unknown} value
 * @returns {void}
 */
export function assertSafeForLogging(value) {
  if (!isSafeForLogging(value)) {
    throw new TypeError('Value contains fields prohibited from logging');
  }
}