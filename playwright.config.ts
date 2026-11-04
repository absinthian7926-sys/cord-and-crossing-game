import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: process.env.CI ? 1 : undefined,
  use: { headless: true },
  projects: [
    {
      name: 'development',
      testIgnore: /perf-preview\.spec\.ts/,
      use: { baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'production-preview',
      testMatch: /perf-preview\.spec\.ts/,
      use: { baseURL: 'http://127.0.0.1:4174' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
