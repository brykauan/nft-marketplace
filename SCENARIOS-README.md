# Cenários de pagamento simulados

Checkout contém seletor para pagamento confirmado, pendente (finaliza após 2 segundos via consulta REST), e recusado. Pedido recusado mantém o carrinho. Pedido pendente permanece em localStorage no MSW e é reconciliado por polling após refresh. A chave de idempotência impede duplicações quando reutilizada com o mesmo conteúdo. Execute `npm run build` e `npx playwright test`.

## Limitações
Ainda **não** há transporte real de eventos Socket.IO no código desta versão. A atualização de pedido pendente utiliza **polling REST**, não cumpre os requisitos Socket.IO de `order.updated` nem `nft.updated`. Testes adicionais de falha, reconexão, acessibilidade e regressão visual permanecem pendentes. Credenciais fictícias em armazenamento local não são seguras para produção.
