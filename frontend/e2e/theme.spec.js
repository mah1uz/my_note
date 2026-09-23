import { expect, test } from '@playwright/test'

test('light theme by default with no horizontal overflow', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('.auth-box')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('system dark preference applies on first visit and persists explicitly', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto('/login')
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(body).toBe('rgb(11, 14, 19)')
  await page.evaluate(() => window.localStorage.setItem('rememberly_theme', 'light'))
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await context.close()
})

test('mobile login has no horizontal overflow in either theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await expect(page.locator('.auth-box')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => {
    window.localStorage.setItem('rememberly_theme', 'dark')
    document.documentElement.dataset.theme = 'dark'
  })
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
