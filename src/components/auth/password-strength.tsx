'use client';

import {
    getPasswordRules,
    getPasswordStrength,
} from '@/lib/auth/password-validation';

const STRENGTH_CONFIG = {
    weak: { color: 'bg-red-500', width: 'w-1/3', label: 'Weak' },
    fair: { color: 'bg-yellow-500', width: 'w-2/3', label: 'Fair' },
    strong: { color: 'bg-green-500', width: 'w-full', label: 'Strong' },
} as const;

export function PasswordStrength({ password }: { password: string }) {
    if (!password) return null;

    const strength = getPasswordStrength(password);
    const rules = getPasswordRules(password);
    const config = STRENGTH_CONFIG[strength];

    return (
        <div className="space-y-2">
            {/* Strength bar */}
            <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${config.color} ${config.width}`}
                    />
                </div>
                <span className="text-xs font-medium text-gray-600">
                    {config.label}
                </span>
            </div>

            {/* Rule checklist */}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {rules.map((rule) => (
                    <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${
                            rule.passed ? 'text-green-600' : 'text-gray-400'
                        }`}
                    >
                        {rule.passed ? (
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                            </svg>
                        )}
                        {rule.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
