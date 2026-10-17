
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  timeout: 30_000,

  // Executa um teste por vez
  workers: 1,

  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
})
