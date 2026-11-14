-- =============================================================================
-- Patches de catalogo — aplicados automaticamente apos cada carga
-- (tools/load-lojas.py -> etapa "Aplicando patches")
--
-- 1) Remove as lojas que SAIRAM da Yooga (auditoria contra a API publica)
-- 2) Marca as lojas cujo link de delivery aponta para OUTRA loja
--
-- Fonte da auditoria: GET https://delivery2.yooga.com.br/v2/stores/{slug}
-- Relatorio: reports/reconciliacao.json
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Lojas que sairam da base (HTTP 400 em todas as variantes testadas)
-- -----------------------------------------------------------------------------
DELETE FROM lojas WHERE link_delivery IN (
    'distribuidora-preco-bom CANCELADO',
    'estacao-hamburguer---guarapari- CANCELADO',
    'vilabbqjc CANCELADO',
    'bola-7-botequim YOOGA',
    'rei-do-expresso-cafe-bar@',
    'hoje-tem-torta',
    'spettaria-&-cia',
    'baubo-doceria&&&',
    'da-pri-pizzaria YOOGA',
    'qpizza-forno-a-lenha-@@',
    'resenha-d-leve-burger-&-espeto'
);

-- -----------------------------------------------------------------------------
-- 2) Links quebrados: o slug resolve para OUTRA loja
-- -----------------------------------------------------------------------------

-- 21 lojas -> "Yooga Tecnologia" (api id=5) = headquarters da propria Yooga
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

-- -----------------------------------------------------------------------------
-- 3) Recalcula o status (as remocoes podem ter mudado a tabela)
-- -----------------------------------------------------------------------------
UPDATE lojas l SET
    status_horario = fn_loja_status_agora(l.id),
    abre_agora = CASE
        WHEN fn_loja_status_agora(l.id) = 'desconhecido' THEN NULL
        ELSE fn_loja_status_agora(l.id) = 'aberto'
    END;
