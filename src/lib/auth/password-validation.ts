export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
}

export type PasswordStrength = 'weak' | 'fair' | 'strong';

const RULES = [
    { test: (pw: string) => pw.length >= 8, message: 'At least 8 characters' },
    { test: (pw: string) => /[A-Z]/.test(pw), message: 'One uppercase letter' },
    { test: (pw: string) => /[a-z]/.test(pw), message: 'One lowercase letter' },
    { test: (pw: string) => /\d/.test(pw), message: 'One number' },
    {
        test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
        message: 'One special character',
    },
] as const;

export function validatePassword(password: string): PasswordValidationResult {
    const errors = RULES.filter((rule) => !rule.test(password)).map(
        (rule) => rule.message,
    );
    return { valid: errors.length === 0, errors };
}

export function getPasswordStrength(password: string): PasswordStrength {
    const passed = RULES.filter((rule) => rule.test(password)).length;
    if (passed <= 2) return 'weak';
    if (passed <= 4) return 'fair';
    return 'strong';
}

export function getPasswordRules(password: string) {
    return RULES.map((rule) => ({
        label: rule.message,
        passed: rule.test(password),
    }));
}
