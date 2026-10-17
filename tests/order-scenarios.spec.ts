import {test,expect} from '@playwright/test'

test.beforeEach(async ({page})=>{
  await page.goto('/')
  await page.evaluate(async()=>{await fetch('/api/reset',{method:'POST'})})
  await page.reload()
})

async function prepare(page:import('@playwright/test').Page){
  return page.evaluate(async()=>{
    const post=async(path:string,body:unknown)=>fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    await post('login',{email:'demo@kurio.com',password:'Demo1234!'})
    await fetch('/api/cart',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,qty:2})})
    return post('quote',{}).then(r=>r.json())
  })
}

test('pagamento recusado preserva carrinho e recibo reflete recusa',async({page})=>{
  await prepare(page)
  const result=await page.evaluate(async()=>{
    const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet:'0x71C765A07eB8D4a142aE6FaC83E7F23D42cA8877',idempotencyKey:'refused-test',scenario:'refused'})})
    return r.json()
  })
  expect(result.status).toBe('refused')
  await page.goto('/pedido/refused-test')
  await expect(page.getByText('Pagamento recusado')).toBeVisible()
  const qty=await page.evaluate(async()=>(await (await fetch('/api/cart')).json())[0].qty)
  expect(qty).toBe(2)
})

test('pedido pendente recupera após refresh e evita duplicatas',async({page})=>{
  await prepare(page)
  const result=await page.evaluate(async()=>{
    const body={wallet:'0x71C765A07eB8D4a142aE6FaC83E7F23D42cA8877',idempotencyKey:'pending-test',scenario:'pending'}
    const request=()=>fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    const a=await (await request()).json();const b=await (await request()).json()
    return {a,b}
  })
  expect(result.a.id).toBe(result.b.id)
  await page.goto('/pedido/pending-test')
  await page.reload()
  await expect(page.getByText('Pedido confirmado!')).toBeVisible({timeout:10000})
  const count=await page.evaluate(async()=> (await (await fetch('/api/orders')).json()).length)
  expect(count).toBe(1)
})
