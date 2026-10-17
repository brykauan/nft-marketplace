import {test,expect} from '@playwright/test'

test.beforeEach(async({page})=>{
 await page.goto('/')
 await page.evaluate(()=>fetch('/api/reset',{method:'POST'}))
 await page.reload()
})

test('nft.updated atualiza catálogo sem recarregar a página',async({page})=>{
 await expect(page.getByText('Emerald Ape').first()).toBeVisible()
 const result=await page.evaluate(async()=>{
  const response=await fetch('/api/scenarios/nft-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,price:'1.49',stock:2})})
  return {status:response.status,body:await response.json()}
 })
 expect(result.status).toBe(200)
 await expect(page.locator('.nft-card').filter({hasText:'Emerald Ape'})).toContainText('1.49 ETH',{timeout:10000})
})

test('preço atualizado entra na cotação da API',async({page})=>{
 await page.evaluate(async()=>{
  await fetch('/api/cart',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,qty:1})})
  await fetch('/api/scenarios/nft-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,price:'1.49',stock:1})})
 })
 const quote=await page.evaluate(async()=>await (await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json())
 expect(quote.subtotal).toBe('1.490000')
})
