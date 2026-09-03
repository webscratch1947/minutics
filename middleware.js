import { rewrite } from '@vercel/functions';

const APP_HOST = 'app.minutics.com';
const PIAPP_HOST = 'piapp.minutics.com';

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
    // Pi app: /piapp/assets/... for static assets, /piapp/index.html for SPA routes
    return rewrite(new URL('/piapp' + (url.pathname === '/' ? '/index.html' : url.pathname), url));
  }

  // Normal app: /app/assets/... for static assets, /app/index.html for SPA routes
  return rewrite(new URL('/app' + (url.pathname === '/' ? '/index.html' : url.pathname), url));
}

export const config = {
  matcher: ['/((?!api/).*)'],
};
