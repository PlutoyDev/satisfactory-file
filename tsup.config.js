/** @type {import('tsup').Options} */
export default {
  entry: ['src/index.ts'],
  dts: true,
  minify: true,
  format: ['cjs', 'esm', 'iife'],
  platform: 'neutral',
};
