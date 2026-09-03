import { rewrite } from '@vercel/functions';

const APP_HOST = 'app.minutics.com';

const APP_STATIC_PREFIXES = ['/assets/', '/src/'];

const APP_STATIC_FILES = [
  '/favicon.svg',
  '/favicon.png',
  '/manifest.json',
  '/robots.txt',
  '/life_hub_banner.png',
];

export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || '';

  if (host !== APP_HOST) {
    return; // not the app subdomain, let the normal site serve
  }

  if (url.pathname.startsWith('/api/')) {
    return; // let API routes hit their functions directly, never rewrite these
  }

  if (APP_STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return rewrite(new URL('/app' + url.pathname, url));
  }

  if (APP_STATIC_FILES.includes(url.pathname)) {
    return rewrite(new URL('/app' + url.pathname, url));
  }

  // Everything else on app.minutics.com serves the app
  return rewrite(new URL('/app/index.html', url));
}

export const config = {
  matcher: ['/((?!api/).*)'],
};
