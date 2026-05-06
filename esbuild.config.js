/**
 * Build Configuration
 *
 * @description Compiles TypeScript source to a single IIFE bundle for the GAS
 * runtime, then copies HTML templates to dist/ so Clasp can push them alongside
 * the compiled script. Run via `pnpm build` or as part of `pnpm push`.
 */

import esbuild from 'esbuild';
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from 'fs';

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
      function sendBatchUploadNotification(token) { return exports.sendBatchUploadNotification(token); }
      function retriggerOnboarding(customerId) { return exports.retriggerOnboarding(customerId); }
    `,
  },
});

// Copy standalone HTML templates to dist/ for Clasp deployment
for (const file of readdirSync('src/templates')) {
  if (file.endsWith('.html') && !file.includes('upload')) {
    copyFileSync(`src/templates/${file}`, `dist/${file}`);
  }
}

// Assemble dist/upload.html from ordered fragments wrapped in an IIFE
const UPLOAD_FRAGMENTS = [
  'upload-config',
  'upload-icons',
  'upload-utils',
  'upload-builders',
  'upload-render',
  'upload-upload',
  'upload-events',
];

const stripScriptTags = s => s.replace(/^<script>\n/, '').replace(/\n<\/script>\n$/, '');
const body = UPLOAD_FRAGMENTS.map(name =>
  stripScriptTags(readFileSync(`src/templates/${name}.html`, 'utf8'))
).join('\n');
writeFileSync('dist/upload.html', `<script>\n  (function () {\n${body}\n  })();\n</script>\n`);
