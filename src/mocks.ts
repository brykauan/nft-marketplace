import { http, HttpResponse, delay, ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { setupWorker } from 'msw/browser'
import { nfts, type CartItem, type User, type Order } from './data'
type Store = { users: User[]; session: string | null; sessionExpiresAt?: number; carts: Record<string, CartItem[]>; orders: Order[]; coupons: Record<string, boolean>; orderFingerprints?: Record<string, string> }
const socketLink = ws.link(
  new URL('/', window.location.origin)
    .href.replace(/^http/, 'ws')
)
console.log('[MSW SOCKET] Handler configurado')
type LivePeer = { emit: (name: string, event: unknown) => void }
const connected = new Set<LivePeer>()
const eventVersions = new Map<string, number>()
const emitEvent = (name: 'nft.updated' | 'order.updated', id: number | string, payload: object) => {
  const key = `${name}:${id}`; const version = (eventVersions.get(key) || 0) + 1; eventVersions.set(key, version)
  for (const peer of connected) peer.emit(name, { id, version, ...payload })
}
const socketHandler = socketLink.addEventListener(
  'connection',
  connection => {
    console.info('[MSW SOCKET] Conexão recebida')

    const io = toSocketIo(connection)

    connected.add(io.client)

    connection.client.addEventListener('close', () => {
      console.info('[MSW SOCKET] Conexão encerrada')
      connected.delete(io.client)
    })
  }
)
const initialNfts = nfts.map(n => ({ ...n }))
const KEY = 'kurio-demo-db-v4'
const SESSION_DURATION_MS = 30 * 60 * 1000
const HASH_ITERATIONS = 120_000
const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map(x => parseInt(x, 16)) || [])
async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' }, material, 256)
  return bytesToHex(new Uint8Array(bits))
}
async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${HASH_ITERATIONS}$${bytesToHex(salt)}$${await derivePassword(password, salt, HASH_ITERATIONS)}`
}
async function verifyPassword(password: string, stored: string) {
  const [scheme, rounds, salt, expected] = stored.split('$')
  if (scheme !== 'pbkdf2' || !/^\d+$/.test(rounds) || !salt || !expected) return false
  const count = Number(rounds)
  if (count < 1 || count > 1_000_000 || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{64}$/.test(expected)) return false
  const actual = await derivePassword(password, hexToBytes(salt), count)
  let diff = 0
  for (let i = 0; i < expected.length; i++)diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
  return diff === 0
}

const fingerprint = (b: { wallet: string; coupon?: string; scenario?: string }, items: CartItem[]) => JSON.stringify({ wallet: b.wallet, coupon: (b.coupon || '').toUpperCase(), scenario: b.scenario || 'confirmed', items: [...items].sort((a, c) => a.id - c.id) })
const initial = (): Store => ({ users: [{ id: 'demo', name: 'Colecionador Demo', email: 'demo@kurio.com', password: 'Demo1234!', wallets: ['0x71C765A07eB8D4a142aE6FaC83E7F23D42cA8877'], favorites: [] }, { id: 'demo2', name: 'Outro Colecionador', email: 'teste@kurio.com', password: 'Teste1234!', wallets: [], favorites: [] }], session: null, carts: {}, orders: [], coupons: {}, orderFingerprints: {} })
let db: Store = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || initial() } catch { return initial() } })()
let initialized = false
function save() { if (initialized) localStorage.setItem(KEY, JSON.stringify(db)) }
// Converte registros antigos para hashes antes de salvar qualquer alteração.
async function initialize() {
  for (const u of db.users) {
    if (!u.password.startsWith('pbkdf2$')) u.password = await hashPassword(u.password)
  }
  // Sessões anteriores à migração recebem duração limitada.
  if (db.session && !db.sessionExpiresAt) db.sessionExpiresAt = Date.now() + SESSION_DURATION_MS
  initialized = true
  save()
}
const ready = initialize()
function expireSessionIfNeeded() {
  if (db.session && (!db.sessionExpiresAt || Date.now() >= db.sessionExpiresAt)) {
    db.session = null
    db.sessionExpiresAt = undefined
    save()
  }
}
const user = () => { expireSessionIfNeeded(); return db.users.find(u => u.id === db.session) }
const who = () => user()?.id || 'guest'
const privateUser = () => user() || null
const error = (message: string, status = 400) => HttpResponse.json({ message }, { status })
const safeUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, wallets: u.wallets, favorites: u.favorites })
const toMicro = (value: string) => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 1000000n + BigInt((fraction + '000000').slice(0, 6)) }
const asETH = (micro: bigint, places = 6) => { const units = micro / 1000000n; const fraction = (micro % 1000000n).toString().padStart(6, '0').slice(0, places); return places ? `${units}.${fraction}` : units.toString() }
const sum = (items: CartItem[], code?: string) => { const subtotal = items.reduce((acc, item) => acc + toMicro(nfts.find(n => n.id === item.id)?.price || '0') * BigInt(item.qty), 0n); const discount = code?.toUpperCase() === 'KURIO10' ? subtotal / 10n : 0n; const fee = items.length ? 3000n : 0n; return { subtotal: asETH(subtotal), discount: asETH(discount), fee: asETH(fee), total: asETH(subtotal - discount + fee) } }

// Deterministic pending scenario: settles after 2 seconds, even if the page reloads.
function settle(o: Order): Order {
  if (o.status === 'pending' && Date.now() - Date.parse(o.createdAt) > 2000) {
    o.status = 'confirmed';
    const cart = db.carts[o.userId] || [];
    for (const purchased of o.items) { const item = cart.find(x => x.id === purchased.nft.id); if (item) item.qty = Math.max(0, item.qty - purchased.qty) }
    db.carts[o.userId] = cart.filter(x => x.qty > 0);
    save();
    emitEvent('order.updated', o.id, { userId: o.userId, status: o.status, order: { ...o } })
  }
  return o;
}
const handlers = [
  socketHandler,
  http.post('/api/scenarios/nft-update', async ({ request }) => {
    const body = await request.json() as { id: number; price?: string; stock?: number }
    const nft = nfts.find(n => n.id === body.id)
    if (!nft) return error('NFT não encontrado', 404)
    if (body.price !== undefined) { if (!/^\d+(\.\d{1,6})?$/.test(body.price)) return error('Preço inválido'); nft.price = body.price }
    if (body.stock !== undefined) { if (!Number.isInteger(body.stock) || body.stock < 0) return error('Estoque inválido'); nft.stock = body.stock }
    emitEvent('nft.updated', nft.id, { nft: { ...nft } })
    return HttpResponse.json({ ...nft })
  }),
  http.post('/api/scenarios/settle-order', async ({ request }) => {
    const body = await request.json() as { id: string; status: 'confirmed' | 'refused' }
    const order = db.orders.find(o => o.id === body.id && o.userId === db.session)
    if (!order) return error('Pedido não encontrado', 404)
    if (order.status !== 'pending') return error('Pedido já finalizado', 409)
    order.status = body.status
    if (order.status === 'confirmed') {
      const cart = db.carts[order.userId] || []
      for (const purchased of order.items) { const found = cart.find(i => i.id === purchased.nft.id); if (found) found.qty = Math.max(0, found.qty - purchased.qty) }
      db.carts[order.userId] = cart.filter(i => i.qty > 0)
    }
    save(); emitEvent('order.updated', order.id, { userId: order.userId, status: order.status, order: { ...order } })
    return HttpResponse.json(order)
  }),
  http.get('/api/nfts', async ({ request }) => { await delay(180); const p = new URL(request.url).searchParams; let out = [...nfts]; const q = (p.get('q') || '').toLowerCase(); if (q) out = out.filter(n => (n.name + ' ' + n.collection).toLowerCase().includes(q)); const collection = p.get('collection'); if (collection) out = out.filter(n => n.collection === collection); const sort = p.get('sort'); if (sort === 'price-asc') out.sort((a, b) => Number(a.price) - Number(b.price)); if (sort === 'price-desc') out.sort((a, b) => Number(b.price) - Number(a.price)); if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name)); const max = Number(p.get('max') || 12.30); out = out.filter(n => Number(n.price) <= max); const page = Math.max(1, Number(p.get('page') || 1)); return HttpResponse.json({ items: out.slice((page - 1) * 6, page * 6), total: out.length, pages: Math.max(1, Math.ceil(out.length / 6)) }) }),
  http.get('/api/nfts/:id', ({ params }) => { const item = nfts.find(n => n.id === Number(params.id)); return item ? HttpResponse.json(item) : error('NFT não encontrado', 404) }),
  http.get('/api/session', async () => { await ready; const current = privateUser(); return HttpResponse.json(current ? safeUser(current) : null) }),
  http.post('/api/login', async ({ request }) => { await ready; const b = await request.json() as { email: string; password: string }; const u = db.users.find(x => x.email.toLowerCase() === b.email?.toLowerCase()); if (!u || !await verifyPassword(b.password || '', u.password)) return error('E-mail ou senha inválidos', 401); const guest = db.carts.guest || []; db.session = u.id; db.sessionExpiresAt = Date.now() + SESSION_DURATION_MS; if (guest.length) { const target = db.carts[u.id] || []; guest.forEach(i => { const prior = target.find(x => x.id === i.id); if (prior) prior.qty += i.qty; else target.push(i) }); db.carts[u.id] = target; delete db.carts.guest } save(); return HttpResponse.json(safeUser(u)) }),
  http.post('/api/signup', async ({ request }) => { await ready; const b = await request.json() as { name: string; email: string; password: string }; if (!b.name?.trim() || !b.email?.includes('@') || !b.password || b.password.length < 8) return error('Preencha os campos; senha com pelo menos 8 caracteres'); if (db.users.some(u => u.email.toLowerCase() === b.email.toLowerCase())) return error('Este e-mail já está cadastrado', 409); const u: User = { id: crypto.randomUUID(), name: b.name.trim(), email: b.email.toLowerCase(), password: await hashPassword(b.password), wallets: [], favorites: [] }; db.users.push(u); const guest = db.carts.guest || []; db.session = u.id; db.sessionExpiresAt = Date.now() + SESSION_DURATION_MS; db.carts[u.id] = guest; delete db.carts.guest; save(); return HttpResponse.json(safeUser(u)) }),
  http.post('/api/logout', () => { db.session = null; db.sessionExpiresAt = undefined; save(); return HttpResponse.json({ ok: true }) }),
  http.put('/api/profile', async ({ request }) => { await ready; const u = privateUser(); if (!u) return error('Faça login', 401); const b = await request.json() as { name?: string; avatar?: string; password?: string }; if (b.name !== undefined) { if (!b.name.trim()) return error('Nome obrigatório'); u.name = b.name.trim() } if (b.avatar !== undefined) u.avatar = b.avatar; if (b.password) { if (b.password.length < 8) return error('Senha deve ter no mínimo 8 caracteres'); u.password = await hashPassword(b.password) } save(); return HttpResponse.json(safeUser(u)) }),
  http.put('/api/wallets', async ({ request }) => { const u = privateUser(); if (!u) return error('Faça login', 401); const b = await request.json() as { wallets: string[] }; if (!b.wallets.every(x => /^0x[a-fA-F0-9]{40}$/.test(x))) return error('Carteira inválida. Use o endereço hexadecimal 0x (42 caracteres).'); u.wallets = b.wallets; save(); return HttpResponse.json(safeUser(u)) }),
  http.post('/api/favorites/:id', ({ params }) => { const u = privateUser(); if (!u) return error('Faça login', 401); const id = Number(params.id); if (!nfts.some(n => n.id === id)) return error('NFT não encontrado', 404); u.favorites = u.favorites.includes(id) ? u.favorites.filter(x => x !== id) : [...u.favorites, id]; save(); return HttpResponse.json(safeUser(u)) }),
  http.get('/api/cart', () => HttpResponse.json(db.carts[who()] || [])),
  http.put('/api/cart', async ({ request }) => { const b = await request.json() as { id: number; qty: number }; const nft = nfts.find(n => n.id === b.id); if (!nft) return error('NFT não encontrado', 404); if (!Number.isInteger(b.qty) || b.qty < 0 || b.qty > nft.stock) return error('Quantidade indisponível', 409); const cart = db.carts[who()] || []; db.carts[who()] = cart.filter(x => x.id !== b.id); if (b.qty > 0) db.carts[who()].push({ id: b.id, qty: b.qty }); save(); return HttpResponse.json(db.carts[who()]) }),
  http.post('/api/quote', async ({ request }) => { const b = await request.json() as { coupon?: string }; if (b.coupon && b.coupon.toUpperCase() !== 'KURIO10') return error('Cupom inválido ou expirado'); return HttpResponse.json(sum(db.carts[who()] || [], b.coupon)) }),
  http.get('/api/orders', () => { const u = privateUser(); if (!u) return error('Faça login', 401); return HttpResponse.json(db.orders.filter(o => o.userId === u.id).map(settle)) }),
  http.get('/api/orders/:id', ({ params }) => { const u = privateUser(); if (!u) return error('Faça login', 401); const o = db.orders.find(o => o.id === params.id && o.userId === u.id); return o ? HttpResponse.json(settle(o)) : error('Pedido não encontrado', 404) }),
  http.post('/api/orders', async ({ request }) => { const u = privateUser(); if (!u) return error('Faça login', 401); if (!u.wallets.length) return error('Cadastre uma carteira', 400); const b = await request.json() as { coupon?: string; wallet: string; idempotencyKey: string; scenario?: 'confirmed' | 'pending' | 'refused' }; if (!u.wallets.includes(b.wallet)) return error('Carteira inválida', 400); const existing = db.orders.find(x => x.id === b.idempotencyKey); if (existing) { if (existing.userId !== u.id) return error('Conflito de pedido', 409); const signature = fingerprint(b, existing.items.map(x => ({ id: x.nft.id, qty: x.qty }))); if (db.orderFingerprints?.[existing.id] !== signature) return error('Chave de idempotência reutilizada com conteúdo diferente', 409); return HttpResponse.json(settle(existing)) } const items = db.carts[u.id] || []; if (!items.length) return error('Carrinho vazio'); if (items.some(i => i.qty > Number(nfts.find(n => n.id === i.id)?.stock || 0))) return error('Quantidade esgotada', 409); if (b.coupon && b.coupon.toUpperCase() !== 'KURIO10') return error('Cupom inválido', 400); const amounts = sum(items, b.coupon); const order: Order = { id: b.idempotencyKey, userId: u.id, items: items.map(x => ({ nft: { ...nfts.find(n => n.id === x.id)! }, qty: x.qty })), subtotal: amounts.subtotal, fee: amounts.fee, total: amounts.total, status: b.scenario === 'refused' ? 'refused' : b.scenario === 'pending' ? 'pending' : 'confirmed', createdAt: new Date().toISOString() }; db.orders.push(order); db.orderFingerprints ??= {}; db.orderFingerprints[order.id] = fingerprint(b, items); if (order.status === 'confirmed') db.carts[u.id] = []; save(); emitEvent('order.updated', order.id, { userId: u.id, status: order.status, order: { ...order } }); return HttpResponse.json(order) }),
  http.post('/api/reset', async () => { await ready; db = initial(); for (const u of db.users) u.password = await hashPassword(u.password); nfts.splice(0, nfts.length, ...initialNfts.map(n => ({ ...n }))); eventVersions.clear(); save(); return HttpResponse.json({ ok: true }) }),
]
export const worker = setupWorker(...handlers)
