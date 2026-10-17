import { test, expect } from '@playwright/test'

async function reset(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /SEJA DONO DO FUTURO/i })).toBeVisible()
  await expect.poll(async () => {
    return page.evaluate(async () => {
      try {
        const response = await fetch('/api/reset', { method: 'POST' })
        return response.ok
      } catch { return false }
    })
  }, { timeout: 15_000 }).toBe(true)
}

async function configure(page: import('@playwright/test').Page, scenario: Record<string, unknown>) {
  await page.evaluate(async body => {
    const response = await fetch('/api/scenarios/network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Configuração de rede falhou: ${response.status}`)
  }, scenario)
}

test.beforeEach(async ({ page }) => reset(page))

test('erro HTTP configurável na listagem e recuperação', async ({ page }) => {
  await configure(page, { target: 'nfts', mode: 'http-error', status: 503, count: 2 })
  const result = await page.evaluate(async () => {
    const first = await fetch('/api/nfts')
    const second = await fetch('/api/nfts')
    const recovered = await fetch('/api/nfts')
    return [first.status, second.status, recovered.status]
  })
  expect(result).toEqual([503, 503, 200])
})

test('falha de conexão não impede nova tentativa', async ({ page }) => {
  await configure(page, { target: 'nfts', mode: 'network-error' })
  const result = await page.evaluate(async () => {
    let failed = false
    try { await fetch('/api/nfts') } catch { failed = true }
    const second = await fetch('/api/nfts')
    return { failed, recovered: second.status }
  })
  expect(result).toEqual({ failed: true, recovered: 200 })
})

test('respostas fora de ordem são reproduzíveis', async ({ page }) => {
  await configure(page, { target: 'nfts', mode: 'out-of-order', delayMs: 700, count: 2 })
  const arrivals = await page.evaluate(async () => {
    const order: string[] = []
    const first = fetch('/api/nfts?q=primeiro').then(() => order.push('primeiro'))
    await new Promise(resolve => setTimeout(resolve, 80))
    const second = fetch('/api/nfts?q=segundo').then(() => order.push('segundo'))
    await Promise.all([first, second])
    return order
  })
  expect(arrivals).toEqual(['segundo', 'primeiro'])
})

test('timeout HTTP simulado é configurável e recuperável', async ({ page }) => {
  await configure(page, { target: 'quote', mode: 'timeout', delayMs: 100, count: 1 })
  const result = await page.evaluate(async () => {
    const quote = () => fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const first = await quote()
    const next = await quote()
    return [first.status, next.status]
  })
  expect(result).toEqual([504, 200])
})
