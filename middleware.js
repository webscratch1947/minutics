import { rewrite } from '@vercel/functions';

const APP_HOST = 'app.minutics.com';
const PIAPP_HOST = 'piapp.minutics.com';
const ADMIN_HOST = 'admin.minutics.com';

// The one address on the admin host that shows the admin panel. Everything
// else on that host (including the bare domain) shows the error page.
const ADMIN_PANEL_PATH = '/awdadwjnddwiadawhdabhdusandawu';

export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || '';

  if (host === ADMIN_HOST) {
    if (url.pathname.startsWith('/api/')) {
      return; // admin API hits its function directly
    }
    if (url.pathname === ADMIN_PANEL_PATH || url.pathname === ADMIN_PANEL_PATH + '/') {
      return rewrite(new URL('/admin/panel.html', url));
    }
    // Static files the panel/error page need (self-hosted fonts + favicon).
    if (url.pathname.startsWith('/fonts/') || url.pathname === '/favicon.svg') {
      return;
    }
    // Bare domain, wrong paths, and even direct /admin/*.html guesses: error page.
    return rewrite(new URL('/admin/error.html', url));
  }

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
