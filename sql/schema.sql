-- =============================================================================
-- Descubra Yooga — schema do catalogo de lojas
-- Alvo: PostgreSQL 17 (Raspberry Pi) / base bruno_db
--
-- Origem dos dados: public/lojas.json (gerado por atualizar_lojas.py a partir
-- do Databricks). Carregador: tools/load-lojas.py
--
-- Aplicar:
--   psql -d bruno_db -f sql/schema.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busca por nome (similaridade)
CREATE EXTENSION IF NOT EXISTS unaccent;   -- comparacao sem acento (cidade)

-- -----------------------------------------------------------------------------
-- Tabela principal
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS loja_horarios CASCADE;
DROP TABLE IF EXISTS lojas CASCADE;

CREATE TABLE lojas (
    id                bigserial PRIMARY KEY,

    -- Identificacao
    nome_empresa      text NOT NULL,
    modelo_negocio    text NOT NULL,                    -- segmento ("Restaurante", "Bar / Petiscaria"...)
    tipo_atendimento  text,                             -- Presencial e Delivery | Somente Delivery | Somente Presencial
    link_delivery     text,                             -- slug do cardapio na Yooga (pode ser nulo)
                                                        -- NAO e unico: a fonte tem 39 lojas com slug repetido
                                                        -- (ver sql/marcadores-link-quebrado.sql)
    link_quebrado     boolean NOT NULL DEFAULT false,   -- slug aponta para OUTRA loja (auditoria da API)
    link_observacao   text,                             -- detalhe do link quebrado
    banner_url        text,                             -- URL da capa/banner na CDN da Yooga
    tem_clube_cupons  boolean NOT NULL DEFAULT false,   -- participa do Clube de Cupons da Yooga

    -- Endereco
    logradouro        text,
    numero            text,
    bairro            text,
    cidade            text NOT NULL,
    estado            char(2) NOT NULL DEFAULT 'ES',
    cep               text,
    endereco_completo text,

    -- Geolocalizacao
    latitude          double precision NOT NULL,
    longitude         double precision NOT NULL,

    -- Derivados
    slug              text NOT NULL UNIQUE,             -- mesmo formato do front (id de favorito)
    cidade_slug       text NOT NULL,                    -- cidade sem acento, para busca
    nome_slug         text NOT NULL,                    -- nome sem acento, para busca

    -- Temporal
    tem_horario       boolean NOT NULL DEFAULT false,   -- possui ao menos uma faixa
    abre_agora        boolean,                          -- calculada; NULL = horario desconhecido
    status_horario    text NOT NULL DEFAULT 'desconhecido'
                        CHECK (status_horario IN ('aberto', 'fechado', 'desconhecido')),

    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  lojas IS 'Catalogo de estabelecimentos do Descubra Yooga (ES)';
COMMENT ON COLUMN lojas.slug IS 'Identificador estavel, mesmo formato usado pelo front para favoritos';
COMMENT ON COLUMN lojas.status_horario IS 'aberto | fechado | desconhecido (sem horario informado)';

-- -----------------------------------------------------------------------------
-- Horarios (normalizado: uma linha por faixa)
-- -----------------------------------------------------------------------------
CREATE TABLE loja_horarios (
    id          bigserial PRIMARY KEY,
    loja_id     bigint      NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
    day_of_week smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Domingo .. 6=Sábado
    day         text        NOT NULL,
    start_time  time,
    end_time    time,
    tipo        text,                                    -- Delivery | Delivery e Agendamento | Agendamento
    -- start_time <> end_time nao e garantido: a fonte tem 554 faixas degeneradas
    -- (00:00:00 -> 00:00:00), que sao placeholders de "horario nao informado".
    -- O carregador descarta essas faixas; a constraint apenas impede nulos.
    CONSTRAINT loja_horarios_hora_valida CHECK (start_time IS NOT NULL AND end_time IS NOT NULL)
);

COMMENT ON TABLE loja_horarios IS 'Faixas de funcionamento por dia da semana';

-- -----------------------------------------------------------------------------
-- Indices
-- -----------------------------------------------------------------------------
CREATE INDEX idx_lojas_cidade            ON lojas (cidade);
CREATE INDEX idx_lojas_cidade_slug       ON lojas (cidade_slug);
CREATE INDEX idx_lojas_modelo_negocio    ON lojas (modelo_negocio);
CREATE INDEX idx_lojas_tipo_atendimento  ON lojas (tipo_atendimento);
CREATE INDEX idx_lojas_link_delivery     ON lojas (link_delivery);
CREATE INDEX idx_lojas_link_quebrado    ON lojas (link_quebrado) WHERE link_quebrado;
CREATE INDEX idx_lojas_lat_lng           ON lojas (latitude, longitude);
CREATE INDEX idx_lojas_nome_trgm         ON lojas USING gin (nome_slug gin_trgm_ops);
CREATE INDEX idx_lojas_geo_bbox          ON lojas (latitude, longitude) INCLUDE (cidade);

CREATE INDEX idx_horarios_loja   ON loja_horarios (loja_id);
CREATE INDEX idx_horarios_dia   ON loja_horarios (day_of_week, start_time, end_time);

-- -----------------------------------------------------------------------------
-- Trigger: manter updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lojas_touch
    BEFORE UPDATE ON lojas
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Distancia (Haversine) — mesma formula do front (src/lib/distance.ts)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_distancia_km(
    lat1 double precision, lon1 double precision,
    lat2 double precision, lon2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
    SELECT 6371 * 2 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lon2 - lon1) / 2), 2)
    ));
