'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerifyMfaPage() {
    return (
        <Suspense>
            <VerifyMfaForm />
        </Suspense>
    );
}

function VerifyMfaForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';

    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const supabase = createClient();

            // Get the TOTP factor
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const totpFactor = factorsData?.totp?.find((f) => f.status === 'verified');

            if (!totpFactor) {
                setError('No MFA factor found. Please contact support.');
                setLoading(false);
                return;
            }

            // Create a challenge
            const { data: challengeData, error: challengeError } =
                await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

            if (challengeError || !challengeData) {
                setError(challengeError?.message || 'Failed to create challenge');
                setLoading(false);
                return;
            }

            // Verify the code
            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: totpFactor.id,
                challengeId: challengeData.id,
                code,
            });

            if (verifyError) {
                setError('Invalid code. Please try again.');
                setLoading(false);
                return;
            }

            router.push(redirectTo);
            router.refresh();
        } catch {
            setError('Verification failed. Please try again.');
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
                    <CardDescription>
                        Enter the 6-digit code from your authenticator app
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="mfa-code">Authentication code</Label>
                            <Input
                                id="mfa-code"
                                type="text"
                                inputMode="numeric"
                                required
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                autoComplete="one-time-code"
                                autoFocus
                                className="text-center text-lg tracking-widest"
                            />
                        </div>

                        {error && (
                            <p className="text-base text-red-600">{error}</p>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12"
                            disabled={code.length !== 6 || loading}
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
