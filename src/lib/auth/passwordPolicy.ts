export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Common symbols allowed for the special-character requirement. */
export const PASSWORD_SPECIAL_CHARS = '!@#$%^&*._-';

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'At least 8 characters, including one number and one special character (!@#$%^&*._-).';

const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*._-]/;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!HAS_DIGIT.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!HAS_SPECIAL.test(password)) {
    return `Password must include at least one special character (${PASSWORD_SPECIAL_CHARS}).`;
  }
  return null;
}

export type PasswordRuleStatus = {
  minLength: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
};

export function getPasswordRuleStatus(password: string): PasswordRuleStatus {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    hasDigit: HAS_DIGIT.test(password),
    hasSpecial: HAS_SPECIAL.test(password),
  };
}