$$;

-- -----------------------------------------------------------------------------
-- Status de funcionamento agora (fuso America/Sao_Paulo)
--
-- Retorna 'aberto' | 'fechado' | 'desconhecido'.
-- "desconhecido" = loja sem horario informado — o front deve tratar como
-- NEUTRO (nao excluir), em vez de fechado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_loja_status_agora(p_loja_id bigint)
RETURNS text
LANGUAGE sql STABLE AS $$
    WITH agora AS (
        SELECT
            (EXTRACT(ISODOW FROM now() AT TIME ZONE 'America/Sao_Paulo')::int - 1) AS dow,
            (EXTRACT(HOUR   FROM now() AT TIME ZONE 'America/Sao_Paulo')::int * 60
             + EXTRACT(MINUTE FROM now() AT TIME ZONE 'America/Sao_Paulo')::int) AS minuto
    ),
    faixas AS (
        SELECT
            h.day_of_week,
            h.start_time,
            h.end_time,
            (EXTRACT(HOUR FROM h.start_time)::int * 60 + EXTRACT(MINUTE FROM h.start_time)::int) AS ini,
            (EXTRACT(HOUR FROM h.end_time)::int   * 60 + EXTRACT(MINUTE FROM h.end_time)::int)   AS fim
        FROM loja_horarios h
        WHERE h.loja_id = p_loja_id
          AND h.start_time IS NOT NULL
          AND h.end_time   IS NOT NULL
    )
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM faixas) THEN 'desconhecido'
        WHEN EXISTS (
            SELECT 1 FROM faixas f, agora
            WHERE (f.day_of_week = agora.dow
                   AND agora.minuto >= f.ini AND agora.minuto < f.fim)
               OR (f.day_of_week = (agora.dow + 6) % 7   -- vira a noite: ontem -> hoje
                   AND f.fim <= f.ini
                   AND agora.minuto < f.fim)
        ) THEN 'aberto'
        ELSE 'fechado'
    END;
$$;

