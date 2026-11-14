# Descubra Yooga

> Onde comer e beber perto de você

![Descubra Yooga](public/descubra-yooga.png)

Busca de estabelecimentos clientes da Yooga no Espírito Santo. O usuário informa a localização (GPS, endereço ou CEP) e o app lista as lojas próximas ordenadas por distância, com filtros de cidade, segmento, tipo de atendimento, raio e "abertas agora".

Produção: https://descubra-yooga.vercel.app

## Funcionalidades

- Localização por GPS, endereço ou CEP
- Lista de lojas ordenada por distância, com raio configurável
- Filtros de cidade, segmento, tipo de atendimento e "abertas agora"
- Status de funcionamento em tempo real (aberto / fechado / horário não informado)
- Botão de cardápio para lojas que vendem pelo delivery Yooga (lojas "Somente Presencial" não exibem)
- Favoritos salvos no navegador (`localStorage`)

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 (SWC) |
| Estilo | Tailwind CSS + shadcn/ui (Radix) |
| Roteamento | React Router DOM |
| Geocodificação | Mapbox Geocoding API, Nominatim (OpenStreetMap) e ViaCEP |
| Notificações | Sonner |
| Testes | Vitest + Testing Library |

O app é estático: os dados vêm de `public/lojas.json`.

## Rodando localmente

Pré-requisito: Node.js 18+. O projeto usa **npm** (`package-lock.json`).

```bash
git clone https://github.com/brunopeeeh/yoogalize.git
cd yoogalize
npm install
cp .env.example .env   # preencha VITE_MAPBOX_ACCESS_TOKEN
npm run dev
```

O app sobe em `http://localhost:8080`.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 8080) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | ESLint |
| `npm test` | Vitest em modo watch |
| `npx vitest run` | Vitest uma vez (CI) |

## Dados das lojas

`public/lojas.json` é gerado a partir do Databricks da Yooga (clientes ativos do ES):

```bash
databricks auth login --profile yooga   # uma vez
python atualizar_lojas.py
```

O script busca clientes, endereço, link do delivery e horários, escolhe a melhor coordenada de cada loja (com geocode pelo Nominatim quando as fontes divergem) e mantém um cache em `geocode_cache.json` (fora do git). Requer Python 3 com `requests`.

Ferramentas de auditoria em `tools/`:

| Arquivo | Para quê |
|---|---|
| `tools/audit-stores.mjs` | Compara o `lojas.json` com a API pública de delivery da Yooga |
| `tools/validar-coordenadas.mjs` | Decide qual coordenada é a correta quando JSON e API divergem; grava `reports/patch-coordenadas.json`. Com `--defaults`, corrige lojas amontoadas em pontos default do sistema Yooga |
| `tools/data-quality.mjs` | Indicadores de qualidade do `lojas.json` |
| `tools/load-lojas.py` | Carrega o `lojas.json` no PostgreSQL |

## Banco de dados (Raspberry Pi)

Há uma cópia do catálogo em PostgreSQL 17 no Raspberry Pi (`bruno_db`), com distância, "abertas agora" e filtros resolvidos em SQL. O front ainda não consome esse banco. Schema, funções e instruções de carga estão em [`sql/README.md`](sql/README.md).

## Estrutura

```
.
├── public/              # Estáticos (lojas.json, imagens, manifest)
├── src/
│   ├── components/      # Componentes da aplicação e ui/ (shadcn)
│   ├── hooks/           # Hooks (useEstablishments etc.)
│   ├── lib/             # Distância, normalização, horários, favoritos
│   └── pages/           # Welcome, Search, Favorites, NotFound
├── sql/                 # Schema e patches do Postgres
├── tools/               # Auditoria e carga de dados
├── reports/             # Saídas das auditorias
└── atualizar_lojas.py   # Gera public/lojas.json a partir do Databricks
```
