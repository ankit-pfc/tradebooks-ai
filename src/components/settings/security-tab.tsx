'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/auth/password-validation';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

/* -------------------------------------------------------------------------- */
/*  MFA Section                                                               */
/* -------------------------------------------------------------------------- */

function MfaSection() {
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [factorId, setFactorId] = useState<string | null>(null);
    const [enrolling, setEnrolling] = useState(false);
    const [qrUri, setQrUri] = useState<string | null>(null);
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkMfaStatus = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase.auth.mfa.listFactors();
        const verifiedFactors =
            data?.totp?.filter((f) => f.status === 'verified') ?? [];
        if (verifiedFactors.length > 0) {
            setMfaEnabled(true);
            setFactorId(verifiedFactors[0].id);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        checkMfaStatus();
    }, [checkMfaStatus]);

    const handleEnroll = async () => {
        setError(null);
        setEnrolling(true);
        const supabase = createClient();
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: 'TradeBooks Authenticator',
        });

        if (enrollError || !data) {
            setError(enrollError?.message || 'Failed to start enrollment');
            setEnrolling(false);
            return;
        }

        setFactorId(data.id);
        setQrUri(data.totp.uri);

        // Create challenge for verification
        const { data: challengeData, error: challengeError } =
            await supabase.auth.mfa.challenge({ factorId: data.id });
        if (challengeError || !challengeData) {
            setError(challengeError?.message || 'Failed to create challenge');
            setEnrolling(false);
            return;
        }
        setChallengeId(challengeData.id);
    };

    const handleVerify = async () => {
        if (!factorId || !challengeId) return;
        setError(null);

        const supabase = createClient();
        const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId,
            challengeId,
            code: verifyCode,
        });

        if (verifyError) {
            setError(verifyError.message);
            return;
        }

        setMfaEnabled(true);
        setEnrolling(false);
        setQrUri(null);
        setVerifyCode('');
        toast.success('MFA enabled successfully');
    };

    const handleDisable = async () => {
        if (!factorId) return;
        setError(null);

        const supabase = createClient();
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
            factorId,
        });

        if (unenrollError) {
            setError(unenrollError.message);
            return;
        }

        setMfaEnabled(false);
        setFactorId(null);
        toast.success('MFA disabled');
    };

    if (loading) return <p className="text-sm text-gray-500">Loading MFA status...</p>;

    return (
        <Card className="border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">
                    Two-Factor Authentication (TOTP)
                </CardTitle>
                <p className="text-sm text-gray-600">
                    Add an extra layer of security using an authenticator app like Google Authenticator or Authy.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {mfaEnabled ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Enabled
                            </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDisable}>
                            Disable MFA
                        </Button>
                    </div>
                ) : enrolling && qrUri ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">
                            Scan this QR code with your authenticator app:
                        </p>
                        <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-4">
                            <QRCodeSVG value={qrUri} size={200} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mfa-code">Enter the 6-digit code from your app</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="mfa-code"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={verifyCode}
                                    onChange={(e) =>
                                        setVerifyCode(e.target.value.replace(/\D/g, ''))
                                    }
                                />
                                <Button
                                    onClick={handleVerify}
                                    disabled={verifyCode.length !== 6}
                                >
                                    Verify
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Button onClick={handleEnroll}>Enable MFA</Button>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Phone Verification Section                                                */
/* -------------------------------------------------------------------------- */

