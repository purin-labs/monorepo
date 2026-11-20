// Sends each request on a former host to the same path and query on its successor.
// HOST_REDIRECTS_JSON maps a hostname to the successor origin. The Console API
// routes on a former host are more specific than this Worker's `/*` route, so
// Cloudflare sends those requests to the Console Worker, never here.

export function redirectLocation(requestUrl, redirects) {
  const url = new URL(requestUrl);
  const successor = redirects[url.hostname];
  if (!successor) return null;
  return new URL(url.pathname + url.search, successor).href;
}

let parsedSource = '';
let parsedRedirects = {};

function readRedirects(env) {
  const source = String(env.HOST_REDIRECTS_JSON || '{}');
  if (source !== parsedSource) {
    parsedRedirects = JSON.parse(source);
    parsedSource = source;
  }
  return parsedRedirects;
}

export default {
  fetch(request, env) {
    const location = redirectLocation(request.url, readRedirects(env));
    if (!location) return new Response('Not found', { status: 404 });
    // 308 keeps the method and body of a request that is not a page load.
    const status = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308;
    return new Response(null, {
      status,
      headers: { location, 'cache-control': 'public, max-age=3600' },
    });
  },
};
