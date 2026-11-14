# Contexto do Projeto: Descubra Yooga

## Visão Geral

Aplicação web front-end para buscar estabelecimentos parceiros da Yooga no
Espírito Santo ("Descubra Yooga" — Onde comer e beber perto de você). O usuário
informa a localização (GPS, endereço ou CEP) e o app lista as lojas próximas,
ordenadas por distância, com filtros de cidade, segmento, tipo de atendimento,
raio e "abertas agora".

Produção: https://descubra-yooga.vercel.app

## Stack

- **Framework**: React 18 + TypeScript, build com Vite 5 (SWC)
- **Estilo**: Tailwind CSS + componentes shadcn/ui (`src/components/ui`)
- **Roteamento**: React Router DOM (`/`, `/busca`, `/favoritos`)
- **Notificações**: Sonner
- **Testes**: Vitest + Testing Library (`npx vitest run`)
- **Geocodificação**: Mapbox Geocoding API e ViaCEP (tela inicial), Nominatim (busca)

## Dados

- `public/lojas.json` é a fonte única do front: catálogo gerado a partir do
  Databricks da Yooga por `atualizar_lojas.py` (requer `databricks auth login
  --profile yooga`).
- Os IDs das lojas (`slug-nome-lat-lon`) são a chave dos favoritos no
  `localStorage` — mudar nome ou coordenada de uma loja muda o ID.
- `sql/` contém o schema do PostgreSQL no Raspberry Pi (carga via
  `tools/load-lojas.py`); o front ainda não consome esse banco.

## Estrutura

- `src/pages/`: `Welcome.tsx` (localização), `Search.tsx` (busca/filtros),
  `Favorites.tsx`, `NotFound.tsx`
- `src/components/`: componentes da aplicação; `src/components/ui/` contém
  apenas os componentes shadcn realmente usados
- `src/lib/`: `distance.ts` (Haversine), `utils.ts` (status de horário),
  `normalizers.ts` (normalização + detecção de link de delivery corrompido),
  `address.ts` (formatação de endereço do Nominatim), `favorites.ts`
- `src/hooks/useEstablishments.ts`: carrega e normaliza `lojas.json`
- `tools/`: auditorias e carga (`audit-stores.mjs`, `validar-coordenadas.mjs`,
  `data-quality.mjs`, `load-lojas.py`)
- `reports/`: saídas das auditorias e patches de coordenadas
- `ANALISE.md`: análise técnica completa do projeto (apêndices A–E)
