# Tempo real: Socket.IO + MSW

O `socket.io-client` abre uma conexão WebSocket no caminho `/socket.io/`. O MSW intercepta a conexão com `ws.link` e `@mswjs/socket.io-binding`. Isso permite desenvolver e demonstrar os eventos sem um backend externo.

## Eventos

- `nft.updated`: `{ id, version, nft }`. Invalida catálogo, detalhe, carrinho e cotação, permitindo sincronizar pelo REST.
- `order.updated`: `{ id, version, userId, status, order }`. A UI descarta eventos antigos ou repetidos e não aplica eventos de outro usuário.
- Ao conectar ou reconectar, todas as queries relevantes são invalidadas e sincronizadas pela API.

## Demonstrar mudança de preço

Abra a Home e execute no console do navegador:

```js
fetch('/api/scenarios/nft-update', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({id: 1, price: '1.49', stock: 2})
}).then(r => r.json()).then(console.log)
```

Verifique se o card Emerald Ape mudou sem refresh. O mesmo valor deve aparecer nas cotações subsequentes. Use `npx.cmd playwright test tests/realtime.spec.ts` para testar no Windows.

## Pedidos

Pedidos emitirão `order.updated` na criação e ao concluir a simulação pendente. Para acionar manualmente a transição de um pedido pendente autenticado, POST `/api/scenarios/settle-order` com `{ "id": "ID", "status": "confirmed" }` ou `"refused"`. O pedido deve estar pendente e pertencer à sessão atual.

## Limites do ambiente de demonstração

O MSW guarda conexões e mudanças em memória no contexto da página. Não é um backend compartilhado entre navegadores nem implementa todos os recursos do protocolo Socket.IO. O cenário pendente ainda permite conciliação via polling REST, como fallback. É necessário validar os eventos no navegador depois de instalar dependências no Windows.
