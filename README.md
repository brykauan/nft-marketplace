# Kurio — Marketplace de NFTs (Frontend Challenge)

Marketplace demonstrativo de colecionáveis digitais, desenvolvido em **React 19 + TypeScript**. A experiência inclui catálogo, busca e filtros persistidos na URL, detalhes de NFT, favoritos, autenticação de demonstração, carteiras fictícias, carrinho, checkout simulado e acompanhamento de pedidos.

> **Projeto demonstrativo:** os NFTs, saldos, carteiras, pagamentos e eventos são simulados. **Não há transferência de criptoativos nem integração com blockchain, gateway ou servidor de autenticação real.** Não utilize informações pessoais ou senhas reais.

## Links

- **Demonstração:** https://nfc-marketplace-bryankauan.netlify.app/
- **Repositório:** https://github.com/brykauan/nft-marketplace
- **Decisões técnicas:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Resumo da entrega:** [ENTREGA.md](./ENTREGA.md)

Os links públicos são os endereços informados durante o desenvolvimento; a publicação atual deve ser conferida pelo responsável antes da submissão.

## Tecnologias

React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, componentes **shadcn/ui** (Button, Input, Dialog, Skeleton e Badge), TanStack Router, TanStack Query, Axios, Mock Service Worker (MSW 2), Socket.IO Client + `@mswjs/socket.io-binding`, Playwright e Lighthouse.

## Requisitos

- Node.js 22.12+ (ou outra versão suportada pelo Vite 7) e npm.
- Navegador Chromium para os testes Playwright.
- Nenhum backend externo ou chave de API é necessário.

## Executar localmente

```bash
npm ci
npm run dev
```

O Vite indica o endereço de desenvolvimento no terminal (normalmente `http://localhost:5173`). Em instalações novas, o arquivo `public/mockServiceWorker.js` já está incluído; **não é necessário inicializá-lo novamente**.

No Windows, se o PowerShell bloquear o atalho de scripts do npm, use `npm.cmd` e `npx.cmd` em vez de `npm` e `npx`.

### Build de produção e preview

```bash
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
```

O build gera `dist/`. A prévia de produção é servida normalmente em `http://127.0.0.1:4173`.

> Este repositório **não promete lint ESLint configurado**: o ZIP original incluía um script/configuração de ESLint sem as dependências correspondentes. O comando quebrado foi retirado. O projeto oferece verificação estática de TypeScript via `npm run typecheck`.

## Contas de demonstração

| E-mail | Senha fictícia | Observação |
|---|---|---|
| `demo@kurio.com` | `Demo1234!` | Conta com carteira pré-cadastrada |
| `teste@kurio.com` | `Teste1234!` | Conta alternativa |

Cupom de demonstração: `KURIO10`.

As credenciais acima são **públicas e fictícias**. A API simulada usa hash PBKDF2 com sal para as senhas persistidas no navegador, com sessão de 30 minutos. Isso **não substitui segurança de backend**.

## Funcionalidades implementadas

- Catálogo responsivo com pesquisa, coleção, ordenação, faixa de preço e paginação sincronizadas à URL.
- Página de NFT com carregamento reservado por *skeleton*, estoque, seleção de quantidade e NFTs relacionados.
- Cadastro/login fictícios, favoritos, perfil, troca de senha e gerenciamento de carteiras de teste.
- Carrinho persistido por usuário/convidado e cotação calculada em microETH (`BigInt`) no mock.
- Checkout com revalidação de valores, confirmação explícita, cupom e cenários **confirmado**, **pendente** e **recusado**.
- Idempotência para evitar pedidos duplicados em novas tentativas com a mesma chave, inclusive no fluxo de recuperação de sessão.
- API REST local interceptada pelo MSW e eventos simulados `nft.updated` / `order.updated` com versões e reconciliação das consultas.
- Cenários determinísticos de erros HTTP, indisponibilidade, atraso, timeout e respostas fora de ordem para testes.

## Testes

```bash
npx playwright install chromium
npm run test:e2e
```

Para executar separadamente no Windows:

```powershell
npx.cmd playwright test --project=desktop-chromium
npx.cmd playwright test --project=mobile-chromium
npx.cmd playwright show-report
```

A suíte inclui **38 cenários** (19 por projeto desktop/mobile), abrangendo catálogo, login, segurança de sessão, recuperação durante checkout, erros de rede, pedidos, eventos em tempo real e regressão visual. A execução original no computador de desenvolvimento terminou com **38 testes aprovados** antes desta revisão. Depois de alterações, execute-a novamente.

Os snapshots visuais existentes possuem sufixo `-win32`, pois foram capturados no Windows. Em outro sistema operacional ou após uma mudança visual legítima, novos baselines podem ser necessários; **inspecione os diffs antes de atualizar**.

## Lighthouse

Para auditar o build de produção, inicie o preview em um terminal e execute em outro, no **Windows PowerShell**:

```powershell
powershell -ExecutionPolicy Bypass -File .\auditar-lighthouse.ps1
```

São **3 execuções** por combinação: início/detalhe × mobile/desktop. Os arquivos HTML, JSON, `medicoes.csv` e `medianas.csv` ficam em [`reports/lighthouse/`](./reports/lighthouse/).

**Últimas medianas fornecidas, antes das correções finais deste pacote:**

| Página / dispositivo | Performance | Acessibilidade | Boas práticas | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Início / mobile | 92 | 100 | 88 | 92 | 2708 | 0,0097 | 230 |
| Início / desktop | 99 | 100 | 88 | 92 | 971 | 0,0059 | 0 |
| Detalhe / mobile | 90 | 94 | 88 | 92 | 3348 | 0,0445 | 167 |
| Detalhe / desktop | 99 | 94 | 88 | 92 | 877 | 0,0262 | 0 |

**Atenção:** esses números são históricos, não uma auditoria nova da versão corrigida. O HTML da versão anterior continha acidentalmente cercas Markdown (` ```html `), confundindo a identificação de `doctype`, `charset`, descrição e favicon. Esse erro foi corrigido neste pacote; a pontuação deve ser novamente medida antes de ser apresentada como definitiva. A máquina de origem também apresentou avisos de CPU mais lenta que o esperado em algumas execuções.

## Publicação Netlify

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Redirect para SPA:** o arquivo [`public/_redirects`](./public/_redirects) inclui `/* /index.html 200` para rotas profundas.
- **Service Worker MSW:** `public/mockServiceWorker.js` deve ser publicado junto com os arquivos estáticos.
- **Limpeza de dados:** os dados da demonstração ficam no `localStorage` do navegador. A rota simulada `POST /api/reset` redefine o estado; não é uma API pública real.

**Nota de escopo:** a API simulada e a autenticação do protótipo estão no cliente. A implantação é uma **demonstração de frontend**, não um marketplace seguro para produção.

## Licença e material visual

Projeto realizado para fins de avaliação técnica. As imagens de NFTs correspondem a recursos do desafio/protótipo e não são concedidas aqui para redistribuição comercial.
