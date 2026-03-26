import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  outfile: 'dist/server.js',
  platform: 'neutral',
  target: 'es2019',
  format: 'iife',
  globalName: 'exports',
});
