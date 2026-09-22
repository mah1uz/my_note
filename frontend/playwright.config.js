import { defineConfig, devices } from '@playwright/test'

const backendPython = process.env.BACKEND_PYTHON || (process.platform === 'win32'
  ? '..\\backend\\.venv-win\\Scripts\\python.exe'
  : '../backend/.venv/bin/python')
const backendRunner = process.platform === 'win32' ? '..\\backend\\run_e2e.py' : '../backend/run_e2e.py'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  webServer: [
    {
      command: `"${backendPython}" "${backendRunner}"`,
      url: 'http://127.0.0.1:8000/admin/login/',
      reuseExistingServer: false
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false
    }
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
