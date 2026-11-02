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
        'src/game/save/saveRuntime.ts',
        'src/game/effects/effects.ts',
        'src/game/effects/heelstonePass.ts',
        'src/game/portico/crossing.ts',
      ],
      thresholds: {
        'src/game/weapons/cordState.ts': { branches: 100 },
        'src/game/quest/quest.ts': { branches: 100 },
        'src/game/save/save.ts': {
          branches: 100,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'src/game/save/saveRuntime.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/game/effects/effects.ts': { branches: 100 },
        'src/game/effects/heelstonePass.ts': { branches: 100 },
        'src/game/portico/crossing.ts': { branches: 100 },
      },
    },
  },
})
