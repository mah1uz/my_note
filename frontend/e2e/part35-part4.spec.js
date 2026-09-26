import { expect, test } from '@playwright/test'

async function register(page) {
  await page.goto('/register')
  await page.getByLabel('Name', { exact: true }).fill('Feature Flow Tester')
  await page.getByLabel('Email', { exact: true }).fill(`feature-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('Synthetic!Cedar9426')
  await page.getByLabel('Confirm password', { exact: true }).fill('Synthetic!Cedar9426')
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening|night)/i })).toBeVisible()
}

test('onboarding, responsive ledger CRUD, search, and grounded Ask stay connected', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await register(page)

  await page.goto('/app/onboarding')
  await page.getByLabel('Profession').selectOption('EMPLOYED')
  await page.getByRole('button', { name: /study first/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening|night)/i })).toBeVisible()

  await page.goto('/app/transactions')
  await page.getByLabel('Label').fill('Books for university')
  await page.getByPlaceholder('0.00').fill('250')
  await page.getByRole('button', { name: /add transaction/i }).click()
  await expect(page.getByText('Books for university', { exact: true })).toBeVisible()
  await expect(page.getByText(/BDT balance/i)).toBeVisible()

  await page.goto('/app/search')
  await page.getByLabel('Search your notes').fill('Books for university')
  await page.getByRole('button', { name: /^search$/i }).click()
  await expect(page.getByRole('heading', { name: 'Books for university', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /ask my notes/i }).click()
  await page.getByLabel('Ask a question about your notes').fill('how much did I spend this month?')
  await page.getByRole('button', { name: /^ask$/i }).click()
  await expect(page.getByText(/matching debit total|matching transaction|could not find/i)).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(pageErrors).toEqual([])
})

test('verify drafts the unprocessed backlog for review from All Notes', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await register(page)

  // No AI configured yet: the setup prompt appears, and no backlog banner.
  await expect(page.getByText(/ai organization is off/i)).toBeVisible()

  // Capture two notes, then enable the trial from Settings.
  await page.goto('/app/notes/new')
  await page.getByLabel('Your thought').fill('I need eggs from Agora.')
  await page.getByRole('button', { name: /^save note/i }).click()
  await expect(page.getByRole('heading', { name: 'Captured thought' })).toBeVisible()
  await page.goto('/app/notes/new')
  await page.getByLabel('Your thought').fill('E2E zero items')
  await page.getByRole('button', { name: /^save note/i }).click()
  await expect(page.getByRole('heading', { name: 'Captured thought' })).toBeVisible()

  await page.goto('/app/settings')
  await page.getByRole('button', { name: /free trial/i }).click()
  await expect(page.getByText(/free trial active/i)).toBeVisible()

  // Dashboard shows the backlog banner and the processing queue, with a
  // link to All Notes instead of bulk buttons.
  await page.goto('/app')
  await expect(page.getByText(/2 notes need review/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /processing queue/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^analyze all/i })).toHaveCount(0)

  // Manual queue lists backlog notes for hand organization.
  await expect(page.getByRole('link', { name: /e2e zero items/i })).toBeVisible()

  // Verify drafts both notes for manual review from All Notes only.
  await page.goto('/app/notes')
  await page.getByRole('button', { name: /verify & review/i }).click()
  await expect(page.getByText(/drafted for review 2/i)).toBeVisible()
  expect(pageErrors).toEqual([])
})
