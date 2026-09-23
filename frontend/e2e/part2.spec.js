import { expect, test } from '@playwright/test'

test('user can register and complete persistent Notes CRUD', async ({ page }) => {
  const unique = Date.now()
  const email = `playwright-${unique}@example.com`
  const password = 'Cedar!River9426'

  await page.goto('/register')
  await page.getByLabel('Name').fill('Browser Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByRole('heading', { name: /good morning, browser tester/i })).toBeVisible()

  await page.getByRole('link', { name: /notes$/i }).first().click()
  await page.getByRole('link', { name: /new note/i }).click()
  await page.getByLabel('Your thought').fill('Buy eggs.')
  await page.getByRole('button', { name: /save note/i }).click()
  await expect(page.getByRole('heading', { name: /captured thought/i })).toBeVisible()
  await expect(page.getByText('Buy eggs.', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Buy eggs.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('textbox').fill('Buy eggs from Agora.')
  await page.getByRole('button', { name: /save changes/i }).click()
  await expect(page.getByText('Buy eggs from Agora.', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Buy eggs from Agora.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: /^notes$/i })).toBeVisible()
  await expect(page.getByText('Buy eggs from Agora.', { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Buy eggs from Agora.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /log out/i }).click()
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await page.goto('/app/notes')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page.getByRole('heading', { name: /good morning, browser tester/i })).toBeVisible()
})
