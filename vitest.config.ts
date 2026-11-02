import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/game/weapons/cordState.ts',
        'src/game/quest/quest.ts',
        'src/game/save/save.ts',
      ],
      thresholds: {
        'src/game/weapons/cordState.ts': { branches: 100 },
        'src/game/quest/quest.ts': { branches: 100 },
        'src/game/save/save.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
})
