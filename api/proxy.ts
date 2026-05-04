export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  const referer = url.searchParams.get('referer') || 'https://frfff.shootwithyalla.com/';

  if (!targetUrl) {
    return new Response('URL required', { status: 400 });
  }

  const headers = new Headers({
    'Referer': referer,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  });

  try {
    headers.set('Origin', new URL(referer).origin);
  } catch (e) {
    // Ignore invalid origin
  }

  try {
    let response = await fetch(targetUrl, { headers, redirect: 'follow' });

    if (response.status >= 400 && headers.has('Origin')) {
      headers.delete('Origin');
      response = await fetch(targetUrl, { headers, redirect: 'follow' });
    }

    const resHeaders = new Headers(response.headers);
    resHeaders.delete('transfer-encoding');
    resHeaders.set('Access-Control-Allow-Origin', '*');

    if (targetUrl.includes('.m3u8') || (resHeaders.get('content-type') || '').includes('application/vnd.apple.mpegurl')) {
      resHeaders.delete('content-encoding');
      resHeaders.delete('content-length');
      const text = await response.text();
      const baseUrl = new URL(targetUrl);
      
      const rewritten = text.split('\n').map(line => {
        if (line.startsWith('#') || line.trim() === '') return line;
        let absoluteUrl = line;
        if (!line.startsWith('http')) {
          absoluteUrl = new URL(line, baseUrl.href).href;
        }
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
      }).join('\n');
      
      return new Response(rewritten, {
        status: response.status,
        headers: resHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: resHeaders
    });
  } catch (e: any) {
    return new Response(e.message || 'Error fetching url', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
