import { expect, test, type Page } from '@playwright/test'

// Cada teste do Playwright usa um contexto de navegador isolado.
// Aguardamos o aplicativo carregar antes de chamar os endpoints interceptados pelo MSW.
async function openMarketplace(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Emerald Ape').first()).toBeVisible()
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/reset', { method: 'POST' })
    return response.ok
  })
  expect(result).toBe(true)
}

test('senhas persistidas são hashes, inclusive após cadastro e alteração', async ({ page }) => {
  await openMarketplace(page)

  const result = await page.evaluate(async () => {
    const post = (url: string, body: unknown) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    const initial = localStorage.getItem('kurio-demo-db-v4') ?? ''
    const email = 'novo-teste@kurio.com'
    const signup = await post('/api/signup', {
      name: 'Novo Colecionador',
      email,
      password: 'SenhaOriginal123!',
    })
    const afterSignup = localStorage.getItem('kurio-demo-db-v4') ?? ''
    const update = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'SenhaAtualizada456!' }),
    })
    const afterUpdate = localStorage.getItem('kurio-demo-db-v4') ?? ''
    await post('/api/logout', {})
    const oldLogin = await post('/api/login', {
      email,
      password: 'SenhaOriginal123!',
    })
    const newLogin = await post('/api/login', {
      email,
      password: 'SenhaAtualizada456!',
    })

    return {
      initial,
      afterSignup,
      afterUpdate,
      signupStatus: signup.status,
      updateStatus: update.status,
      oldLoginStatus: oldLogin.status,
      newLoginStatus: newLogin.status,
    }
  })

  expect(result.initial).not.toContain('Demo1234!')
  expect(result.initial).not.toContain('Teste1234!')
  expect(result.initial).toContain('pbkdf2$')
  expect(result.signupStatus).toBe(200)
  expect(result.afterSignup).not.toContain('SenhaOriginal123!')
  expect(result.updateStatus).toBe(200)
  expect(result.afterUpdate).not.toContain('SenhaAtualizada456!')
  expect(result.oldLoginStatus).toBe(401)
  expect(result.newLoginStatus).toBe(200)
})

test('sessão expirada bloqueia endpoints privados e permite novo login', async ({ page }) => {
  await openMarketplace(page)

  const loginStatus = await page.evaluate(async () => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@kurio.com', password: 'Demo1234!' }),
    })
    return response.status
  })
  expect(loginStatus).toBe(200)

  // Expiração determinística: não é necessário esperar 30 minutos.
  await page.evaluate(() => {
    const key = 'kurio-demo-db-v4'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.sessionExpiresAt = Date.now() - 1000
    localStorage.setItem(key, JSON.stringify(state))
  })

  // O mock mantém estado em memória; recarregar força sua restauração do localStorage.
  await page.reload()
  await expect(page.getByText('Emerald Ape').first()).toBeVisible()

  const result = await page.evaluate(async () => {
    const session = await fetch('/api/session')
    const sessionData: unknown = await session.json()
    const profile = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Não deveria funcionar' }),
    })
    const orders = await fetch('/api/orders')
    const loginAgain = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@kurio.com', password: 'Demo1234!' }),
    })
    const recovered = await fetch('/api/session')
    const recoveredUser = (await recovered.json()) as { id?: string } | null
    return {
      sessionData,
      profileStatus: profile.status,
      ordersStatus: orders.status,
      loginStatus: loginAgain.status,
      recoveredId: recoveredUser?.id,
    }
  })

  expect(result.sessionData).toBeNull()
  expect(result.profileStatus).toBe(401)
  expect(result.ordersStatus).toBe(401)
  expect(result.loginStatus).toBe(200)
  expect(result.recoveredId).toBe('demo')
})

test('logout e troca de usuário isolam pedidos, carteiras e perfil', async ({ page }) => {
  await openMarketplace(page)

  const result = await page.evaluate(async () => {
    const api = async (method: string, path: string, body?: unknown) => {
      return fetch('/api/' + path, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
      })
    }

    const firstLogin = await api('POST', 'login', {
      email: 'demo@kurio.com',
      password: 'Demo1234!',
    })
    const firstAccount = (await firstLogin.json()) as { id: string; wallets: string[] }
    await api('PUT', 'cart', { id: 1, qty: 1 })
    const orderResponse = await api('POST', 'orders', {
      wallet: firstAccount.wallets[0],
      idempotencyKey: crypto.randomUUID(),
      scenario: 'confirmed',
    })
    const createdOrder = (await orderResponse.json()) as { id: string }
    const logout = await api('POST', 'logout')
    const ordersAfterLogout = await api('GET', 'orders')
    const secondLogin = await api('POST', 'login', {
      email: 'teste@kurio.com',
      password: 'Teste1234!',
    })
    const secondAccount = (await secondLogin.json()) as { id: string; wallets: string[] }
    const secondOrders = await api('GET', 'orders')
    const secondOrderList = (await secondOrders.json()) as Array<{ id: string }>
    const firstOrderAsSecond = await api('GET', 'orders/' + createdOrder.id)
    const secondSession = await api('GET', 'session')
    const secondSessionData = (await secondSession.json()) as { id: string; wallets: string[] }

    return {
      firstLoginStatus: firstLogin.status,
      orderStatus: orderResponse.status,
      logoutStatus: logout.status,
      ordersAfterLogoutStatus: ordersAfterLogout.status,
      secondLoginStatus: secondLogin.status,
      secondOrdersStatus: secondOrders.status,
      secondOrderIds: secondOrderList.map(o => o.id),
      createdOrderId: createdOrder.id,
      forbiddenOrderStatus: firstOrderAsSecond.status,
      firstId: firstAccount.id,
      secondId: secondAccount.id,
      secondWallets: secondSessionData.wallets,
      secondSessionId: secondSessionData.id,
    }
  })

  expect(result.firstLoginStatus).toBe(200)
  expect(result.orderStatus).toBe(200)
  expect(result.logoutStatus).toBe(200)
  expect(result.ordersAfterLogoutStatus).toBe(401)
  expect(result.secondLoginStatus).toBe(200)
  expect(result.secondOrdersStatus).toBe(200)
  expect(result.secondOrderIds).not.toContain(result.createdOrderId)
  expect(result.forbiddenOrderStatus).toBe(404)
  expect(result.secondSessionId).toBe(result.secondId)
  expect(result.secondId).not.toBe(result.firstId)
  expect(result.secondWallets).toEqual([])
})
