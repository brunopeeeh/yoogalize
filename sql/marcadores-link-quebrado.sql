-- =============================================================================
-- Marcadores de link quebrado — resultado da auditoria contra a API da Yooga
-- (GET https://delivery2.yooga.com.br/v2/stores/{slug})
--
-- 39 lojas do catalogo apontam para o slug de OUTRA loja. Nao sao removiveis:
-- o slug correto precisa ser buscado na fonte (mysql_yooga_delivery.stores por
-- installation_id). Aqui apenas marcamos para o front nao exibir o cardapio
-- errado.
--
-- Aplicar: psql -d bruno_db -f sql/marcadores-link-quebrado.sql
-- =============================================================================

-- 21 lojas -> "Yooga Tecnologia" (api id=5) = o headquarters da propria Yooga
UPDATE lojas SET
    link_quebrado   = true,
    link_observacao = 'slug "yooga" resolve para Yooga Tecnologia (api id=5)'
WHERE link_delivery = 'yooga';

-- 14 lojas -> "GonGon Premium" (api id=858)
UPDATE lojas SET
    link_quebrado   = true,
    link_observacao = 'slug "copied" resolve para GonGon Premium (api id=858)'
WHERE link_delivery = 'copied';

-- 2 lojas -> "Estacao Beer" (api id=38071)
UPDATE lojas SET
    link_quebrado   = true,
    link_observacao = 'slug "estacao-beer" resolve para Estacao Beer (api id=38071)'
WHERE link_delivery = 'estacao-beer';

-- 2 lojas com o mesmo slug, porem o slug resolve para a loja CORRETA
-- (Rk Conveniencia E Distribuicao, api id=52187, opened=1, com endereco).
-- Duplicidade no catalogo, nao link errado.
UPDATE lojas SET
    link_quebrado   = false,
    link_observacao = 'slug duplicado no catalogo, porem resolve para a loja correta'
WHERE link_delivery = 'rk-conveniencia-e-distribuicao';

-- Resumo
SELECT link_quebrado,
       count(*) AS lojas,
       string_agg(DISTINCT link_delivery, ', ') AS slugs
FROM lojas
WHERE link_delivery IS NOT NULL
GROUP BY link_quebrado
ORDER BY link_quebrado DESC;
