'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/auth/password-validation';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const validation = validatePassword(password);
        if (!validation.valid) {
            setError(validation.errors.join('. '));
            return;
        }

        setLoading(true);

        const supabase = createClient();
        const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
        });

        setLoading(false);

        if (signUpError) {
            setError(signUpError.message);
            return;
        }

        setSuccess(true);
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Check your email</CardTitle>
                        <CardDescription>
                            We sent a confirmation link to <strong>{email}</strong>.
                            Click it to activate your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/login">
                            <Button variant="outline" className="w-full">
                                Back to login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Create an account</CardTitle>
                    <CardDescription>
                        Sign up for TradeBooks AI
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                autoComplete="new-password"
                            />
                            <PasswordStrength password={password} />
                        </div>

                        {error && (
                            <p className="text-base text-red-600">{error}</p>
                        )}

                        <Button type="submit" className="w-full h-12" disabled={loading}>
                            {loading ? 'Creating account...' : 'Sign up'}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-base text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                            Log in
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
