# Arquitetura — Kurio

## Visão geral

O Kurio é uma **SPA React/TypeScript** hospedável como arquivos estáticos. O Vite gera o bundle; o TanStack Router organiza rotas e parâmetros de URL; o TanStack Query gerencia consultas, cache e invalidação; o Axios transporta requisições à API `/api`; o **MSW** intercepta as requisições e mantém o estado de demonstração no navegador. Não existe backend remoto de produção neste repositório.

```text
Navegador
  ├── React + Tailwind + componentes shadcn/ui
  ├── TanStack Router (URL, rotas, navegação)
  ├── TanStack Query (queries, cache, invalidação)
  ├── Axios ────────────────┐
  ├── Socket.IO Client ──┐  │
  └── MSW Service Worker │  │
         ├── Mock REST <─┼──┘
         ├── Mock WebSocket / socket.io-binding
         └── Estado em memória + localStorage
```

## Organização do código

| Local | Responsabilidade |
|---|---|
| `src/main.tsx` | Inicializa MSW antes do React; configura o QueryClient |
| `src/ui.tsx` | Rotas, interface e fluxos de conta, catálogo, carrinho e compra |
| `src/mocks.ts` | Endpoints HTTP simulados, cenários de rede, sessões, pedidos e eventos |
| `src/live.tsx` | Cliente Socket.IO, controle de versões e reconciliação de consultas |
| `src/data.ts` | Tipos e catálogo de NFTs de demonstração |
| `src/components/ui/` | Componentes de interface baseados em shadcn/ui |
| `src/style.css`, `src/index.css` | Estilos da interface, responsividade e Tailwind |
| `tests/` | Testes E2E, falhas simuladas, sessões, realtime e screenshots Playwright |
| `public/` | Imagens, ícones, `robots.txt`, worker do MSW e redirect da SPA |
| `reports/lighthouse/` | Auditorias anteriores (HTML, JSON e CSV) |

## Navegação e dados

O catálogo consulta `/api/nfts` com pesquisa, coleção, ordenação, preço máximo e página. As opções ficam na URL, mantendo navegação/reload reproduzíveis. O detalhe de NFT consulta `/api/nfts/:id`. A busca pode simular atrasos e respostas fora de ordem; o TanStack Query faz distinção por chave de consulta.

O QueryClient usa `staleTime` de 15 segundos e uma tentativa de retry por padrão. As operações de carrinho e autenticação invalidam ou limpam consultas relacionadas. O layout de carregamento da página de detalhes reserva espaço para reduzir deslocamentos visuais (CLS).

## Autenticação e isolamento de dados

A autenticação é **apenas uma simulação local**. O estado do usuário é persistido sob `kurio-demo-db-v4` em `localStorage` e gerenciado pelos handlers MSW.

- Novas senhas e contas de demonstração usam PBKDF2/SHA-256 com sal aleatório por senha e 120.000 iterações antes da persistência.
- A sessão expira após 30 minutos e endpoints privados respondem com 401 quando expirada.
- O Axios dispara o tratamento central de sessão expirada; a aplicação solicita novo login e limpa consultas privadas apropriadas.
- O checkout guarda o rascunho de recuperação em `sessionStorage` e exige nova validação/confirmação.
- Pedidos e carteiras são filtrados pelo usuário associado à sessão ativa; os cenários de isolamento são cobertos por testes.

**Limitação de segurança essencial:** como toda a implementação roda no cliente, um usuário pode inspecionar ou manipular dados simulados. Hash local e verificações de interface não substituem servidor, banco seguro, cookies HttpOnly ou autorização real.

## Carrinho, valores e checkout

O carrinho é persistido no mock e pode ser utilizado como convidado. A cotação é calculada no handler `/api/quote` utilizando inteiros **microETH** e `BigInt`, evitando erro de ponto flutuante na operação financeira simulada. O checkout confirma e revalida os valores antes da criação do pedido.

`POST /api/orders` exige sessão, carteira fictícia válida e chave de idempotência. Uma segunda tentativa com **a mesma chave e mesmo conteúdo** reutiliza o pedido; uma chave reutilizada com conteúdo diferente retorna **409**. Os pedidos registram um snapshot dos itens e preços. Estados de demonstração: `pending`, `confirmed` e `refused`. A confirmação desconta os itens; a recusa preserva o carrinho.

O fluxo inclui recuperação de tentativa ambígua/timeout e evita criar outro pedido inadvertidamente. Não existe cobrança financeira real.

## Eventos e reconciliação

O `src/mocks.ts` usa `ws.link` do MSW e `@mswjs/socket.io-binding` para simular um endpoint Socket.IO acessível pela origem local. O cliente de `src/live.tsx`:

- Reconecta com atraso progressivo;
- Consome `nft.updated` e `order.updated`;
- Usa números de versão para evitar reaplicação de eventos antigos/duplicados;
- Ignora eventos privados de pedidos de outro usuário;
- Invalida as consultas correspondentes para obter o estado canônico via REST.

Os testes reproduzem atualização de NFT/preço e estados do pedido. **Não é um servidor Socket.IO de produção.**

## Cenários de rede e testabilidade

Os endpoints `/api/scenarios/network`, `/api/scenarios/nft-update`, `/api/scenarios/settle-order` e `/api/reset` permitem controlar falhas e resetar fixtures. Exemplos: HTTP 5xx, rede indisponível, atraso, timeout e respostas fora de ordem.

O Playwright configura projetos desktop Chromium e mobile Chromium, 1 worker, traces em falhas, relatório HTML e capturas visuais por plataforma. A suíte final executada na máquina original possuía **38 testes aprovados**; alterações feitas nesta revisão ainda exigem nova execução naquele ambiente para revalidar os baselines.

## Build, distribuição e performance

O `vite.config.ts` separa bibliotecas TanStack, React e ícones em chunks de dependências, reduzindo o custo/caching de carregamento em certas medições. **Separar chunks, isoladamente, não garante TBT menor**, pois os módulos continuam exigindo processamento. O HTML carrega `hero.webp` com preload; a página de detalhes destaca a imagem principal e utiliza skeleton para reduzir CLS. A aplicação não utiliza SSR ou prerenderização.

O `index.html` recebido no ZIP tinha cercas de código Markdown literais. Isso colocou o documento em interpretação incorreta pelo navegador e influenciou auditorias de doctype, charset, favicon e SEO. As cercas foram removidas neste pacote. A auditoria deve ser repetida depois do build.

## Limitações e decisões de escopo

1. **Mock no navegador, não backend:** sem persistência compartilhada entre dispositivos ou proteção real de dados.
2. **Pagamentos/carteiras/NFTs fictícios:** sem contratos, wallet provider, assinaturas ou ativos reais.
3. **Benchmark de laboratório:** as notas Lighthouse refletem o computador e configurações específicos; os relatórios incluídos são anteriores à correção do HTML.
4. **Snapshots visuais Windows:** em outro SO, verifique visualmente as diferenças e só então atualize baselines.
5. **ESLint indisponível no ZIP original:** foram removidos o comando e a configuração incompletos; existe `npm run typecheck` com TypeScript estrito como validação estática.
6. **Sem testes novos inventados:** os 38 testes reportados foram executados pelo responsável no Windows antes da revisão; o novo ZIP deve passar pelo mesmo comando novamente.

A separação entre front-end, API simulada, eventos e testes facilita migrar futuramente para um backend real sem confundir o protótipo com uma aplicação financeira de produção.
