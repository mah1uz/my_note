import { expect, test } from '@playwright/test'

test('user can log in, capture a note, and open it', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email or username').fill('maya@example.com')
  await page.getByLabel('Password').fill('secret123')
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page.getByRole('heading', { name: /good morning, maya/i })).toBeVisible()
  await page.getByLabel('What do you want to remember?').fill('Buy coffee from Agora')
  await page.getByRole('button', { name: /save note/i }).click()
  await page.getByRole('link', { name: /Notes$/i }).click()
  await expect(page.getByRole('link', { name: 'Buy coffee from Agora', exact: true })).toBeVisible()
  await page.getByRole('link', { name: /view buy coffee from agora/i }).click()
  await expect(page.getByRole('heading', { name: /captured thought/i })).toBeVisible()
})
