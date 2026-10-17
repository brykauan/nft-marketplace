# Socket.IO simulado com MSW

Instale dependências com `npm.cmd install` e rode `npm.cmd run dev`.

O cliente `socket.io-client` usa transporte `websocket` e se conecta ao caminho `/socket.io` no próprio origin. A interceptação de WebSocket é feita por MSW usando `@mswjs/socket.io-binding`. Nenhum backend real é necessário.

**Como testar o evento `nft.updated`:** abra o marketplace e, no console do navegador, execute:

```js
fetch('/api/scenarios/nft-update', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,price:'1.39',stock:2})}).then(r=>r.json()).then(console.log)
```

O handler altera o catálogo da API simulada e emite `nft.updated` por Socket.IO. A UI invalida a listagem, detalhes, carrinho e cotação; o checkout deve revalidar os valores.

**`order.updated`:** é emitido quando `/api/orders` confirma um pedido. A UI aceita apenas atualizações da sessão autenticada e rejeita versões antigas ou duplicadas. Após reconexão, o cliente revalida dados ativos via REST.

**Limitações atuais:** a implementação não simula ainda pedidos `pending`/`refused` nem o atraso/reconexão desses pedidos; o binding do MSW não é um servidor Socket.IO com paridade integral. Eventos mockados podem não atravessar abas, pois o banco e os sockets ficam no contexto local. O Socket.IO precisa de testes reais no navegador antes da entrega.
