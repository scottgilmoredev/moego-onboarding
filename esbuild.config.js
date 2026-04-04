/**
 * Build Configuration
 *
 * @description Compiles TypeScript source to a single IIFE bundle for the GAS
 * runtime, then copies HTML templates to dist/ so Clasp can push them alongside
 * the compiled script. Run via `pnpm build` or as part of `pnpm push`.
 */

import esbuild from 'esbuild';
import { copyFileSync } from 'fs';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  outfile: 'dist/server.js',
  // neutral platform avoids Node.js or browser-specific shims
  platform: 'neutral',
  // es2019 is the highest target supported by the GAS V8 runtime
  target: 'es2019',
  // iife wraps output so GAS can call doPost/doGet as globals
  format: 'iife',
  globalName: 'exports',
  banner: {
    js: `
      function doPost(e) { return exports.doPost(e); }
      function doGet(e) { return exports.doGet(e); }
      function uploadVaccinationRecord(fileName, mimeType, dataBase64, token) { return exports.uploadVaccinationRecord(fileName, mimeType, dataBase64, token); }
    `,
  },
});

// Copy HTML templates to dist/ for Clasp deployment
for (const template of ['landing', 'error', 'styles']) {
  copyFileSync(`src/templates/${template}.html`, `dist/${template}.html`);
}
