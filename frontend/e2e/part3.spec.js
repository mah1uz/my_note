import { expect, test } from '@playwright/test'

const multiNote = 'Tomorrow class at 10, buy eggs afterwards, and today I spent 250 taka on books.'

async function register(page) {
  await page.goto('/register')
  await page.getByLabel('Name', { exact: true }).fill('Part Three Tester')
  await page.getByLabel('Email', { exact: true }).fill(`part3-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('Synthetic!Cedar9426')
  await page.getByLabel('Confirm password', { exact: true }).fill('Synthetic!Cedar9426')
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByRole('heading', { name: /good morning/i })).toBeVisible()
}

async function capture(page, text) {
  await page.getByLabel('What do you want to remember?').fill(text)
  await page.getByRole('button', { name: /^Save note/i }).click()
  await page.getByRole('link', { name: 'Review saved note' }).click()
  await expect(page.getByRole('heading', { name: 'Captured thought' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyze note' })).toBeEnabled()
}

test('real full-stack analysis, correction, persistence, item pages and two-user isolation', async ({ page, browser }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await register(page)
  await page.getByLabel('Groq API Key', { exact: true }).fill('synthetic-browser-key')
  await page.getByRole('button', { name: 'Use for this session' }).click()
  await expect(page.getByText('Personal Groq key active for this session')).toBeVisible()
  await capture(page, multiNote)
  const noteUrl = page.url()
  const noteId = noteUrl.split('/').at(-1)
  await page.getByRole('button', { name: 'Analyze note' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(3)
  await page.getByLabel('Title', { exact: true }).nth(1).fill('Buy six eggs')
  await page.getByLabel('Amount', { exact: true }).nth(2).fill('240.00')
  await page.getByRole('button', { name: 'Confirm all' }).click()
  await expect(page.getByText('Organization confirmed and saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Buy six eggs', exact: true })).toBeVisible()
  await expect(page.getByText('BDT 240.00', { exact: true })).toBeVisible()

  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'Mark Buy six eggs complete' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Mark Buy six eggs incomplete' })).toBeVisible()
  await page.goto('/app/shopping')
  await expect(page.getByRole('heading', { name: 'No shopping items' })).toBeVisible()
  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'Mark Buy six eggs incomplete' }).click()
  await page.getByRole('button', { name: 'Edit task' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Buy eggs from Agora')
  await page.getByLabel('Place hint').fill('Agora')
  await page.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByRole('heading', { name: 'Buy eggs from Agora' })).toBeVisible()
  await page.goto('/app/shopping')
  await expect(page.getByRole('heading', { name: 'Agora' })).toBeVisible()
  await page.goto('/app/events')
  await expect(page.getByRole('heading', { name: 'Class', exact: true })).toBeVisible()
  await expect(page.getByText('2026-09-22 · time not specified')).toBeVisible()
  await page.goto('/app/expenses')
  await expect(page.getByText('BDT 240.00')).toBeVisible()

  const second = await browser.newContext()
  const other = await second.newPage()
  await register(other)
  await other.goto(noteUrl)
  await expect(other.getByRole('heading', { name: 'Note not found' })).toBeVisible()
  // Exercise the API directly as B with B's real Supabase JWT, not just React hiding content.
  const checks = await other.evaluate(async (id) => {
    const base = 'http://127.0.0.1:8000/api/v1'
    const supabaseKey = Object.keys(localStorage).find((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
    const stored = supabaseKey ? JSON.parse(localStorage.getItem(supabaseKey)) : null
    const access = stored?.access_token
    const statuses = []
    for (const suffix of ['analyze', 'confirm-analysis']) {
      const response = await fetch(`${base}/notes/${id}/${suffix}/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
        body: JSON.stringify({ revision: 0, items: [] })
      })
      statuses.push(response.status)
    }
    const items = await fetch(`${base}/items/`, { headers: { Authorization: `Bearer ${access}` } })
    return { statuses, items: await items.json() }
  }, noteId)
  expect(checks).toEqual({ statuses: [404, 404], items: [] })
  await second.close()

  await page.goto(noteUrl)
  await expect(page.getByText(multiNote, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible()
  await page.goto('/app/tasks')
  await expect(page.getByRole('heading', { name: 'No tasks yet' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('mobile provider failure leaves raw note and manual organization persists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await register(page)
  // Mobile quick-capture success link is visible even when secondary editor is hidden.
  await page.goto('/app/notes/new')
  await page.getByLabel('Your thought').fill('E2E simulate AI timeout')
  await page.getByRole('button', { name: /^Save note/i }).click()
  await page.getByRole('button', { name: 'Analyze note' }).click()
  await expect(page.getByRole('alert')).toContainText('Your note is saved')
  await expect(page.getByText('E2E simulate AI timeout', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Organize Manually' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Manual groceries')
  await page.getByLabel('shopping', { exact: true }).check()
  await page.getByLabel('Place hint').fill('Agora')
  await page.getByRole('button', { name: 'Confirm all' }).click()
  await expect(page.getByText('Organization confirmed and saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Manual groceries' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Toggle menu' }).click()
  await page.locator('.mobile-menu').getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Manual groceries' })).toBeVisible()
})

test('empty analysis and removing draft items are explicit review decisions', async ({ page }) => {
  await register(page)
  await capture(page, 'I need eggs from Agora.')
  await page.getByRole('button', { name: 'Analyze note' }).click()
  await page.getByRole('button', { name: 'Remove item 1' }).click()
  await page.getByRole('button', { name: 'Confirm empty review' }).click()
  await expect(page.getByText('Organization confirmed and saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/No structured items found/)).toBeVisible()
  await page.goto('/app')
  await capture(page, 'E2E zero items')
  await page.getByRole('button', { name: 'Analyze note' }).click()
  await expect(page.getByText(/No structured items found/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm empty review' }).click()
  await expect(page.getByText('Organization confirmed and saved.')).toBeVisible()
})
