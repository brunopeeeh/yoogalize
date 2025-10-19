# Contexto do Projeto: Yoggalize Painel

## Visão Geral
Este projeto é uma aplicação web front-end construída para ser um painel ou buscador de lojas/estabelecimentos da marca "Yoogalize". A aplicação permite aos usuários encontrar, filtrar e visualizar informações sobre as lojas.

## Estrutura do Projeto e Tecnologias
- **Framework Principal**: React com Vite.
- **Linguagem**: TypeScript (`.ts` e `.tsx`).
- **Estilização**: Tailwind CSS, com uma biblioteca de componentes baseada em `shadcn/ui` (indicado pela estrutura em `src/components/ui` e o arquivo `components.json`).
- **Gerenciamento de Pacotes**: O projeto utiliza `package.json`, indicando o uso de `npm`, `yarn`, `pnpm` ou `bun`. A presença de `bun.lockb` sugere que `bun` é o gerenciador preferencial.
- **Testes**: Existem arquivos de teste (`.test.ts`, `.test.tsx`), provavelmente utilizando Vitest, que é comum em projetos Vite.
- **Dados**: As informações das lojas são primariamente carregadas a partir de um arquivo JSON estático (`public/lojas.json`).
- **Scripts Auxiliares**: O projeto contém scripts Python (`.py`) que parecem ser usados para processamento, conversão e validação dos dados das lojas.

## Arquivos e Diretórios Chave
- `src/`: Contém todo o código-fonte da aplicação React.
- `src/pages/`: Componentes que representam as páginas principais da aplicação (ex: `Index.tsx`, `Results.tsx`, `Search.tsx`).
- `src/components/`: Componentes reutilizáveis da interface do usuário.
  - `src/components/ui/`: Componentes de UI base (botões, cards, etc.), padrão `shadcn/ui`.
  - `filter-sidebar.tsx`: Um componente crucial para a funcionalidade de filtro.
- `src/lib/`: Funções utilitárias, tipos (`types.ts`), e lógica de negócio (ex: `distance.ts` para cálculo de distância).
- `src/hooks/`: Hooks customizados do React para encapsular lógicas reutilizáveis (ex: `useEstablishments.ts`).
- `public/lojas.json`: Arquivo JSON que serve como a principal fonte de dados para os estabelecimentos.
- `*.py`: Scripts para manipulação de dados, provavelmente executados offline para preparar o `lojas.json`.

## Funcionalidades Principais
- Busca de estabelecimentos por geolocalização ou endereço.
- Filtragem de resultados com base em critérios diversos.
- Visualização dos detalhes de cada loja.
- Sistema de favoritos (`src/lib/favorites.ts` e `src/pages/Favorites.tsx`).
- Status de funcionamento (aberto/fechado) em tempo real (`opening-hours-status.tsx`).

## Como Contribuir
- Manter a consistência com o estilo de código e arquitetura existentes.
- Utilizar TypeScript e seguir as convenções do projeto.
- Ao adicionar ou modificar a lógica de negócio, verificar se os testes correspondentes precisam ser atualizados ou criados.
- Componentes de UI devem ser reutilizáveis e seguir o padrão dos componentes em `src/components/ui`.
