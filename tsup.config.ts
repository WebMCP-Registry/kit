import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: { entry: { index: 'src/index.ts', 'react/index': 'src/react/index.ts' } },
  sourcemap: true,
  clean: true,
  external: ['react', 'zod'],
})
