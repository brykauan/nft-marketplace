import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await fetch('/api/reset', { method: 'POST' })
    localStorage.removeItem('kurio-demo-db-v2')
  })
  await page.reload()
})

test('catálogo abre e filtra por nome', async ({ page }) => {
  await expect(page.getByText('Emerald Ape').first()).toBeVisible()
  await page.getByRole('textbox', { name: 'Pesquisar NFTs' }).fill('Emerald')
  await expect(page.getByText('Emerald Ape').first()).toBeVisible()
  await expect(page).toHaveURL(/q=Emerald/)
})

test('rota inexistente de NFT exibe feedback', async ({ page }) => {
  await page.goto('/nft/999999')
  await expect(page.getByText(/NFT não encontrado/i).first()).toBeVisible()
})

test('login demonstra conta e perfil', async ({ page }) => {
  await page.getByRole('button', { name: /Entrar/i }).first().click()
  await page.getByRole('dialog', { name: 'Entrar' }).getByLabel('E-mail').fill('demo@kurio.com')
  await page.getByRole('dialog', { name: 'Entrar' }).getByLabel('Senha').fill('Demo1234!')
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Perfil').first()).toBeVisible()
  await page.goto('/perfil')
  await expect(page.getByText('Meu perfil').first()).toBeVisible()
})
