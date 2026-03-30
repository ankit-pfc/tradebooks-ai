import { google } from 'googleapis';

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
    
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    // Initialize the API
    const indexing = google.indexing({ version: 'v3', auth: jwtClient });

    const results = [];
    for (const url of urls) {
      try {
        const response = await indexing.urlNotifications.publish({
          requestBody: {
            url: url,
            type: 'URL_UPDATED',
          },
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
