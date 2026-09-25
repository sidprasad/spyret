import { defineConfig } from 'tsup';
export default defineConfig([
  { entry: { spyret: 'src/index.ts' }, format: ['cjs', 'esm'], dts: true,
    splitting: false, sourcemap: false, minify: true, clean: false, target: 'es2021',
    outDir: 'dist', platform: 'neutral', noExternal: ['graphlib', 'lodash'], bundle: true },
  { entry: { spyret: 'src/index.ts' }, format: ['iife'], globalName: 'Spyret',
    splitting: false, sourcemap: false, minify: true, clean: false, target: 'es2021',
    outDir: 'dist', platform: 'neutral', noExternal: ['spytial-core', 'graphlib', 'lodash'], bundle: true },
]);
