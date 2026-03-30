const MSG91_BASE = 'https://control.msg91.com/api/v5';

function getAuthKey(): string {
    const key = process.env.MSG91_AUTH_KEY;
    if (!key) throw new Error('MSG91_AUTH_KEY is not configured');
    return key;
}

function getOtpTemplateId(): string {
    const id = process.env.MSG91_OTP_TEMPLATE_ID;
    if (!id) throw new Error('MSG91_OTP_TEMPLATE_ID is not configured');
    return id;
}

export type OtpChannel = 'sms' | 'whatsapp';

interface Msg91Response {
    type: 'success' | 'error';
    message: string;
    request_id?: string;
}

/**
 * Send OTP to a phone number via SMS or WhatsApp.
 * Phone must include country code (e.g. "919876543210").
 */
export async function sendOTP(
    phone: string,
    channel: OtpChannel = 'sms',
): Promise<{ success: boolean; message: string; requestId?: string }> {
    const authKey = getAuthKey();
    const templateId = getOtpTemplateId();

    const body: Record<string, string | number> = {
        template_id: templateId,
        mobile: phone,
        authkey: authKey,
        otp_length: 6,
        otp_expiry: 10, // minutes
    };

    if (channel === 'whatsapp') {
        body.realTimeResponse = 1;
    }

    const res = await fetch(`${MSG91_BASE}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as Msg91Response;
    return {
        success: data.type === 'success',
        message: data.message,
        requestId: data.request_id,
    };
}

/**
 * Verify an OTP entered by the user.
 */
export async function verifyOTP(
    phone: string,
    otp: string,
): Promise<{ success: boolean; message: string }> {
    const authKey = getAuthKey();

    const url = new URL(`${MSG91_BASE}/otp/verify`);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('mobile', phone);
    url.searchParams.set('otp', otp);

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = (await res.json()) as Msg91Response;

    return {
        success: data.type === 'success',
        message: data.message,
    };
}

/**
 * Resend OTP via text or voice.
 */
export async function resendOTP(
    phone: string,
    retryType: 'text' | 'voice' = 'text',
): Promise<{ success: boolean; message: string }> {
    const authKey = getAuthKey();

    const url = new URL(`${MSG91_BASE}/otp/retry`);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('mobile', phone);
    url.searchParams.set('retrytype', retryType === 'voice' ? 'voice' : 'text');

    const res = await fetch(url.toString(), { method: 'POST' });
    const data = (await res.json()) as Msg91Response;

    return {
        success: data.type === 'success',
        message: data.message,
    };
}

/**
 * Send a transactional SMS/WhatsApp message using an approved template.
 */
export async function sendTransactional(
    phone: string,
    templateId: string,
    variables: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
    const authKey = getAuthKey();

    const body = {
        flow_id: templateId,
        sender: process.env.MSG91_SENDER_ID || 'TRDBOK',
        mobiles: phone,
        ...variables,
    };

    const res = await fetch(`${MSG91_BASE}/flow`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            authkey: authKey,
        },
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as Msg91Response;
    return {
        success: data.type === 'success',
        message: data.message,
    };
}
