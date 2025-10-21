import { env } from 'node:process';
import { defineConfig, Options } from 'tsup';

const SHARED_OPTIONS: Options = {
  define: { __VERSION__: `"${env.npm_package_version}"` },
  entry: ['./src/index.ts'],
  outDir: './dist/src',
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.js' : '.mjs' }),
  sourcemap: true,
  treeshake: true,
};

export default defineConfig(() => [
  // Source.
  { ...SHARED_OPTIONS, format: 'cjs' },
  { ...SHARED_OPTIONS, format: 'esm' },

  // Tests.
  {
    ...SHARED_OPTIONS,
    bundle: false,
    entry: ['./test/**/*.ts'],
    format: 'cjs',
    outDir: './dist/test',
  },

  // SDKs
  {
    ...SHARED_OPTIONS,
    bundle: false,
    entry: ['./sdks/mpl-core/generated/**/*.ts'],
    format: 'cjs',
    outDir: './dist/sdks/mpl-core/generated',
  },
]);
