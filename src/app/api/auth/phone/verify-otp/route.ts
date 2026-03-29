import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { verifyOTP } from '@/lib/messaging/msg91';

export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const phone = body?.phone?.trim();
        const otp = body?.otp?.trim();

        if (!phone || !otp) {
            return NextResponse.json(
                { error: 'Phone and OTP are required' },
                { status: 400 },
            );
        }

        if (!/^\d{6}$/.test(otp)) {
            return NextResponse.json(
                { error: 'OTP must be 6 digits' },
                { status: 400 },
            );
        }

        const result = await verifyOTP(phone, otp);

        if (!result.success) {
            return NextResponse.json(
                { error: result.message || 'Invalid OTP' },
                { status: 400 },
            );
        }

        // Update profile with verified phone
        const supabase = await createClient();
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ phone, phone_verified: true })
            .eq('id', userId);

        if (updateError) {
            return NextResponse.json(
                { error: 'Failed to save phone number' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            message: 'Phone verified successfully',
            phone,
            phone_verified: true,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to verify OTP';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
