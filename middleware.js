import { rewrite } from '@vercel/functions';

const APP_HOST = 'app.minutics.com';
const PIAPP_HOST = 'piapp.minutics.com';

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

  if (host !== APP_HOST && host !== PIAPP_HOST) {
    return; // not an app subdomain, let the normal site serve
  }

  if (url.pathname.startsWith('/api/')) {
    return; // let API routes hit their functions directly, never rewrite these
  }

  if (host === PIAPP_HOST) {
    // Pi app routing
    if (APP_STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return rewrite(new URL('/piapp' + url.pathname, url));
    }

    if (APP_STATIC_FILES.includes(url.pathname)) {
      return rewrite(new URL('/piapp' + url.pathname, url));
    }

    // Everything else on piapp.minutics.com serves the Pi app
    return rewrite(new URL('/piapp/index.html', url));
  }

  // Normal app routing (app.minutics.com)
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
