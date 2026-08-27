const FAKE_PASSWORD = 'not-a-real-password';

export const CLINICAL_DEMO_ACCOUNT_INPUT = Object.freeze({
  email: 'clinical.staff@demo.example',
  password: FAKE_PASSWORD,
  role: 'clinical',
});

export const SRE_DEMO_ACCOUNT_INPUT = Object.freeze({
  email: 'sre@demo.example',
  password: FAKE_PASSWORD,
  role: 'sre',
});

export const CLINICAL_STAFF_DEMO_ACCOUNT =
  CLINICAL_DEMO_ACCOUNT_INPUT;

export const DEMO_ACCOUNT_INPUTS = Object.freeze({
  clinical: CLINICAL_DEMO_ACCOUNT_INPUT,
  sre: SRE_DEMO_ACCOUNT_INPUT,
});

export const DEMO_ACCOUNTS = DEMO_ACCOUNT_INPUTS;

/**
 * Returns a fixed synthetic account input for a supported demo role.
 *
 * @param {unknown} role
 * @returns {Readonly<{email: string, password: string, role: string}>|null}
 */
export function getDemoAccountInput(role) {
  if (role === 'clinical' || role === 'CARE_TEAM') {
    return CLINICAL_DEMO_ACCOUNT_INPUT;
  }

  if (role === 'sre' || role === 'SRE') {
    return SRE_DEMO_ACCOUNT_INPUT;
  }

  return null;
}

export const getDemoAccountFixture = getDemoAccountInput;

export default DEMO_ACCOUNT_INPUTS;