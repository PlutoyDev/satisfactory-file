/** @type {import('tsup').Options} */
export default {
  entry: ['src/index.ts', 'src/utils/browser.ts'],
  dts: true,
  minify: true,
  format: ['cjs', 'esm', 'iife'],
  platform: 'neutral',
  sourcemap: true,
};
