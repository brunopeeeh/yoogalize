# Análise Técnica — Yoogalize

> **Data da análise:** 13/11/2026
> **Último commit:** `ca99516` — 19/10/2025 (~13 meses sem atividade)
> **Branch:** `main` (única)
> **Deploy ativo:** https://yoogalize.vercel.app (estado `READY`)

---

## Sumário

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Estado atual (build / test / lint / deploy)](#2-estado-atual)
3. [🔴 Crítico — credenciais expostas no git](#3--crítico--credenciais-expostas-no-git)
4. [Bugs funcionais](#4-bugs-funcionais)
5. [Código morto](#5-código-morto)
6. [Pipeline de dados (Python)](#6-pipeline-de-dados-python)
7. [Qualidade dos dados](#7-qualidade-dos-dados)
8. [Payload e dependências](#8-payload-e-dependências)
9. [Infraestrutura e configuração](#9-infraestrutura-e-configuração)
10. [Documentação desatualizada](#10-documentação-desatualizada)
11. [Plano de revivification](#11-plano-de-revivification)

**Apêndices:**
- [A — Comandos de verificação](#apêndice-a--resumo-dos-comandos-de-verificação)
- [B — Métricas do repositório](#apêndice-b--métricas-do-repositório)
- [C — Atualização 13/11/2026: API da Yooga e pipeline de dados](#apêndice-c--atualização-de-13112026-api-da-yooga-e-pipeline-de-dados) ← *contém correções à análise original*
- [D — Banco de dados no Raspberry Pi (14/11/2026)](#apêndice-d--banco-de-dados-no-raspberry-pi-14112026) ← *schema, funções e carga*

---

## 1. O que é o projeto

SPA em **React 18 + TypeScript + Vite 5**, estilizado com **Tailwind CSS** e componentes baseados em **shadcn/ui**.

Funcionalidade central: o usuário informa a localização (GPS, endereço ou CEP) e a app lista lojas/restaurantes próximos, ordenados por distância, com filtros de cidade, segmento, tipo de atendimento, raio e "abertas agora". Exibe status de funcionamento em tempo real, link de cardápio de delivery e favoritos persistidos em `localStorage`.

**Região coberta:** Grande Vitória/ES — Vitória, Vila Velha, Serra, Viana, Cariacica.

**Origem:** gerado com **Lovable.dev** (evidências: `lovable-tagger` nas devDeps, plugin `componentTagger()` no `vite.config.ts`, OG image apontando para `lovable.dev`, `package.json` com o nome default `vite_react_shadcn_ts`).

**Backend:** ❌ **nunca foi construído**. A aplicação é 100% estática — os dados vêm de um JSON de 1,7 MB commitado em `public/lojas.json`. O `GEMINI.md` e o README citam Supabase, mas não existe `src/lib/supabase.ts`, `src/integrations/` nem qualquer chamada de rede ao Supabase no código.

### Stack declarada

| Camada | Tecnologia |
|---|---|
| Framework | React 18.3 + TypeScript 5.8 |
| Build | Vite 5.4 (SWC) |
| Estilo | Tailwind CSS 3.4 + shadcn/ui (Radix) |
| Roteamento | React Router DOM 6.30 |
| Geocoding | **Mapbox Geocoding** (Welcome) + **Nominatim/OSM** (Search) + **ViaCEP** (CEP) |
| Estado remoto | TanStack Query 5.83 (configurado, **nunca usado**) |
| Toast | Sonner 1.7 (+ `use-toast` do shadcn, em paralelo) |
| Tema | next-themes 0.3 (`defaultTheme="system"`) |
| Testes | Vitest 3.2 + Testing Library |

---

## 2. Estado atual

| Item | Resultado |
|---|---|
| `npm run build` | ✅ **passa** — 1736 módulos, 12,4 s, `dist/index.js` 415 KB (131,9 KB gzip) + CSS 63 KB (11 KB gzip) |
| `npx vitest run` | ✅ **7/7 passam** — `src/lib/distance.test.ts` (2) e `src/components/opening-hours-status.test.tsx` (5) |
| `npm run lint` | ❌ **1 erro + 6 warnings** (exit code 1) |
| Deploy Vercel | ✅ `READY` — 3 deploys de produção, último `dpl_4rDWkvWoF2Q9cKGDfyoVQB5vUVMP` (19/10/2025) |
| Domínio | `yoogalize.vercel.app` (verificado) |
| Env vars | `VITE_MAPBOX_ACCESS_TOKEN` — `encrypted`, targets `development, preview, production` |
| CI/CD | ❌ nenhum workflow |
| Observabilidade | ❌ nenhum analytics, sem error boundary |

### Detalhe do lint

```
src/components/theme-provider.tsx     8:14   warning  react-refresh/only-export-components
src/components/ui/form.tsx          19:14   warning  react-refresh/only-export-components
src/components/ui/form.tsx          38:14   warning  react-refresh/only-export-components
src/components/ui/sidebar.tsx        33:14   warning  react-refresh/only-export-components
src/components/ui/sidebar.tsx       608:3    warning  react-refresh/only-export-components
src/pages/Search.tsx                190:6    warning  react-hooks/exhaustive-deps
src/pages/Welcome.tsx                92:51   error    @typescript-eslint/no-explicit-any
```

Os 5 warnings de `react-refresh` apontam para componentes shadcn que serão removidos (item 5). O único **erro** é o `any` em `Welcome.tsx:92`.

### Detalhe dos testes

Cobertura muito rasa — 2 arquivos, 7 casos, concentrados em:
- `calculateDistance` / `formatDistance` (Haversine)
- `OpeningHoursStatus` (status aberto/fechado)

**Sem cobertura:** filtros, busca por raio, favoritos, geocoding, normalização, `useEstablishments`, `Welcome`, `Search`, `Favorites`. Nenhum teste de integração.

---

## 3. 🔴 Crítico — credenciais expostas no git

### O achado

O commit **`2574ace`** ("correção horarios", 16/10/2025) adicionou `.env.example` contendo credenciais **reais**:

```ini
SUPABASE_CONN_STRING="postgresql://postgres:[SENHA_EXPURGADA]@db.veogtzzhwukysdggmqyy.supabase.co:5432/postgres"
#SUPABASE_URL="https://veogtzzhwukysdggmqyy.supabase.co"
#SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
```

- Senha do role `postgres` (superusuário) do Postgres — **URL-encoded**, o que oculta a leitura casual.
- Chave `anon` (JWT válido, `iat` = 10/10/2025, `exp` = 2036).
- **O repositório é público** (`brunopeeeh/yoogalize` → `"private": false`, `"visibility": "public"`).

Verifiquei que a string aparece **apenas** nesse commit — não há outros pontos no histórico.

### Estado atual do projeto referenciado

O projeto Supabase `veogtzzhwukysdggmqyy` **não resolve mais no DNS**:

```
OK        lvorxhmvppglnlcxnrbp.supabase.co -> 172.64.149.246
NORESOLVE zzzznotarealproject12345.supabase.co
NORESOLVE veogtzzhwukysdggmqyy.supabase.co
```

O DNS do Supabase é **por projeto** (não wildcard — um subdomínio aleatório também não resolve), e `lvorxhmvppglnlcxnrbp` resolve normalmente a partir do mesmo ambiente. Conclusão: **o projeto foi deletado** (projetos pausados continuam resolvendo).

➡️ **A credencial está inerte.** Não há risco imediato de exploração.

### Por que ainda assim precisa ser corrigido

1. **O histórico do git é público e imutável.** Qualquer pessoa pode extrair a senha em segundos.
2. **Senhas se repetem.** A senha vazada pode estar em uso em outros projetos do mesmo dono — inclusive em projetos vivos.
3. **Se a chave for reutilizada**, um projeto novo com o mesmo ref poderia receber a mesma senha.
4. **Anon key exposta** — verifiquei que as tabelas com dados do projeto conectado têm RLS ligado **e zero policies** (`pg_policies` vazio), ou seja, `anon` não lê nada. Risco baixo **desde que a senha do Postgres não vaze**.

### Mitigante verificado

O projeto `veogtzzhwukysdggmqyy` **não resolve mais no DNS**:

```
OK        lvorxhmvppglnlcxnrbp.supabase.co -> 172.64.149.246
NORESOLVE veogtzzhwukysdggmqyy.supabase.co
NORESOLVE zzzznotarealproject12345.supabase.co   (controle)
```

Como o Supabase usa DNS por projeto (não wildcard), e o controle também falha, a conclusão é: **o projeto foi deletado**. A credencial está **inerte**.

### Ainda assim, obrigatório

1. **Rotacionar a senha** — em qualquer projeto que reutilize a mesma senha ou o mesmo padrão.
2. **Limpar o histórico** — `git filter-repo` ou BFG para remover `.env.example` do histórico (ou reescrever o arquivo com placeholders e reescrever todos os commits).
3. **Corrigir o `.env.example`** para conter apenas placeholders (`SUPABASE_CONN_STRING="postgresql://postgres:SUA_SENHA@..."`).
4. **Adicionar `*.env*` ao `.gitignore`** mantendo `!.env.example`.

### Ponto importante

O Supabase conectado ao MCP (`lvorxhmvppglnlcxnrbp`) é **outro projeto** — contém `wiki_documents` (1.825 linhas), `academy_membros` (8), `academy_progresso` (7), `academy_respostas` (3), além das tabelas do simulador CS Coach (`users`, `scenarios`, `simulations`, `agent_performances`, `company_profiles`, `knowledge_articles`, `knowledge_chunks`). **Não existe nenhuma tabela de lojas** em lugar nenhum. Isso confirma que o backend do yoogalize nunca foi criado.

---

## 4. Bugs funcionais

### B1 — "Limpar Filtros" não limpa o tipo de atendimento
`src/pages/Search.tsx:254-260`
```js
const handleClearFilters = () => {
  setSelectedCategory("all");
  setSelectedCity("all");
  setRadiusKm(5);
  setOpenNow(false);        // ← selectedServiceType NÃO é resetado
  toast.info("Filtros limpos!");
};
```
**Impacto:** usuário que selecionou "Somente Delivery" e clica em "Limpar Filtros" continua vendo só delivery, sem indicação visual de que o filtro segue ativo.

---

### B2 — O filtro de cidade trava a busca fora do município
`src/pages/Search.tsx:241` e `src/pages/Search.tsx:64`
```js
setSelectedCity(newCity);   // geocoding define a cidade como filtro
```
O dataset cobre 5 cidades (Vitória, Vila Velha, Serra, Viana, Cariacica). O `newCity` vem do Mapbox/ViaCEP e pode:
- ser uma cidade **fora** do dataset (ex.: Guarapari) → **zero resultados**;
- mapear a sub-região errada (ex.: morar em Vila Velha e o Mapbox devolver "Vitória") → **zero resultados**;
- retornar string com acento/case diferente (ex.: "Vitória" vs "Vitoria") → **zero resultados**, porque o match é `establishment.city === selectedCity` (igualdade estrita).

**Impacto:** o app é inútil fora da região atendida, e a saída ("Todas as cidades") fica escondida num dropdown. Como o `selectedCity` só pode ser alterado manualmente, o usuário provavelmente conclui que o app está quebrado.

---

### B3 — Editar o endereço não re-executa a busca
`src/pages/Search.tsx:192-252`

`handleUpdateAddress` chama `setEffectiveLocation(...)`, `setSelectedCity(...)`, `setEditedAddress(...)` — mas **nunca dispara `executeSearch()`**. O `useEffect` de re-busca (linha 186) depende **apenas de `[openNow]`**.

**Impacto:** o usuário clica em "Salvar" no endereço, vê o toast "Endereço atualizado!", e **a lista de resultados continua a mesma**. Parece que o app não funcionou.

---

### B4 — Fuso horário: ✅ **VERIFICADO, NÃO É BUG** (corrigido em 13/11/2026)

> **Correção:** a análise inicial acusou "fuso duplo". Ao consultar a API real da Yooga, isso se mostrou **falso**.
>
> A API devolve `schedule_json` em **UTC explícito**: `"start":"2025-02-12T17:45:13Z"`. O `processador_dados.py:47-60` converte corretamente para UTC-3 (`17:45:13Z` → `14:45:13`), e o app compara contra `getBrasiliaTimeInfo()` (`America/Sao_Paulo`). A conversão acontece **uma vez só**, na origem.
>
> A loja de referência confirma: `lojas.json` tem `14:45:13` e a API tem `2025-02-12T17:45:13Z` → `17:45 − 3h = 14:45` ✅
>
> **A lógica de horário do app está correta.** Nenhuma ação necessária. O risco real é outro: 299 lojas sem horário utilizável (seção 7).

<details>
<summary>Hipótese original (descartada)</summary>

- `processador_dados.py:47-60` — `ajustar_horario()` subtrai **3 horas** (UTC→BRT) na geração do JSON.
- `src/lib/utils.ts:13-37` — `getBrasiliaTimeInfo()` converte o "agora" para `America/Sao_Paulo`.

Se o JSON já estivesse em hora local, o app exibiria 3 horas adiantado. **Verificado na API: não é o caso.**
</details>

---

### B5 — `useEffect` com closure obsoleta
`src/pages/Search.tsx:186-190`
```js
useEffect(() => {
  if (hasSearched) { executeSearch(); }
}, [openNow]);   // ← o próprio ESLint aponta isso
```
`executeSearch` é recriado a cada render e fecha sobre `effectiveLocation`, `selectedCategory`, `selectedServiceType`, `selectedCity`, `radiusKm`, `allEstablishments`. O effect só re-executa quando `openNow` muda, usando valores possivelmente desatualizados de outros filtros.

---

### B6 — Dois sistemas de toast convivendo
`src/App.tsx:19-20`
```jsx
<Toaster />     {/* radix / shadcn use-toast */}
<Sonner />      {/* sonner */}
```
Ambos renderizados. O app usa **só o `sonner`** em toda a aplicação (`toast.success`, `toast.error`, `toast.info`). `src/hooks/use-toast.ts` e `src/components/ui/toaster.tsx` + `ui/use-toast.ts` são código morto.

**Impacto:** potencial de toast duplicado e inconsistência visual.

---

### B7 — `Results.tsx` é uma rota órfã
- Registrada em `src/App.tsx:25` → `/resultados`.
- `Results.tsx:29-31` → se não houver `location.state.establishments`, redireciona para `/`.
- **Nenhuma tela navega para `/resultados`** (verificado por grep em todos os `navigate()`).

**Impacto:** 144 linhas de código inalcançável.

---

### B8 — `Index.tsx` também é inalcançável
- Não está roteado em `App.tsx`.
- Além disso, `Index.tsx:93` navega para `"/search"`, **rota que não existe** (a rota real é `/busca`).

**Impacto:** 258 linhas de código inalcançável; se fosse roteado, quebraria.

---

### B9 — `Slider` uncontrolled dessincroniza do `sessionStorage`
`src/components/filter-sidebar.tsx:107-114`
```jsx
<Slider
  defaultValue={[radiusKm]}   // ← uncontrolled: ignora updates
  onValueChange={(value) => setRadiusKm(value[0])}
```
`defaultValue` só é lido na montagem. O `radiusKm` inicial vem de `savedState?.radiusKm` (`Search.tsx:65`), então o valor inicial bate — mas qualquer mudança externa de `radiusKm` não reflete no slider.

---

### B10 — Modo escuro quebrado em `Results.tsx`
`src/pages/Results.tsx:42`
```jsx
<header className="bg-white border-b border-border py-4 px-6 shadow-sm sticky top-0 z-10">
```
`bg-white` hardcoded, enquanto o app usa `next-themes` com `defaultTheme="system"` e `bg-background` no resto. Em dark mode o header fica branco com texto branco.

---

### B11 — `Welcome.tsx:92` — erro de lint (único erro do build de CI)
```jsx
const city = result.context?.find((c: any) => c.id.startsWith('place'))?.text || '';
```
`c` deve ser tipado. O próprio arquivo já define o tipo `MapboxFeature` (linhas 28-39) com `context.place`, que nunca é usado.

---

### B12 — `index.html` com `lang="en"`
`index.html:2` — `<html lang="en">` num app 100% em português. Afeta leitor de tela, SEO e o corretor do navegador.

---

### B13 — Porta do dev server ≠ README
`vite.config.ts:11` define `port: 8080`; o README (linha 88) diz `http://localhost:5173`.

---

### B14 — Endereços formatados de formas inconsistentes
Dois formatadores convivem:
- `Welcome.tsx:55-60` → `[road, city, state, postcode, country]`
- `Search.tsx:209` → `[road, quarter, borough, city, state, postcode, country]`

O `Search.tsx` **descarta `town`, `village`, `suburb` e `city_district`** do endereço, então em cidades menores o endereço exibido pode ficar incompleto (só `road` + `state` + `postcode`).

---

### B15 — Sem `ErrorBoundary`
Qualquer exceção em render (ex.: `location.state` malformado, `JSON.parse` corrompido) derruba a app inteira em tela branca. Relevante porque `Search.tsx:38` faz `JSON.parse(sessionStorage)` com `try/catch` — **mas** `Favorites.tsx` e `Results.tsx` acessam `location.state` sem proteção.

---

## 5. Código morto

### Arquivos

| Arquivo | Linhas | Motivo |
|---|---|---|
| `src/pages/Index.tsx` | 258 | Não roteado; navega para `/search` (rota inexistente) |
| `src/pages/Results.tsx` | 144 | Rota órfã, nada navega para lá |
| `src/components/address-autocomplete.tsx` | 88 | Só usado pelo `Index.tsx` morto |
| `src/data/establishments.ts` | 182 | Mock de São Paulo com 14 lojas fake; nunca importado |
| `src/data/lojas.ts` | 59 | Duplicata não usada de `src/lib/normalizers.ts` |
| `src/pages/useGeolocation.ts` | **0 bytes** | Arquivo vazio |
| `src/components/theme-provider.tsx` | ~40 | `App.tsx` importa `next-themes` direto |
| `src/hooks/use-toast.ts` + `ui/toaster.tsx` + `ui/use-toast.ts` | ~130 | Sistema de toast paralelo não utilizado |
| **32 componentes shadcn** | — | `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `breadcrumb`, `calendar`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `drawer`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `separator`, `sidebar`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group` |

**Total estimado: ~900 linhas mortas + 32 componentes shadcn.**

### Componentes shadcn realmente usados (16 de 48)
`badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `scroll-area`, `select`, `sheet`, `skeleton`, `slider`, `sonner`, `switch`, `toaster`, `tooltip`

---

## 6. Pipeline de dados (Python)

### Irreprodutível

Todos os scripts dependem de planilhas `.xlsx` que foram **deletadas do histórico do git**:

| Script | Input esperado | Status |
|---|---|---|
| `processador_dados.py` | `Base cliente Vila Velha.xlsx` | ❌ deletado (`bdff71f`) |
| `validacao.py` | `Base cliente Vila Velha.xlsx` | ❌ deletado |
| `conversor.py` | `Base cliente Vila Velha_com_coordenadas.xlsx` | ❌ nunca existiu no repo |
| `processador_dados_copy.py` | — | cópia descartada (7200 B vs 6997 B) |

**Os 3 scripts não rodam hoje.** O `pandas` também não tem `requirements.txt` / `pyproject.toml`.

### Deriva de schema (o problema mais estrutural)

`processador_dados.py:148` monta o CSV de saída com:
```python
colunas_tabela = ['nome_fantasia', 'categoria', 'endereco_completo', 'telefone',
                   'instagram', 'latitude', 'longitude', 'horario_funcionamento']
```

Mas o front-end consome um schema **totalmente diferente** (`src/lib/types.ts:14-30`):
```ts
nome_empresa, modelo_negocio, tipo_atendimento, logradouro, número, bairro,
cidade, estado, cep, "link delivery", "endereco completo",
horario_funcionamento, Latitude, Longitude
```

São **dois schemas incompatíveis** (nomes, casing e granularidade diferentes). O pipeline Python nunca alimentou esta front-end — provavelmente alimentava a API do Yooga, e o `lojas.json` do front foi gerado por outra via.

### Defeitos nos scripts

| # | Local | Problema |
|---|---|---|
| D1 | `processador_dados.py:47-60` | `ajustar_horario()` subtrai 3h **não-idempotente** — rodar 2× = −6h |
| D2 | `processador_dados.py:62-81` | `validar_horario_funcionamento()` **muta os dicts de entrada** (`dia_dados.update(d)` numa referência de `mapa_existentes`) |
| D3 | `validacao.py:66` | `df.iloc[:, 10]` — **índice de coluna hardcoded** para o endereço |
| D4 | `processador_dados.py:20` | User-Agent `YoogaGeocodeScript/1.5` vs `1.1` em `validacao.py:22` — política do Nominatim exige User-Agent identificável |
| D5 | `processador_dados.py:115` | `time.sleep(1.1)` só no loop geocoding; `validacao.py:81` usa `1.0` — inconsistente |
| D6 | `processador_dados.py:130` | `df.dropna(subset=["Latitude","Longitude"], inplace=True)` — descarta lojas silenciosamente |
| D7 | `conversor.py:18` | `df.fillna("").to_dict(orient="records")` — converte `NaN`/`NaT` para string vazia, mascarando dados faltantes |
| D8 | todos | Sem tratamento de erro, sem log estruturado, sem testes, sem versionamento de schema |

---

## 7. Qualidade dos dados

`public/lojas.json` — **817 lojas**, payload 1,72 MB (JSON com indentação).

### Composição

| Dimensão | Valores |
|---|---|
| **Cidades (5)** | Cariacica, Serra, Viana, Vila Velha, Vitória |
| **Segmentos (38)** | Restaurante, Açaíteria, Bar / Petiscaria, Hamburgueria, Pizzaria, Padaria, Mercado, Lanchonete, Churrasquinho, Sushi, Sorveteria, Caféteria, Material de Construção, Petshop, Tabacaria, Suplementos, Roupas e Acessórios, Informática/Acessório, … |
| **Tipo de atendimento (3)** | Presencial e Delivery, Somente Delivery, Somente Presencial |
| **Sem delivery link** | 41 lojas |
| **Sem lat/long** | 0 ✅ |
| **Nomes duplicados** | 6 grupos (IDs únicos pois o ID inclui lat/long ✅) |

### 🚩 Horários com segundos não-zero

```
Total de intervalos de horário: 4179
Valores distintos de start:       1458
Com segundos != 00:               3468  (83%)
```

Amostra do primeiro registro:
```
Domingo      14:45:13 → 22:45:59
Segunda     14:45:20 → 22:45:05
Terça       14:45:25 → 22:45:09
Quarta      14:45:34 → 22:45:16
Quinta      14:45:40 → 22:45:30
Sexta       14:45:45 → 22:45:26
Sábado      14:45:50 → 22:45:30
```

Cada dia avança ~5 s. A análise inicial interpretou isso como **dado sintético**. **Correção (13/11/2026): falso.** A API da Yooga devolve exatamente esses valores em `schedule_json`:

```json
{"day_of_week":0,"day":"Domingo","hours":[{"end":"2026-09-30T01:30:32Z","start":"2025-02-12T17:45:13Z","type":"BOTH"}]}
```

Os segundos vêm do **timestamp real de criação do horário** no sistema da Yooga (`17:45:13Z` = `14:45:13` em BRT) — cada dia tem um registro criado alguns segundos após o anterior. **É dado real**, não ruído.

O app ignora segundos (`parseTime` usa só h/m), então o efeito é nulo. **Nenhuma ação necessária.** O que realmente importa é outro: **299 das 1369 lojas (22%) não têm horário utilizável** e somem quando o filtro "Abertas Agora" está ativo — ver seção 7.

Distribuição dos horários mais frequentes: `00:00:00` (210×), `08:00:00` (118×), `18:00:00` (92×), `10:00:00` (91×) — esses 4 somam 58% e são coerentes.

### Arquivos duplicados no repo

| Arquivo | Tamanho | Status |
|---|---|---|
| `public/lojas.json` | 1,72 MB | ✅ usado |
| `public/lojas copy.json` | 1,73 MB | ❌ **lixo commitado** — quase duplicata, nunca referenciada |
| `public/lojas_.json` | 37 KB | ❌ dataset parcial (mesma estrutura `{result: [...]}`), nunca referenciado |

Os três estão versionados no git (`git ls-files` confirma).

---

## 8. Payload e dependências

### Build atual
```
dist/index.html                 1,49 kB │ gzip:   0,62 kB
dist/assets/index-*.css        63,38 kB │ gzip:  11,00 kB
dist/assets/index-*.js        415,30 kB │ gzip: 131,91 kB
```
Sem code-splitting: **um bundle único** para todas as rotas. `src/components/ui/sidebar.tsx` (21,9 KB), `chart.tsx` (10,3 KB), `sidebar-variants.ts`, `navigation-menu-variants.ts`, `badge-variants.ts` etc. são variantes customizadas que nunca são importados.

### Dependências órfãs

O `package.json` declara 50 deps de runtime, mas o app **realmente usa ~16 componentes shadcn**:

| Dependência | Usada? | Motivo |
|---|---|---|
| `recharts` (2,15) | ❌ | só em `ui/chart.tsx`, nunca importado |
| `embla-carousel-react` (8,6) | ❌ | só em `ui/carousel.tsx` |
| `vaul` (0,9) | ❌ | só em `ui/drawer.tsx` |
| `cmdk` (1,1) | ❌ | só em `ui/command.tsx` |
| `react-day-picker` (8,10) | ❌ | só em `ui/calendar.tsx` |
| `input-otp` (1,4) | ❌ | só em `ui/input-otp.tsx` |
| `@tanstack/react-query` (5,83) | ❌ | `QueryClientProvider` montado, **zero queries** — `useEstablishments` usa `useState`/`useEffect` + `fetch` |
| `@radix-ui/react-*` | 🟡 | ~30 pacotes declarados, ~12 Radix realmente usados |
| `date-fns` (3,6) | ❌ | não encontrado no código |
| `next-themes` (0,3) | ✅ | `App.tsx` |

O *tree-shaking* do Vite já remove as não-usadas do bundle (por isso 415 KB e não 800 KB), mas elas continuam no `node_modules`, no lockfile (298 KB `package-lock.json` + 197 KB `bun.lockb` convivendo) e no cache de CI.

---

## 9. Infraestrutura e configuração

| Item | Estado |
|---|---|
| `vercel.json` | ✅ rewrite SPA correto (`/(.*)` → `/index.html`) |
| `vite.config.ts` | ✅ alias `@` correto; `server.port: 8080`; `test` configurado (jsdom + setup) |
| `tailwind.config.ts` | ✅ tema com customização de marca (cor `primary`) |
| `components.json` | ✅ shadcn configurado |
| `tsconfig.*.json` | ✅ strict, paths, project references |
| `eslint.config.js` | ✅ flat config; 1 erro pendente |
| `.gitignore` | ⚠️ ignora `.env` mas **não** `*.env*` nem `lojas*.json` |
| `.env.example` | 🔴 **contém credenciais reais** |
| `index.html` | ⚠️ `lang="en"`; OG image do Lovable; sem `og:url`, sem canonical, sem manifest |
| `public/robots.txt` | ✅ presente |
| Error boundary | ❌ ausente |
| Sentry / analytics | ❌ ausentes |
| CI | ❌ ausente |
| PWA / offline | ❌ ausente |

### Cache de assets
`public/` é servido com hashing apenas para `/assets/*`. `lojas.json` (1,7 MB) **não tem hash no nome** → é servido com o cache do browser e da borda da Vercel. Se o conteúdo mudar, o cliente pode continuar vendo a versão antiga (com `Cache-Control` padrão do Vercel para arquivos estáticos).

---

## 10. Documentação desatualizada

### `README.md`
- Promete **"Mapbox GL JS"** — ❌ não existe no `package.json` nem no código (o app usa a API de *geocoding*, não o SDK de mapa).
- Promete **"Vitest"** como framework de testes — ✅ correto, mas não menciona que são só 7 casos.
- Promete **"Sonner"** ✅ — mas omite `use-toast` (shadcn) que também está no projeto.
- Promete **"gerenciador de pacotes: npm ou Bun"** — mas **não há `requirements.txt`** para os scripts Python.
- Diz **"Vitest"** e **"npm test"** — ✅ `npm test` → `vitest` (modo watch; CI precisaria de `vitest run`).
- **Porta errada**: diz `localhost:5173`, o Vite usa **8080**.
- Título "Yoogalize Painel" / repositório `yoggalize_painel` (com 2 "g") — o repositório real é `yoogalize`.
- Seção "Padrões de Código" pede `npm run format` — ❌ **o script não existe** no `package.json`.
- Seção "Licença" referencia arquivo `LICENSE` — ❌ **não existe** no repo.
- `clone` URL usa `seu-usuario/yoggalize_painel` — placeholder não substituído.

### `GEMINI.md`
- Menciona `src/hooks/useEstablishments.ts` (existe ✅) mas omite `useEstablishments` vs `data/lojas.ts` (duplicata).
- Menciona `src/lib/distance.ts` ✅.
- Menciona "Scripts Auxiliares Python para preparar o `lojas.json`" — ⚠️ **impreciso**: os scripts de fato produzem CSV para a API, e o `lojas.json` tem outro schema.
- Menciona "Mapbox" mas o `Search.tsx` usa **Nominatim** — não documentado.
- Não menciona `src/data/establishments.ts`, `src/pages/Index.tsx`, `src/pages/Results.tsx` (código morto).

---

## 11. Plano de revivification

### Fase 0 — Segurança (~1 h) 🔴 prioritário

| # | Ação |
|---|---|
| 0.1 | Confirmar que o projeto `veogtzzhwukysdggmqyy` está deletado (✅ verificado) e rotacionar a senha exposta em **qualquer** projeto que a reutilize |
| 0.2 | `git filter-repo --path .env.example --invert-paths` (ou reescrever o arquivo e reescrever todos os commits) |
| 0.3 | Reescrever `.env.example` só com placeholders |
| 0.4 | `.gitignore`: adicionar `*.env*` + `!.env.example` |
| 0.5 | `git rm --cached 'public/lojas copy.json' 'public/lojas_.json'` |

### Fase 1 — Higiene (~3 h)

| # | Ação |
|---|---|
| 1.1 | Deletar os 9 arquivos/grupos de código morto (item 4) |
| 1.2 | `npm uninstall` das 8 deps órfãs (item 7) |
| 1.3 | Remover o `QueryClientProvider` (nenhuma query) **ou** migrar `useEstablishments` para `useQuery` (recomendado, resolve cache + dedupe) |
| 1.4 | Unificar toast: remover `use-toast`/`Toaster`, manter só `sonner` |
| 1.5 | Corrigir o erro de lint (`Welcome.tsx:92`) — tipar `result.context` |
| 1.6 | `index.html`: `lang="pt-BR"`, OG image própria, `manifest` |
| 1.7 | `vite.config.ts`: alinhar porta com o README (escolher uma e documentar) |
| 1.8 | Unificar lockfile (escolher `bun.lockb` **ou** `package-lock.json`) |

### Fase 2 — Bugs (~4 h)

| # | Bug | Arquivo |
|---|---|---|
| 2.1 | B4 — fuso horário (validar no banco antes) | `utils.ts` / `processador_dados.py` |
| 2.2 | B3 — re-executar busca ao mudar endereço | `Search.tsx:235` |
| 2.3 | B2 — cidade como default, não como trava | `Search.tsx:64, 241` |
| 2.4 | B1 — `handleClearFilters` incompleto | `Search.tsx:254` |
| 2.5 | B5 — deps do `useEffect` | `Search.tsx:186` |
| 2.6 | B9 — `Slider` controlado | `filter-sidebar.tsx:108` |
| 2.7 | B10 — `bg-white` no dark mode | `Results.tsx:42` |
| 2.8 | Unificar geocoding em `src/lib/geocoding.ts` (Mapbox + fallback OSM com `User-Agent` correto) | novo |
| 2.9 | Cache do `lojas.json` (hash no nome ou `Cache-Control` no `vercel.json`) | `vercel.json` |

### Fase 3 — Dados (~1 dia)

| # | Ação |
|---|---|
| 3.1 | Definir a **fonte de verdade**: tabela `lojas` no Supabase (RLS, só `anon` leitura) |
| 3.2 | ETL Python versionado com `requirements.txt`, `schema` único e **documentado** (eliminar a deriva D1–D8) |
| 3.3 | Sanear horários: arredondar para `HH:MM`, remover segundos |
| 3.4 | Dedupe das 6 duplicatas e decidir a política para as 41 lojas sem delivery |
| 3.5 | Migrar de JSON estático para Supabase com `useQuery` (cache, invalidação,updates sem rebuild) |
| 3.6 | Testes: parametrizar com `fixture` real (subset de ~20 lojas) |

### Fase 4 — Produto (~2-3 dias)

| # | Ação |
|---|---|
| 4.1 | **Mapa** — a lacuna mais visível: o token Mapbox já está pago e configurado, mas não há mapa. `mapbox-gl` + markers + círculo de raio |
| 4.2 | **Detail page** por estabelecimento — reanimar a rota `/resultados` como `/loja/:id` |
| 4.3 | **Busca por nome/texto** — hoje só filtra por segmento/cidade/tipo |
| 4.4 | **Rotas por segmento** (landing pages para SEO) |
| 4.5 | **Error boundary** +Skeleton melhorado |
| 4.6 | **Analytics** (Vercel Web Analytics) + eventos de conversão |
| 4.7 | **CI**: `lint` + `typecheck` + `vitest run` + `build` em cada PR |

### Fase 5 — Escala (opcional)

| # | Ação |
|---|---|
| 5.1 | Expansão além de Vitória/ES — hoje o dataset é regional |
| 5.2 | PWA / instalável |
| 5.3 | Avaliar se o app deve ser migrado para **Next.js** (melhor SEO + SSR das landing pages de segmento), dado que é 100% client-side hoje |

---

## Apêndice A — Resumo dos comandos de verificação

```bash
npm run build          # ✅ 12,4s
npx vitest run         # ✅ 7/7
npm run lint           # ❌ 1 erro, 6 warnings
git log -1 --format='%ci %s'
git ls-files | Select-String 'lojas|xlsx|csv'
```

Verificações de infraestrutura feitas via MCP:
- `vercel.list_projects` / `list_deployments` / `filter_project_envs` / `list_project_domains`
- `supabase.list_tables` / `execute_sql` (`pg_policies`) / `get_project_url` / `get_publishable_keys`
- `https://api.github.com/repos/brunopeeeh/yoogalize` → `"private": false`
- DNS: `veogtzzhwukysdggmqyy.supabase.co` → não resolve

---

## Apêndice B — Métricas do repositório

```
Commits totais:        28
Último commit:         ca99516  2025-10-19 10:36:52 -0300  "Ajuste na página inicial, busca e favoritos"
Primeiro commit:       2025-10-12 08:52:16
Arquivos em src/:      34 arquivos .ts/.tsx (+ 48 em src/components/ui)
Linhas em src/:        ~4.300 (excluindo ui/)
Tamanho do payload:    1,72 MB (lojas.json)
Tamanho do repo:       1.748 KB (GitHub)
Estrelas / forks:      0 / 0
Issues abertas:        0
```

---

# Apêndice C — Atualização de 13/11/2026: API da Yooga e pipeline de dados

> Seção adicionada **depois** da análise original, quando o usuário informou que a base estava desatualizada (lojas que saíram da Yooga).
> Ela **corrige** duas conclusões erradas da análise inicial (B4 e os "horários sintéticos") e documenta a descoberta que resolve o problema de dado desatualizado.

## C.1 A API pública da Yooga (descoberta principal)

O endpoint de delivery é **público e sem autenticação**:

```
GET https://delivery2.yooga.com.br/v2/stores/{slug}
```

| Resposta | Significado |
|---|---|
| `200` | A loja existe. O corpo traz o registro completo |
| `400` `{"message":"Erro ao buscar loja"}` | A loja **saiu da base** |
| `429` + `Retry-After` | Rate limit — **~18 requisições por janela de 60 s** |

Endpoints relacionados, extraídos do bundle `main.2e372caec6b0d312.js` do app de delivery:

| Endpoint | Função |
|---|---|
| `delivery2.yooga.com.br/v2/stores/{slug}` | Registro da loja |
| `delivery2.yooga.com.br/v2/stores/{slug}/menu` | Cardápio completo |
| `delivery2.yooga.com.br/stores` | Webhook de stores (POST) |
| `prod.api.yooga.com.br` | API NestJS principal (health: `{"message":"Server is up 🚀"}`) |
| `api4.yooga.com.br` | API node/CRM |
| `wss://socket-prod.yooga.com.br/` | WebSocket de status |

**Não existe endpoint público de listagem** — só por slug. 817–1369 lojas ⇒ ~45–80 min de auditoria.

### Campos úteis do registro

```jsonc
{
  "id": 14824, "idi": 35582,
  "name": "Vila do Açaí - Laranjeiras",
  "url": "vila-do-acai-laranjeiras",          // slug canônico
  "opened": 1,                                // 0 = desativada/fechada
  "blocked": 0,
  "latitude": -20.19555505, "longitude": -40.25907999,
  "timezone": "America/Sao_Paulo",
  "address": { "address": "...", "number": "15", "neighbourhood": "...",
               "city": "Serra", "state": "ES", "cep": "29165050",
               "addressFormatted": "..." },
  "schedule_json": "[{\"day_of_week\":0,...,\"start\":\"2025-02-12T17:45:13Z\"}]",
  "delivery_fee_json": "{... \"fullAddress\": \"R. Pasteur, 14 - ...\"}"
}
```

⚠️ **A API faz match fuzzy.** Um slug obsoleto pode devolver `200` **apontando para outra loja**. Por isso a auditoria classifica em 4 estados, e não 2:

| Estado | Critério |
|---|---|
| `ativa` | 200 + `api.url == slug` + nome confere |
| `removida` | 400 |
| `desatualizada` | 200 mas `api.url` ou `api.name` divergem |
| `ferro` | rede / 5xx |

## C.2 Ferramentas criadas

| Arquivo | Função |
|---|---|
| `tools/audit-stores.mjs` | Audita cada slug contra a API. Classifica em `ativa` / `removida` / `desatualizada`. Throttle de 16 req/min, respeita `Retry-After`, cache resumível em `reports/.audit-cache.json`. **Não modifica** `public/lojas.json` |
| `tools/data-quality.mjs` | Perfil de qualidade do JSON: cidades, slugs duplicados/quebrados, coordenadas, horários, segmentos, campos vazios, endereços malformados |

Uso:
```bash
node tools/audit-stores.mjs                  # auditoria completa (~80 min)
node tools/audit-stores.mjs --limit 30       # amostra rápida
node tools/data-quality.mjs public/lojas.json
```

## C.3 Correções à análise original

| Item | Antes | Depois |
|---|---|---|
| **B4 — fuso horário** | "possivelmente duplo (grave)" | ✅ **Falso.** A API devolve UTC com `Z`; a conversão -3h do Python está correta e acontece uma vez só. Lógica do app **correta** |
| **Horários "sintéticos"** | "dado sintético/gerado, assinatura de ruído" | ✅ **Falso.** Os segundos vêm do timestamp real de criação do registro na Yooga (`17:45:13Z`). Dado legítimo |
| **B2 — filtro de cidade** | 5 cidades no dataset | Agora **49 cidades** (Claude regenerou via Databricks). O bug de match exato + `setSelectedCity(newCity)` **continua** e agora afeta 49 valores |

## C.4 O pipeline real: Databricks

O `atualizar_lojas.py` (criado pelo Claude) consulta o **Databricks** — essa é a fonte autoritativa, e é muito melhor que a API pública:

```sql
select * from yooga_delta_lake_curated.consumers.active_companies where address_state = 'ES'
left join ...mysql_yooga_delivery.stores          -- slug + schedule_config
left join ...consumers.installation_geolocation    -- coordenadas
left join ...customer_experience.company_detailed_metrics  -- tipo de atendimento
```

Pontos fortes: `active_companies` já exclui empresas inativas; coordenadas são cruzadas entre duas fontes com desempate por Nominatim; `geocode_cache.json` evita repetir geocoding.

### Impacto no `lojas.json`

| Métrica | Antes (817) | Depois (1369) |
|---|---|---|
| Lojas | 817 | **1369** (+67%) |
| Cidades | 5 | **49** |
| Segmentos | 38 | 39 |
| Sem coordenada | 0 | 0 ✅ |
| Coordenadas fora do ES | — | 0 ✅ |
| `nome_empresa` vazio | — | 0 ✅ |
| **Lojas sem horário utilizável** | ~0 | **299 (22%)** ⚠️ |
| **Slugs quebrados** | 16 | **39** ⚠️ |

## C.5 Resultado da auditoria (13/11/2026 → 14/11/2026)

Auditoria completa: **1285 slugs** consultados na API (16 req/min, ~80 min, cache resumível).

| Estado | Qtd. | Significado |
|---|---|---|
| `ativa` | **1274** | Link funciona (`api.url` == slug) |
| `removida` | **11** | HTTP 400 → **saiu da base** |
| `desatualizada` | **0** | Nenhum slug obsoleto no caminho |
| `erro` | 0 | — |

### As 11 lojas que realmente saíram

| Loja | Slug | Cidade |
|---|---|---|
| Distribuidora Preço Bom | `distribuidora-preco-bom CANCELADO` | Vitória |
| Estação Hamburguer - Guarapari | `estacao-hamburguer---guarapari- CANCELADO` | Guarapari |
| Vila Bbq - Jardim Camburi - 458 | `vilabbqjc CANCELADO` | Vitória |
| Bola 7 Botequim - 150252 | `bola-7-botequim YOOGA` | Guarapari |
| Rei Do Expresso Café Bar - Loja Ii | `rei-do-expresso-cafe-bar@` | Vitória |
| Hoje Tem Torta | `hoje-tem-torta` | Serra |
| Spettaria & Cia | `spettaria-&-cia` | Vitória |
| Baubo Doceria | `baubo-doceria&&&` | Vila Velha |
| Da Pri Pizzaria | `da-pri-pizzaria YOOGA` | Cariacica |
| Q'pizza Forno A Lenha | `qpizza-forno-a-lenha-@@` | Vitória |
| Resenha Burger Na Parrilla | `resenha-d-leve-burger-&-espeto` | Aracruz |

**Todas reconfirmadas** — testei slugs alternativos (sem sufixo, sem pontuação). Todas retornam 400. **Não são recuperáveis.**

> ⚠️ Interessante: 3 delas já tinham marcador (`CANCELADO`) no slug, e 8 tinham slug **corrompido** (`@`, `&&&`, ` YOOGA`). Ou seja, a maior parte já estava moribunda antes.

### P1 — 39 lojas com cardápio apontando para a loja errada 🔴

O `api.url` bate, então o link "funciona" — mas aponta para a loja errada:

| Slug | Qtd. | Resolve para | Gravidade |
|---|---|---|---|
| `yooga` | **21** | **Yooga Tecnologia** (api id=5) | 🔴 **CRÍTICA** — leva ao cardápio do *headquarters da própria Yooga* |
| `copied` | **14** | GonGon Premium (api id=858) | 🔴 **CRÍTICA** — 14 lojas → a mesma loja |
| `estacao-beer` | 2 | Estação Beer (id=38071) | 🟠 alta |
| `rk-conveniencia-e-distribuicao` | 2 | Rk Conveniencia E Distribuicao (id=52187, `opened=1`, tem endereço) | 🟡 baixa — parece ser a loja correta, duplicada |

Store-as afetadas por `copied`: 40 Sabores (×3), Vila Sucos (×2), Ice Mania 2, Ybira Cafe & Bistro, Ale Do Pudim Filial, Don Vicente, Distribuidora Aribiri, Distribuidora Ataíde Ibes, Distribuidora Dois Amigos, Distribuidora Resplendor, Green Station Shopping Vila Velha.

**Impacto:** o usuário vê o cardápio de outra empresa. É o problema mais grave do conjunto — quebra de confiança e risco comercial.

### P2 — 42 lojas com coordenadas > 5 km de distância da API

A comparação `lojas.json` × API de delivery:

| Faixa | Qtd. |
|---|---|
| < 100 m | 41 |
| 100 m – 500 m | 138 |
| 500 m – 1 km | 57 |
| 1 km – 5 km | 65 |
| **> 5 km** | **42** |

Casos extremos: `Duas Irmãs` (1.570 km), `Dark Shop Supplements Bb` (1.394 km), `Kibon - Maceió Ponta Da Terra` (1.279 km — está em **Maceió/AL**, não no ES).

➡️ Nesses casos é preciso decidir **qual fonte é a correta** — a API de delivery ou o Databricks. Affecta diretamente a distância exibida e a ordenação dos resultados.

**Nota:** 591 lojas **não têm coordenada na API** (o delivery não tem geolocalização para elas). Nesses casos o JSON do Databricks é a melhor fonte disponível — o app está melhor que a API nesse ponto.

### P3 — 299 lojas (22%) sem horário → somem com "Abertas Agora"

`getOpeningHoursInfo()` retorna `closed` quando não há slots, e o filtro `openNow` remove lojas fechadas. Com 299 lojas sem `schedule_config`, **22% do catálogo desaparece** quando esse filtro está ligado.

**Correção sugerida:** tratar "horário não informado" como **neutro** (não excluir), em vez de "fechado".

### P4 — 84 lojas sem `link delivery`

Sem cardápio e sem como consultar a API. Aceitável se forem lojas sem operação de delivery — vale cruzar com `tipo_atendimento == "Somente Presencial"`.

### P5 — filtro de cidade por igualdade exata (herança do B2)

Com 49 cidades, o filtro `establishment.city === selectedCity` é frágil: qualquer variação de grafia zera os resultados. Recomenda-se normalizar (slug) e casar por região.

### Correção: `opened` NÃO é sinal de desativação

O campo `opened` da API significa **"aberta agora"**, não "desativada". Às 22:30 (hora da auditoria) **1043 das 1274** lojas estavam com `opened=0` — simplesmente fechadas naquele horário, todas com horário de funcionamento completo nos 7 dias. **Não usar `opened` como filtro de desativação.**

## C.6 Estado do Raspberry Pi (investigado)

O Pi **não hospeda** o banco do yoogalize.

| Item | Estado |
|---|---|
| Host | Raspberry Pi 3 Model B+ (aarch64), Debian 13, 905 MB RAM, 48 GB livres |
| PostgreSQL | 17.11, `postgresql@17-main.service`, escutando **só em `127.0.0.1:5432`** ✅ |
| Bancos | `bruno_db` (7,4 MB) e `postgres` (7,5 MB) — **ambos vazios (0 tabelas)** |
| Role `bruno_app` | login OK, **sem superusuário**, tem `CREATEDB`, senha desconhecida, **nunca usada** |
| Docker | `n8n` (SQLite em `/home/brunopeeh/n8n/n8n_data/database.sqlite`) |
| Projeto `echo` | Python em `/home/brunopeeh/echo`, usa **SQLite** (`data/echo.sqlite3`: `events` 2.000 linhas, `world` 1) |
| Tailscale | instalado, **deslogado** (`NeedsLogin`) |
| Cron | nenhum agendamento |

Conclusão: o Postgres do Pi é **ocioso** e pode ser o backend do yoogalize — mas o `bruno_db` vazio + `bruno_app` sem uso sugerem que ele foi previsto para outra coisa. O Databricks é a fonte autoritativa; o Pi seria apenas cache/API.

⚠️ **Segurança:** `sudo` com senha `123456` (trivial) num host na LAN. Como o acesso por **chave SSH já funciona**, vale remover a senha do `sudo` e desabilitar `PasswordAuthentication` no `sshd_config`.


---

# Apêndice D — Banco de dados no Raspberry Pi (14/11/2026)

Tabelas criadas a partir do `public/lojas.json` atualizado (1369 lojas).

## D.1 Onde ficou

| Item | Valor |
|---|---|
| Servidor | Raspberry Pi 3 Model B+ (aarch64), Debian 13 |
| Banco | PostgreSQL 17.11, base `bruno_db` |
| Escuta | **apenas `127.0.0.1:5432`** (`listen_addresses = localhost`) — não exposto na LAN ✅ |
| Fuso do servidor | `America/Sao_Paulo` (igual ao `src/lib/utils.ts`) |
| PostGIS | ❌ **não disponível** no Debian arm64 → Haversine em SQL puro |
| Extensões usadas | `pgcrypto`, `pg_trgm`, `unaccent` |
| Role da aplicação | `bruno_app` (sem superusuário, `SELECT` em tudo) |
| Tamanho final | 14 MB (`lojas` 4,8 MB + `loja_horarios` 1,2 MB) |

## D.2 Tabelas

**`lojas`** — 1358 linhas
```
id, nome_empresa, modelo_negocio, tipo_atendimento,
link_delivery, link_quebrado, link_observacao,
logradouro, numero, bairro, cidade, estado, cep, endereco_completo,
latitude, longitude,
slug, cidade_slug, nome_slug,
tem_horario, abre_agora, status_horario,
created_at, updated_at
```

**`loja_horarios`** — 6118 linhas
```
id, loja_id → lojas(id), day_of_week (0=Dom..6=Sáb), day, start_time, end_time, tipo
```

Decisões de projeto:

| Decisão | Motivo |
|---|---|
| `link_delivery` **NÃO** é unique | 39 lojas compartilham slug (o problema P1). `link_quebrado` marca as que apontam para a loja errada |
| `slug` = mesmo formato do front | `slugify(nome)-lat-lon` — mantém os **favoritos** funcionando. Verificado: o Claude mexeu em `normalizers.ts` só no `linkDelivery`, o slug segue igual |
| `cidade_slug` / `nome_slug` | busca sem acento e tolerante a variação de grafia (bug P5) |
| `status_horario` com 3 valores | `desconhecido` é separado de `fechado` — é a correção do P3 |
| `loja_horarios` normalizada | permite "abertas agora" em SQL, em vez de varrer 1369 lojas no cliente |

## D.3 Funções e views

| Objeto | Para quê |
|---|---|
| `fn_distancia_km(lat1,lon1,lat2,lon2)` | Haversine — **mesma fórmula do front**. Validado: SQL = JS exatamente (2,6 / 0,6 / 17,1 km nos mesmos 3 pares) |
| `fn_loja_status_agora(loja_id)` | `aberto` \| `fechado` \| `desconhecido` |
| `fn_lojas_perto(lat,lon,raio,cidade,segmento,tipo,so_abertas)` | a query central do app, já ordenada por distância |
| `vw_lojas_json` | **reproduz exatamente o formato de `public/lojas.json`** — troca `fetch('/lojas.json')` por `fetch('/api/lojas')` sem mexer no front |
| `vw_lojas_cidades` / `_segmentos` / `_tipos_atendimento` | dropdowns dos filtros (hoje derivados do JSON no cliente) |

## D.4 Dados carregados

```
lojas ................. 1358   (1369 - 11 removidas pela auditoria)
loja_horarios ......... 6118   (6168 - 50 das lojas removidas)
cidades ...............   49
segmentos .............   39
status_aberto .........   26   (08:20 da manhã)
status_fechado ........  935
status_desconhecido ...  397
link_quebrado .........   37
```

### Faixas degeneradas: 554 descartadas

| Padrão | Qtd. | Tratamento |
|---|---|---|
| `00:00:00 → 00:00:00` | 510 | placeholder de "horário não informado" → descartado |
| `XX:XX:SS → XX:XX:SS` (segundos) | 44 | idem |
| `"Data inválida"` | 128 | rejeitado pelo parser |

Sem esse filtro, o `CHECK` constraint derrubava o `INSERT` inteiro e a tabela ficava **vazia** (foi o bug que travou a primeira carga). Agora o `INSERT` também filtra no SQL — uma faixa ruim nunca mais zera a tabela.

### Patch pós-carga (`sql/patches-catalogo.sql`)

Roda automaticamente após cada carga:
1. **DELETE** das 11 lojas que saíram da Yooga (auditoria da API)
2. **UPDATE** marcando os 37 links quebrados (`yooga` → Yooga Tecnologia, `copied` → GonGon Premium, `estacao-beer` → Estação Beer)
3. Recalcula `status_horario`

## D.5 Ferramentas

| Arquivo | |
|---|---|
| `sql/schema.sql` | DDL completo, **idempotente** |
| `sql/patches-catalogo.sql` | patch pós-carga |
| `sql/marcadores-link-quebrado.sql` | só os marcadores (uso isolado) |
| `sql/README.md` | documentação do schema |
| `tools/load-lojas.py` | carregador — **stdlib Python, sem dependências** (gera CSV e usa `psql \copy`) |

### Como recarregar

```bash
python3 tools/load-lojas.py \
  --json /tmp/yoogalize/lojas.json \
  --db bruno_db --user postgres --host /var/run/postgresql \
  --patch /tmp/yoogalize/patches-catalogo.sql --truncate
```

`--host /var/run/postgresql` usa **peer auth** (sem senha). Para TCP seria preciso senha do role `postgres` — que não é conhecida.

## D.6 Pendências para expor ao front

1. **Senha do `bruno_app`**: o role existe mas a senha é desconhecida. Definir com
   `ALTER ROLE bruno_app WITH PASSWORD '...'`.
2. **Postgres escuta só em localhost** — para o front na Vercel alcançar, é preciso:
   - `tailscale up` (já instalado, deslogado) e conectar por Tailscale, **ou**
   - uma API no Pi (FastAPI) atrás de proxy TLS, **ou**
   - subir o catálogo para o Supabase (`lvorxhmvppglnlcxnrbp`), que tem URL pública e chave anon.
3. **Não existe API REST ainda** — o Postgres tem as funções prontas, mas falta expô-las (`/api/lojas`, `/api/lojas/perto`, `/api/lojas/cidades`).
4. **O `vw_lojas_json` já entrega o payload exato** que o front espera — é o caminho mais curto para migrar sem tocar em `src/`.

