import { describe, expect, it } from 'vitest';
import {
    getPasswordRules,
    getPasswordStrength,
    validatePassword,
} from '../password-validation';

describe('validatePassword', () => {
    it('rejects empty string', () => {
        const result = validatePassword('');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(5);
    });

    it('rejects short password', () => {
        const result = validatePassword('Aa1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('At least 8 characters');
    });

    it('rejects password without uppercase', () => {
        const result = validatePassword('abcdefg1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('One uppercase letter');
    });

    it('rejects password without lowercase', () => {
        const result = validatePassword('ABCDEFG1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('One lowercase letter');
    });

    it('rejects password without number', () => {
        const result = validatePassword('Abcdefgh!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('One number');
    });

    it('rejects password without special character', () => {
        const result = validatePassword('Abcdefg1');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('One special character');
    });

    it('accepts valid password', () => {
        const result = validatePassword('Str0ng!Pass');
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('accepts password with various special characters', () => {
        expect(validatePassword('Passw0rd@')).toMatchObject({ valid: true });
        expect(validatePassword('Passw0rd#')).toMatchObject({ valid: true });
        expect(validatePassword('Passw0rd$')).toMatchObject({ valid: true });
        expect(validatePassword('Passw0rd%')).toMatchObject({ valid: true });
    });
});

describe('getPasswordStrength', () => {
    it('returns weak for very short passwords', () => {
        expect(getPasswordStrength('')).toBe('weak');
        expect(getPasswordStrength('abc')).toBe('weak');
    });

    it('returns fair for partially compliant passwords', () => {
        // 'Abcdefg1' passes 4 rules: length, upper, lower, digit → fair
        expect(getPasswordStrength('Abcdefg1')).toBe('fair');
        // 'Abcdefgh' passes 3 rules: length, upper, lower → fair
        expect(getPasswordStrength('Abcdefgh')).toBe('fair');
    });

    it('returns strong for fully compliant passwords', () => {
        expect(getPasswordStrength('Str0ng!Pass')).toBe('strong');
    });
});

describe('getPasswordRules', () => {
    it('returns all rules with pass/fail status', () => {
        const rules = getPasswordRules('Ab1!');
        expect(rules).toHaveLength(5);
        expect(rules.find((r) => r.label === 'At least 8 characters')?.passed).toBe(false);
        expect(rules.find((r) => r.label === 'One uppercase letter')?.passed).toBe(true);
        expect(rules.find((r) => r.label === 'One lowercase letter')?.passed).toBe(true);
        expect(rules.find((r) => r.label === 'One number')?.passed).toBe(true);
        expect(rules.find((r) => r.label === 'One special character')?.passed).toBe(true);
    });

    it('shows all passing for strong password', () => {
        const rules = getPasswordRules('Str0ng!Pass');
        expect(rules.every((r) => r.passed)).toBe(true);
    });
});