function PhoneSection() {
    const [phone, setPhone] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [savedPhone, setSavedPhone] = useState<string | null>(null);
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase
                .from('profiles')
                .select('phone, phone_verified')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.phone) {
                        setSavedPhone(data.phone);
                        setPhone(data.phone);
                        setPhoneVerified(data.phone_verified ?? false);
                    }
                    setLoading(false);
                });
        });
    }, []);

    const handleSendOtp = async (channel: 'sms' | 'whatsapp' = 'sms') => {
        setError(null);
        setSending(true);
        try {
            const res = await fetch('/api/auth/phone/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, channel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setOtpSent(true);
            toast.success(`OTP sent via ${channel}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send OTP');
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError(null);
        setVerifying(true);
        try {
            const res = await fetch('/api/auth/phone/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPhoneVerified(true);
            setSavedPhone(phone);
            setOtpSent(false);
            setOtp('');
            toast.success('Phone verified');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

    return (
        <Card className="border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">
                    Phone / WhatsApp Verification
                </CardTitle>
                <p className="text-sm text-gray-600">
                    Add your phone number for account recovery and transactional notifications.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {phoneVerified && savedPhone ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">{savedPhone}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Verified
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setPhoneVerified(false);
                                setPhone('');
                                setSavedPhone(null);
                            }}
                        >
                            Change number
                        </Button>
                    </div>
                ) : otpSent ? (
                    <div className="space-y-2">
                        <Label>Enter the 6-digit OTP sent to {phone}</Label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="000000"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            />
                            <Button onClick={handleVerifyOtp} disabled={otp.length !== 6 || verifying}>
                                {verifying ? 'Verifying...' : 'Verify'}
                            </Button>
                        </div>
                        <button
                            type="button"
                            className="text-xs text-indigo-600 hover:underline"
                            onClick={() => handleSendOtp('sms')}
                        >
                            Resend OTP
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone number (with country code)</Label>
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="919876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => handleSendOtp('sms')}
                                disabled={phone.length < 10 || sending}
                            >
                                {sending ? 'Sending...' : 'Send OTP via SMS'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendOtp('whatsapp')}
                                disabled={phone.length < 10 || sending}
                            >
                                Send via WhatsApp
                            </Button>
                        </div>
                    </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Backup Email Section                                                      */
/* -------------------------------------------------------------------------- */

function BackupEmailSection() {
    const [backupEmail, setBackupEmail] = useState('');
    const [savedEmail, setSavedEmail] = useState<string | null>(null);
    const [verified, setVerified] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase
                .from('profiles')
                .select('backup_email, backup_email_verified')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.backup_email) {
                        setSavedEmail(data.backup_email);
                        setBackupEmail(data.backup_email);
                        setVerified(data.backup_email_verified ?? false);
                    }
                    setLoading(false);
                });
        });
    }, []);

    const handleSave = async () => {
        setError(null);
        setSaving(true);
        try {
            const res = await fetch('/api/auth/backup-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: backupEmail }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSavedEmail(backupEmail);
            setVerified(false);
            toast.success('Backup email saved');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

    return (
        <Card className="border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">
                    Backup Email
                </CardTitle>
                <p className="text-sm text-gray-600">
                    Add a secondary email for account recovery.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {savedEmail && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">{savedEmail}</span>
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                verified
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-yellow-50 text-yellow-700'
                            }`}
                        >
                            {verified ? 'Verified' : 'Pending verification'}
                        </span>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="backup-email">
                        {savedEmail ? 'Update backup email' : 'Backup email address'}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="backup-email"
                            type="email"
                            placeholder="backup@example.com"
                            value={backupEmail}
                            onChange={(e) => setBackupEmail(e.target.value)}
                        />
                        <Button onClick={handleSave} disabled={!backupEmail || saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Change Password Section                                                   */
/* -------------------------------------------------------------------------- */

function ChangePasswordSection() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = async () => {
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            setError(validation.errors.join('. '));
            return;
        }

        setLoading(true);
        const supabase = createClient();
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword,
        });

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        setNewPassword('');
        setConfirmPassword('');
        toast.success('Password updated');
    };

    return (
        <Card className="border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">
                    Change Password
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                    />
                    <PasswordStrength password={newPassword} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                    />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button onClick={handleChange} disabled={!newPassword || loading}>
                    {loading ? 'Updating...' : 'Update password'}
                </Button>
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Main Security Tab                                                         */
/* -------------------------------------------------------------------------- */

export function SecurityTab() {
    return (
        <div className="space-y-6">
            <MfaSection />
            <PhoneSection />
            <BackupEmailSection />
            <ChangePasswordSection />
        </div>
    );
}
