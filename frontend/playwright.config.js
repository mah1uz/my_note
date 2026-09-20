import { defineConfig, devices } from '@playwright/test'

const backendPython = process.platform === 'win32'
  ? '..\\backend\\.venv-win\\Scripts\\python.exe'
  : '../backend/.venv/bin/python'
const backendManage = process.platform === 'win32' ? '..\\backend\\manage.py' : '../backend/manage.py'

export default defineConfig({
  testDir: './e2e',
  webServer: [
    {
      command: `${backendPython} ${backendManage} runserver 127.0.0.1:8000`,
      url: 'http://127.0.0.1:8000/admin/login/',
      reuseExistingServer: true
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true
    }
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
