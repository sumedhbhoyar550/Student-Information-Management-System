const BACKEND_URL = 'https://campus-desk-api-mx62.onrender.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Forward API and health check requests to Render backend
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const targetUrl = new URL(url.pathname + url.search, BACKEND_URL);
      const headers = new Headers(request.headers);
      headers.set('host', targetUrl.host);

      const modifiedRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow'
      });

      return fetch(modifiedRequest);
    }

    // Serve static frontend assets from Cloudflare edge
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Asset binding not configured.', { status: 500 });
  }
};
