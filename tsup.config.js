/** @type {import('tsup').Options} */
export default {
  entry: [
    'src/reader/index.ts',
    'src/reader/utils/browser.ts',
    'src/writer/index.ts',
  ],
  dts: true,
  minify: false,
  format: ['cjs', 'esm', 'iife'],
  platform: 'neutral',
  sourcemap: true,
  splitting: false,
};
