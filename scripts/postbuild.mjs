// Runs automatically after `npm run build` (npm's "postbuild" lifecycle hook).
//
// Vite only builds the Minutics app (root: 'app'), and outputs it to
// app/dist/app (see vite.config.mjs). This script adds the marketing
// website — which is a single self-contained static index.html with no
// build step of its own — into the same app/dist output directory, at the
// root, so that a single "app/dist" (see vercel.json outputDirectory) can
// serve both:
//
//   app/dist/index.html   -> marketing site (minutics.com)
//   app/dist/favicon.svg  -> marketing site favicon
//   app/dist/app/...      -> the Minutics app (app.minutics.com, via
//                            middleware.js host-based rewriting)
//
// This is plain Node fs, so it works the same on Windows, macOS and Linux.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(projectRoot, 'app', 'dist');
const appOutDir = join(outDir, 'app');

function copy(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[postbuild] skipping missing file: ${src}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`[postbuild] copied ${src} -> ${dest}`);
}

if (!existsSync(outDir)) {
  throw new Error(`[postbuild] expected build output at ${outDir} — did the Vite build run first?`);
}

// Marketing website (served at the output root, i.e. minutics.com)
copy(join(projectRoot, 'index.html'), join(outDir, 'index.html'));
copy(join(projectRoot, 'favicon.svg'), join(outDir, 'favicon.svg'));

// Root-level app static files not covered by Vite's asset pipeline
// (not referenced from app/index.html, so Vite doesn't copy them), but
// expected by middleware.js at app.minutics.com's root path.
copy(join(projectRoot, 'app', 'favicon.png'), join(appOutDir, 'favicon.png'));
copy(join(projectRoot, 'app', 'robots.txt'), join(appOutDir, 'robots.txt'));
copy(join(projectRoot, 'app', 'life_hub_banner.png'), join(appOutDir, 'life_hub_banner.png'));
