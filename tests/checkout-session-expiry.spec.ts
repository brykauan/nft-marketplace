import { test, expect } from '@playwright/test'

const DEMO_EMAIL = 'demo@kurio.com'
const DEMO_PASSWORD = 'Demo1234!'

test.beforeEach(async ({ page }) => {
  await page.goto('/')

  // A primeira navegação pode ocorrer antes do Service Worker assumir a página.
  // Aguarda a interface e tenta novamente apenas a preparação do cenário.
  await expect(page.getByRole('link', { name: 'KURIO' }).first()).toBeVisible()

  let lastError = 'Sem resposta'
  let resetOk = false

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/reset', { method: 'POST' })
        return {
          ok: response.ok,
          status: response.status,
          body: (await response.text()).slice(0, 300),
        }
      } catch (error) {
        return { ok: false, status: 0, body: String(error) }
      }
    })

    if (result.ok) {
      resetOk = true
      break
    }

    lastError = `HTTP ${result.status}: ${result.body}`
    await page.waitForTimeout(300)
    await page.reload()
  }

  if (!resetOk) throw new Error(`Falha ao resetar MSW após 5 tentativas. Última resposta: ${lastError}`)
  await page.reload()
})

test('sessão expirada no checkout permite login e compra sem duplicar pedido', async ({ page }) => {
  // Prepara os dados pela API simulada; o restante do fluxo é feito pela interface.
  await page.evaluate(async ({ email, password }) => {
    const post = (path: string, body: unknown) =>
      fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    const login = await post('login', { email, password })
    if (!login.ok) throw new Error(`Login de preparação falhou: ${login.status}`)

    const add = await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, qty: 2 }),
    })
    if (!add.ok) throw new Error(`Carrinho de preparação falhou: ${add.status}`)
  }, { email: DEMO_EMAIL, password: DEMO_PASSWORD })

  await page.goto('/pagamento')
await expect(
  page.getByRole('heading', { name: 'Pagamento', exact: true })
).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Cupom' }).fill('KURIO10')
  await expect(page.getByText('Desconto', { exact: true })).toBeVisible()
  const confirm = page.getByRole('checkbox', {
    name: 'Confirmo os itens, valores e condições da compra.',
  })
  await confirm.check()

  // O prazo expira nos dados do MSW, mas a tela ainda não sabe.
  // Ao enviar o pedido, a API deve responder 401 e acionar a reautenticação.
  await page.evaluate(() => {
    const key = 'kurio-demo-db-v4'
    const raw = localStorage.getItem(key)
    if (!raw) throw new Error('Banco local do MSW não encontrado')
    const store = JSON.parse(raw)
    store.sessionExpiresAt = Date.now() - 1000
    localStorage.setItem(key, JSON.stringify(store))
  })

  // O MSW mantém também uma cópia do estado em memória. Para que a expiração
  // seja lida pelo mock atual, é necessário recarregar a página.
  await page.reload()

  // O checkout protegido deve solicitar autenticação na mesma URL.
  await expect(page).toHaveURL(/\/pagamento(?:\?|$)/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('textbox', { name: 'E-mail' }).fill(DEMO_EMAIL)
  await page.getByRole('dialog').locator('input[type="password"]').fill(DEMO_PASSWORD)
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()

  await expect(page).toHaveURL(/\/pagamento(?:\?|$)/)
  await expect(page.getByRole('heading', { name: 'Pagamento', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Cupom' })).toHaveValue('KURIO10')
  await expect(confirm).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()

  const before = await page.evaluate(async () => {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error(`Erro ao consultar pedidos: ${response.status}`)
    return (await response.json()).length as number
  })
  expect(before).toBe(0)

  await confirm.check()
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()
  await expect(page).toHaveURL(/\/pedido\//)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado!' })).toBeVisible()

  const after = await page.evaluate(async () => {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error(`Erro ao consultar pedidos: ${response.status}`)
    return await response.json() as Array<{ id: string; status: string; items: Array<{ qty: number }> }>
  })
  expect(after).toHaveLength(1)
  expect(after[0].status).toBe('confirmed')
  expect(after[0].items[0].qty).toBe(2)
})
