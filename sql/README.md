# Schema do catálogo — Descubra Yooga

PostgreSQL 17 no Raspberry Pi (`bruno_db`). Dados originados de `public/lojas.json`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `schema.sql` | DDL completo: tabelas, índices, funções, views, permissões. **Idempotente** (faz `DROP ... CASCADE` no topo) |
| `patches-catalogo.sql` | Roda **depois** de cada carga: remove as lojas que saíram da Yooga e marca os links de delivery quebrados |
| `marcadores-link-quebrado.sql` | Apenas os marcadores de link quebrado (caso queira rodá-los isoladamente) |

## Tabelas

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

- `slug` — mesmo formato do front (`slugify(nome)-lat-lon`), serve de **id de favorito**. Unique.
- `link_delivery` — **não** é unique: 39 lojas compartilham slug (39 com link quebrado → `link_quebrado = true`).
- `status_horario` — `aberto` | `fechado` | `desconhecido` (calculado por `fn_loja_status_agora`).

**`loja_horarios`** — 6118 linhas
```
id, loja_id → lojas(id), day_of_week (0=Dom..6=Sáb), day, start_time, end_time, tipo
```

## Funções

| Função | Retorna |
|---|---|
| `fn_distancia_km(lat1,lon1,lat2,lon2)` | km — **mesma fórmula do front** (`src/lib/distance.ts`). Validado: SQL = JS |
| `fn_loja_status_agora(loja_id)` | `aberto` \| `fechado` \| `desconhecido` (fuso `America/Sao_Paulo`) |
| `fn_lojas_perto(lat,lon,raio_km,cidade,segmento,tipo_atendimento,apenas_abertas)` | busca por raio com filtros, já ordenado por distância |

## Views

| View | Para quê |
|---|---|
| `vw_lojas_json` | **Reproduz exatamente o formato de `public/lojas.json`** — permite trocar `fetch('/lojas.json')` por `fetch('/api/lojas')` sem mexer no front |
| `vw_lojas_cidades` | dropdown de cidades (com total) |
| `vw_lojas_segmentos` | dropdown de segmentos |
| `vw_lojas_tipos_atendimento` | dropdown de tipo de atendimento |

## Carregar

```bash
# no Pi (via ssh)
python3 tools/load-lojas.py \
  --json /tmp/yoogalize/lojas.json \
  --db bruno_db --user postgres --host /var/run/postgresql \
  --patch /tmp/yoogalize/patches-catalogo.sql \
  --truncate
```

O `--host /var/run/postgresql` usa **peer auth** (sem senha). Para TCP seria preciso senha do role.

## Notas de qualidade

- **554 faixas degeneradas** descartadas (`start == end`): 510 com `00:00:00 → 00:00:00` e 44 com valores em segundos. São placeholders de "horário não informado", não faixas reais.
- **128 faixas** com `"Data inválida"` são rejeitadas pelo parser.
- Por isso **397 lojas ficam com `status_horario = 'desconhecido'`** — o front deve tratá-las como **neutras**, não como "fechadas" (hoje o filtro "Abertas Agora" as remove).
- **128** faixas com `"Data inválida"` → rejeitadas pelo parser de horário.

## Permissões

`bruno_app` tem `SELECT` em todas as tabelas e views. Para a API conectar via TCP, o role precisa de senha:

```sql
ALTER ROLE bruno_app WITH PASSWORD '...';
```

O Postgres escuta **apenas em `127.0.0.1:5432`** (`listen_addresses = localhost`). Para acesso externo seria preciso Tailscale (`tailscale up` — está instalado, mas deslogado) ou um proxy.
