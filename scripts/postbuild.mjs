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
//   app/dist/piapp/...    -> the Pi Minutics app (piapp.minutics.com, via
//                            middleware.js host-based rewriting)
//
// This is plain Node fs, so it works the same on Windows, macOS and Linux.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Determine which build to process (supports "piapp" argument)
const target = process.argv[2] || "app";

function copy(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[postbuild] skipping missing file: ${src}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`[postbuild] copied ${src} -> ${dest}`);
}

if (target === "piapp") {
  // Pi app build: outputs to app/dist/piapp so middleware can rewrite piapp.minutics.com
  const outDir = join(projectRoot, 'app', 'dist');
  const piappOutDir = join(outDir, 'piapp');

  if (!existsSync(piappOutDir)) {
    throw new Error(`[postbuild] expected Pi app build output at ${piappOutDir} — did the Pi Vite build run first?`);
  }

  // Root-level app static files for the Pi app
  copy(join(projectRoot, 'piapp', 'favicon.png'), join(piappOutDir, 'favicon.png'));
  copy(join(projectRoot, 'piapp', 'robots.txt'), join(piappOutDir, 'robots.txt'));
  copy(join(projectRoot, 'piapp', 'life_hub_banner.png'), join(piappOutDir, 'life_hub_banner.png'));
  copy(join(projectRoot, 'piapp', 'validation-key.txt'), join(piappOutDir, 'validation-key.txt'));

  console.log('[postbuild] Pi app postbuild complete');
} else {
  // Normal app build
  const outDir = join(projectRoot, 'app', 'dist');
  const appOutDir = join(outDir, 'app');

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

  console.log('[postbuild] Normal app postbuild complete');
}
