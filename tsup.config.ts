import { defineConfig } from 'tsup';
// Inline Core's public type contract only. Its barrel re-exports a relative
// declaration, so resolve that too; Graph remains a public graphlib type.
export default defineConfig([
  { entry: { spyret: 'src/index.ts' }, format: ['cjs', 'esm'], dts: { resolve: ['spytial-core', /^\.\/data-instance\/interfaces$/] },
    splitting: false, sourcemap: false, minify: true, clean: false, target: 'es2021',
    outDir: 'dist', platform: 'neutral', noExternal: ['graphlib', 'lodash'], bundle: true },
  { entry: { spyret: 'src/index.ts' }, format: ['iife'], globalName: 'Spyret',
    splitting: false, sourcemap: false, minify: true, clean: false, target: 'es2021',
    outDir: 'dist', platform: 'neutral', noExternal: ['graphlib', 'lodash'], bundle: true },
]);
