import { NextResponse } from 'next/server';
import { notifySearchEngines } from '@/lib/seo/indexing';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.INTERNAL_API_KEY;

    // We allow bypassing auth if we are in development for easier testing
    // In production, this strictly requires INTERNAL_API_KEY
    if (process.env.NODE_ENV !== 'development') {
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url } = requestBody;

    if (!url) {
      return NextResponse.json({ error: 'Missing url in request body. Expecting { "url": "/path/to/page" }' }, { status: 400 });
    }

    const results = await notifySearchEngines(url);

    return NextResponse.json({
      success: true,
      message: 'Indexing requests processed',
      data: results,
    });
  } catch (error) {
    console.error('Error in /api/seo/index-url:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
