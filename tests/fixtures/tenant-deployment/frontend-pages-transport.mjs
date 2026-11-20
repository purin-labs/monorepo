const nativeFetch = globalThis.fetch;
const provider = new URL(process.env.FRONTEND_PROVIDER_ORIGIN);
if (provider.hostname !== '127.0.0.1') throw new Error('Pages fixture requires loopback');

// The fixture account already holds both Pages projects.
const pagesProjects =
  'https://api.cloudflare.com/client/v4/accounts/local-fixture-only/pages/projects/';

function fixtureFetch(input, init) {
  const url = new URL(input);
  if (url.href.startsWith(pagesProjects)) {
    const name = url.href.slice(pagesProjects.length);
    if (
      (init?.method ?? 'GET') !== 'GET' ||
      !['fixture-testnet', 'fixture-mainnet'].includes(name)
    ) {
      throw new Error(`Unexpected Cloudflare request: ${init?.method ?? 'GET'} ${url.pathname}`);
    }
    return Promise.resolve(Response.json({ success: true, result: { name } }));
  }
  let project;
  switch (url.origin) {
    case 'https://test.sign.seams.sh':
      project = 'fixture-testnet';
      break;
    case 'https://sign.seams.sh':
      project = 'fixture-mainnet';
      break;
    default:
      throw new Error(`Unexpected frontend network request: ${url.origin}`);
  }
  return nativeFetch(new URL(`/${project}${url.pathname}`, provider), init);
}

globalThis.fetch = fixtureFetch;
