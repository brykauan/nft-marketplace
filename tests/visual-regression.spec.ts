import { test, expect, type Page } from '@playwright/test'

const DEMO = { email: 'demo@kurio.com', password: 'Demo1234!' }

/**
 * Os snapshots são separados automaticamente pelo projeto do Playwright:
 * desktop-chromium e mobile-chromium.
 */
async function resetMocks(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /SEJA DONO DO FUTURO/i })).toBeVisible()

  // O app inicializa o worker MSW de maneira assíncrona. Aguarde até
  // a rota simulada responder, sem chamar um backend inexistente.
  await expect.poll(async () => {
    return page.evaluate(async () => {
      try {
        const response = await fetch('/api/reset', { method: 'POST' })
        if (!response.ok) return false
        const data = await response.json().catch(() => null)
        return data?.ok === true
      } catch {
        return false
      }
    })
  }, { timeout: 15_000, intervals: [150, 300, 500, 1000] }).toBe(true)

  await page.reload()
  await expect(page.getByRole('heading', { name: /SEJA DONO DO FUTURO/i })).toBeVisible()
}

async function loginAndAddItem(page: Page) {
  await page.evaluate(async (credentials) => {
    const login = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!login.ok) throw new Error(`Login de fixture falhou: HTTP ${login.status}`)

    const cart = await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, qty: 2 }),
    })
    if (!cart.ok) throw new Error(`Carrinho de fixture falhou: HTTP ${cart.status}`)
  }, DEMO)

  // Força a aplicação a recuperar a sessão e o carrinho da API simulada.
  await page.reload()
}

async function stabilizeScreenshot(page: Page) {
  // Aguarda fontes e imagens visíveis para evitar snapshots com layout incompleto.
  await page.evaluate(async () => {
    await document.fonts.ready
    const images = [...document.querySelectorAll<HTMLImageElement>('img')]
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve()
      return new Promise<void>(resolve => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
        setTimeout(resolve, 4000)
      })
    }))
  })
}

async function expectVisual(page: Page, filename: string) {
  await stabilizeScreenshot(page)
  await expect(page).toHaveScreenshot(filename, {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    // Tolerância pequena para diferenças de antialiasing entre execuções.
    maxDiffPixelRatio: 0.01,
  })
}

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
})

test('visual: início e catálogo', async ({ page }) => {
  await expect(page.locator('.nft-card').first()).toBeVisible()
  await expect(page.locator('.skeleton')).toHaveCount(0)
  await expectVisual(page, 'inicio.png')
})

test('visual: detalhes do NFT', async ({ page }) => {
  await page.goto('/nft/1')
  await expect(page.locator('.detail-layout')).toBeVisible()
  await expect(page.locator('.nft-photo.large')).toBeVisible()
  await expectVisual(page, 'detalhe.png')
})

test('visual: carrinho com itens', async ({ page }) => {
  await loginAndAddItem(page)
  await page.goto('/carrinho')
  await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
  await expect(page.locator('.cart-item')).toHaveCount(1)
  await expect(page.locator('.summary-total')).toContainText('ETH')
  await expectVisual(page, 'carrinho.png')
})

test('visual: pagamento com carteira e cotação', async ({ page }) => {
  await loginAndAddItem(page)
  await page.goto('/pagamento')
  await expect(page.getByRole('heading', { name: 'Pagamento', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeVisible()
  await expect(page.locator('.summary-total')).toContainText('ETH')
  await expect(page.locator('.summary-total')).not.toContainText('—')
  await expectVisual(page, 'pagamento.png')
})
