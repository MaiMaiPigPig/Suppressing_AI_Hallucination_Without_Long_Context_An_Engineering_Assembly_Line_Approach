import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['../../../测试脚本/unit-tests/**/*.test.js'],
    coverage: {
      include: [
        'utils/**/*.js',
        'core/data/cache.js',
        'core/data/dictionary.js',
        'core/data/loader.js',
        'core/constants/*.js',
        'handlers/basic.js',
        'handlers/choose.js',
        'handlers/filter.js',
        'handlers/index.js'
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60
      }
    }
  },
});