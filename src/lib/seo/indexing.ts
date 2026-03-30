import { createSign } from 'node:crypto';

const INDEXNOW_KEY = '5b2a0f8c3d7e4a1b9c6d2e8f4a1b3c5d';

// Centralised domain definition to ensure correct pinging URLs
const getAppUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'https://tradebooks-ai.vercel.app'; // fallback
};

export async function pingIndexNow(urls: string[]) {
  try {
    const appUrl = getAppUrl();
    const host = appUrl.replace(/^https?:\/\//, '');

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        host: host,
        key: INDEXNOW_KEY,
        keyLocation: `${appUrl}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IndexNow ping failed:', response.status, errorText);
      return { success: false, engine: 'IndexNow', status: response.status };
    }

    return { success: true, engine: 'IndexNow' };
  } catch (error) {
    console.error('IndexNow error:', error);
    return { success: false, engine: 'IndexNow', error: String(error) };
  }
}

/** Mint a Google OAuth2 access token from a service account using a direct JWT flow. */
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signing = createSign('RSA-SHA256');
  signing.update(`${header}.${claim}`);
  const signature = signing.sign(privateKey, 'base64url');
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const json = await res.json() as { access_token: string };
  return json.access_token;
}

export async function pingGoogle(urls: string[]) {
  try {
    const credentialsStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsStr) {
      console.warn('GOOGLE_SERVICE_ACCOUNT_JSON not set. Skipping Google Indexing API.');
      return { success: false, engine: 'Google', error: 'Missing credentials' };
    }

    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(credentialsStr);
    } catch {
      // In case it's base64 encoded
      credentials = JSON.parse(Buffer.from(credentialsStr, 'base64').toString('utf-8'));
    }

    const privateKey = credentials.private_key.replace(/\\n/g, '\n');
    const accessToken = await getGoogleAccessToken(credentials.client_email, privateKey);

    const results = [];
    for (const url of urls) {
      try {
        const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url, type: 'URL_UPDATED' }),
        });
        results.push({ url, status: response.status });
      } catch (err) {
        console.error(`Google indexing failed for ${url}:`, err);
        results.push({ url, error: String(err) });
      }
    }

    return { success: true, engine: 'Google', results };
  } catch (error) {
    console.error('Google Indexing API error:', error);
    return { success: false, engine: 'Google', error: String(error) };
  }
}

export async function notifySearchEngines(urlList: string | string[]) {
  const urls = Array.isArray(urlList) ? urlList : [urlList];
  const appUrl = getAppUrl();

  // Format URLs properly if they are relative
  const fullyQualifiedUrls = urls.map(url => {
    if (url.startsWith('http')) return url;
    return `${appUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  });

  console.log(`Pinging search engines for ${fullyQualifiedUrls.length} URLs...`);

  const [indexNowResult, googleResult] = await Promise.all([
    pingIndexNow(fullyQualifiedUrls),
    pingGoogle(fullyQualifiedUrls),
  ]);

  return { indexNow: indexNowResult, google: googleResult };
}
