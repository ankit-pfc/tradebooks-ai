/**
 * Simple in-memory sliding window rate limiter.
 * Suitable for single-instance deployments (Railway).
 *
 * Usage:
 *   const result = rateLimit(userId, { interval: 60_000, limit: 100 });
 *   if (!result.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean old entries every 5 minutes to prevent memory growth
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(maxAge: number) {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store.entries()) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < maxAge);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}

export function rateLimit(
    key: string,
    options: { interval: number; limit: number },
): { success: boolean; remaining: number; reset: number } {
    const now = Date.now();
    const { interval, limit } = options;

    cleanup(interval);

    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < interval);

    if (entry.timestamps.length >= limit) {
        const oldestInWindow = entry.timestamps[0];
        return {
            success: false,
            remaining: 0,
            reset: oldestInWindow + interval,
        };
    }

    entry.timestamps.push(now);

    return {
        success: true,
        remaining: limit - entry.timestamps.length,
        reset: now + interval,
    };
}