-- -----------------------------------------------------------------------------
-- Busca por raio (a query central do app)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_lojas_perto(
    p_lat double precision,
    p_lon double precision,
    p_raio_km double precision DEFAULT 5,
    p_cidade text DEFAULT NULL,
    p_segmento text DEFAULT NULL,
    p_tipo_atendimento text DEFAULT NULL,
    p_apenas_abertas boolean DEFAULT false
)
RETURNS TABLE (
    id bigint,
    nome_empresa text,
    modelo_negocio text,
    tipo_atendimento text,
    link_delivery text,
    logradouro text,
    numero text,
    bairro text,
    cidade text,
    estado char(2),
    cep text,
    endereco_completo text,
    latitude double precision,
    longitude double precision,
    slug text,
    distancia_km double precision,
    status_horario text
)
LANGUAGE sql STABLE AS $$
    SELECT
        l.id, l.nome_empresa, l.modelo_negocio, l.tipo_atendimento, l.link_delivery,
        l.logradouro, l.numero, l.bairro, l.cidade, l.estado, l.cep, l.endereco_completo,
        l.latitude, l.longitude, l.slug,
        round((fn_distancia_km(p_lat, p_lon, l.latitude, l.longitude))::numeric, 1)::double precision AS distancia_km,
        fn_loja_status_agora(l.id) AS status_horario
    FROM lojas l
    WHERE fn_distancia_km(p_lat, p_lon, l.latitude, l.longitude) <= p_raio_km
      AND (p_cidade           IS NULL OR l.cidade           = p_cidade)
      AND (p_segmento         IS NULL OR l.modelo_negocio   = p_segmento)
      AND (p_tipo_atendimento  IS NULL OR l.tipo_atendimento  = p_tipo_atendimento)
      AND (NOT p_apenas_abertas OR fn_loja_status_agora(l.id) = 'aberto')
    ORDER BY distancia_km;
$$;

-- -----------------------------------------------------------------------------
-- Filtros para o dropdown (o front deriva esses valores do JSON)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_lojas_cidades AS
    SELECT cidade, count(*) AS total
    FROM lojas GROUP BY cidade ORDER BY cidade;

CREATE OR REPLACE VIEW vw_lojas_segmentos AS
    SELECT modelo_negocio, count(*) AS total
    FROM lojas GROUP BY modelo_negocio ORDER BY modelo_negocio;

CREATE OR REPLACE VIEW vw_lojas_tipos_atendimento AS
    SELECT tipo_atendimento, count(*) AS total
    FROM lojas WHERE tipo_atendimento IS NOT NULL
    GROUP BY tipo_atendimento ORDER BY tipo_atendimento;

-- -----------------------------------------------------------------------------
-- View JSON: reproduz EXATAMENTE o formato de public/lojas.json
-- Permite trocar `fetch('/lojas.json')` por `fetch('/api/lojas')`
-- sem nenhuma alteracao no front.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_lojas_json AS
SELECT jsonb_build_object(
    'result', jsonb_agg(
        jsonb_build_object(
            'nome_empresa',      l.nome_empresa,
            'modelo_negocio',    l.modelo_negocio,
            'tipo_atendimento',  l.tipo_atendimento,
            'logradouro',        l.logradouro,
            'número',            l.numero,
            'bairro',            l.bairro,
            'cidade',            l.cidade,
            'estado',            l.estado,
            'cep',               l.cep,
            'link delivery',     l.link_delivery,
            'banner',            l.banner_url,
            'tem_clube_cupons',  l.tem_clube_cupons,
            'endereco completo', l.endereco_completo,
            -- sempre os 7 dias, igual ao JSON original (dias sem faixa vem com [])
            'horario_funcionamento', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'day_of_week', g.dow,
                        'day', (ARRAY['Domingo','Segunda-feira','Terça-feira',
                                      'Quarta-feira','Quinta-feira','Sexta-feira','Sábado'])[g.dow + 1],
                        'hours', COALESCE((
                            SELECT jsonb_agg(jsonb_build_object(
                                'start', to_char(s.start_time, 'HH24:MI:SS'),
                                'end',   to_char(s.end_time,   'HH24:MI:SS'),
                                'type',  s.tipo
                            ) ORDER BY s.start_time)
                            FROM loja_horarios s
                            WHERE s.loja_id = l.id AND s.day_of_week = g.dow
                        ), '[]'::jsonb)
                    ) ORDER BY g.dow
                )
                FROM generate_series(0, 6) AS g(dow)
            ),
            'Latitude',  l.latitude,
            'Longitude', l.longitude
        )
        ORDER BY l.cidade, l.nome_empresa
    )
) AS payload
FROM lojas l;

-- -----------------------------------------------------------------------------
-- Permissoes
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO bruno_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bruno_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bruno_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bruno_app;
