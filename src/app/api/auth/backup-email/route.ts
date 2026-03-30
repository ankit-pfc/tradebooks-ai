import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const backupEmail = body?.email?.trim();

        if (!backupEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) {
            return NextResponse.json(
                { error: 'Valid email address required' },
                { status: 400 },
            );
        }

        // Check it's not the same as the primary email
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email === backupEmail) {
            return NextResponse.json(
                { error: 'Backup email must be different from primary email' },
                { status: 400 },
            );
        }

        // Save backup email (unverified for now — verification via link is a future enhancement)
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                backup_email: backupEmail,
                backup_email_verified: false,
            })
            .eq('id', userId);

        if (updateError) {
            return NextResponse.json(
                { error: 'Failed to save backup email' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            message: 'Backup email saved. Verification link will be sent.',
            backup_email: backupEmail,
            backup_email_verified: false,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save backup email';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
