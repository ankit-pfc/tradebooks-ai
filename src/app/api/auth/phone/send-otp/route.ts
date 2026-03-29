import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { sendOTP, type OtpChannel } from '@/lib/messaging/msg91';

export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const phone = body?.phone?.trim();
        const channel: OtpChannel = body?.channel === 'whatsapp' ? 'whatsapp' : 'sms';

        if (!phone || !/^\d{10,15}$/.test(phone)) {
            return NextResponse.json(
                { error: 'Valid phone number required (10-15 digits with country code)' },
                { status: 400 },
            );
        }

        const result = await sendOTP(phone, channel);

        if (!result.success) {
            return NextResponse.json(
                { error: result.message || 'Failed to send OTP' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            message: `OTP sent via ${channel}`,
            requestId: result.requestId,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send OTP';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
