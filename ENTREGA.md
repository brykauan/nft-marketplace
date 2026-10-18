# Entrega — Kurio (Frontend Challenge)

Este documento acompanha o pacote final do projeto demonstrativo. Consulte também [README.md](./README.md) e [ARCHITECTURE.md](./ARCHITECTURE.md).

## O que está disponível

- Aplicação React + TypeScript com catálogo, filtros, detalhe, favoritos, carrinho, perfil, carteiras e checkout de demonstração.
- REST mockado com MSW, eventos simulados via Socket.IO e cenários controláveis de erro e atraso.
- Playwright com cenários funcionais e snapshots desktop/mobile (Windows).
- Relatórios Lighthouse anteriores à última revisão preservados em `reports/lighthouse/`.
- Configuração para deploy estático no Netlify (`public/_redirects`).

## Verificação final pelo responsável

Execute no Windows, após extrair os arquivos:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright test --workers=1
```

Em outro terminal, inicie o preview:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

E execute a auditoria, se houver tempo:

```powershell
powershell -ExecutionPolicy Bypass -File .\auditar-lighthouse.ps1
```

Verifique também o site publicado, especialmente uma rota acessada diretamente (`/nft/1`), o login e o pedido simulado. Não envie `node_modules`, `.git`, `dist`, sessões ou arquivos `.env` junto com uma submissão distribuível.

## Histórico de qualidade (pré-revisão)

| Cenário | Performance | Acessibilidade | Boas práticas | SEO |
|---|---:|---:|---:|---:|
| Início / mobile | 92 | 100 | 88 | 92 |
| Início / desktop | 99 | 100 | 88 | 92 |
| Detalhes / mobile | 90 | 94 | 88 | 92 |
| Detalhes / desktop | 99 | 94 | 88 | 92 |

O responsável havia confirmado **38/38 testes Playwright aprovados** antes dos ajustes desta entrega. Nesta revisão, a checagem de tipos também passou. **Não atribua novas notas Lighthouse ou novos resultados Playwright sem reexecutar as ferramentas.**

## Alterações realizadas na revisão do ZIP

- Remoção de delimitadores Markdown adicionados indevidamente ao `index.html`, restaurando seu HTML real.
- Correções pontuais da hierarquia de títulos na página de detalhes e sublinhado dos links de navegação, em resposta aos achados de acessibilidade.
- Correção de `-UseBasicParsing` no PowerShell para evitar confirmação interativa ao verificar o preview.
- Remoção de comando/configuração de ESLint que não possuíam dependências no projeto e inclusão de `npm run typecheck`.
- Limpeza de arquivos padrão do Vite sem uso e atualização completa da documentação.

## Atenção

O Kurio é uma **demonstração frontend**: não há movimentação de valores reais nem autenticação segura de produção. Os mocks guardam dados apenas no navegador. As capturas visuais podem exigir revalidação após pequenas alterações de HTML/CSS, mesmo quando funcionalmente corretas.
