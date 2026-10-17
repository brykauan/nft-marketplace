# Kurio — Frontend Challenge

Projeto demonstrativo baseado na imagem composta do Figma enviada com o desafio. As imagens de NFTs foram recortadas dessa imagem original.

## Executar

```bash
npm install
npx msw init public --save
npm run dev
```

No PowerShell onde `npm` não funciona, execute primeiro `$env:Path = "C:\Program Files\nodejs;$env:Path"` e utilize `npm.cmd` e `npx.cmd`.

## Contas fictícias

- `demo@kurio.com` / `Demo1234!`
- `teste@kurio.com` / `Teste1234!`
- Cupom: `KURIO10`.

## Funcionalidades desta versão

React + TypeScript, Vite, Tailwind 4, TanStack Router, TanStack Query, Axios, REST API simulada com MSW, catálogo com URL/filtros/busca/ordenação/paginação, detalhe, favoritos, carrinho persistido, cadastro/login, perfil, carteiras, checkout e recibo. Dados armazenados localmente para a simulação. `POST /api/reset` restaura o cenário.

## Pendências para cumprimento integral do desafio

**Esta versão não satisfaz todos os requisitos eliminatórios do desafio**: faltam componente shadcn/ui, Socket.IO funcional conectado aos mocks (eventos nft.updated / order.updated e reconciliação), modelagem realista de falhas/pendências/idempotência, Playwright e regressão visual, auditorias Lighthouse, acessibilidade aprofundada e documentação `ARCHITECTURE.md`. Os mocks também precisam endurecer a política de senha e de sessão; nunca use os dados e credenciais fictícias em produção.

A UI é uma aproximação visual do Figma, pois o ZIP original continha uma imagem composta e ícones, e não os componentes/fonte/arquivos de imagem isolados.

## Revisão adicional (17/10/2026)
- Cálculos de cotação em microETH com BigInt (sem arredondamento binário).
- Tentativas de pagamento com chave de idempotência e conteúdo diferente retornam 409.
- Cotação revalidada antes de enviar o pedido e confirmação desmarcada quando os valores mudam.
- Testes iniciais Playwright em `tests/`. Instale com `npm install -D @playwright/test` e `npx playwright install chromium`; execute `npx playwright test`.
- Execute `npm run build` antes do deploy.

### Pendências críticas da avaliação
A implementação ainda NÃO atende integralmente ao desafio: falta servidor Socket.IO simulado integrado ao MSW, eventos reais `nft.updated` e `order.updated`, estados pendente/recusado, fluxos de recuperação robustos, shadcn/ui efetivo, cobertura E2E completa e medições Lighthouse. As senhas da demonstração continuam persistidas em texto claro e precisam ser corrigidas antes da entrega. A versão atual é uma base funcional, não uma submissão final validada.
