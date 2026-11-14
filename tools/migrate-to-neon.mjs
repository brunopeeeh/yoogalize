#!/usr/bin/env node
/**
 * tools/migrate-to-neon.mjs
 *
 * Cria o schema no Neon Postgres e carrega todas as lojas e horários de public/lojas.json
 * em lotes de alto desempenho usando PostgreSQL json_to_recordset.
 *
 * Uso:
 *   node tools/migrate-to-neon.mjs [DATABASE_URL]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const dbUrl = process.argv[2] || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error('❌ Erro: Nenhuma DATABASE_URL fornecida.');
  console.error('Uso: node tools/migrate-to-neon.mjs "postgresql://usuario:senha@ep-xyz.neon.tech/neondb?sslmode=require"');
  process.exit(1);
}

const sql = neon(dbUrl);

function semAcento(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(str) {
  return semAcento(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🚀 Iniciando configuração do PostgreSQL no Neon...');

  // 1. Cria extensões e tabelas
  console.log('📦 1/4 Criando tabelas e extensões...');
  await sql`CREATE EXTENSION IF NOT EXISTS unaccent;`;
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;

  await sql`
    CREATE TABLE IF NOT EXISTS lojas (
      id bigserial PRIMARY KEY,
      nome_empresa text NOT NULL,
      modelo_negocio text NOT NULL,
      tipo_atendimento text,
      link_delivery text,
      banner_url text,
      tem_clube_cupons boolean NOT NULL DEFAULT false,
      link_quebrado boolean NOT NULL DEFAULT false,
      link_observacao text,
      logradouro text,
      numero text,
      bairro text,
      cidade text NOT NULL,
      estado char(2) NOT NULL DEFAULT 'ES',
      cep text,
      endereco_completo text,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      slug text NOT NULL UNIQUE,
      cidade_slug text NOT NULL,
      nome_slug text NOT NULL,
      tem_horario boolean NOT NULL DEFAULT false,
      ativo boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS loja_horarios (
      id bigserial PRIMARY KEY,
      loja_id bigint NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
      day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      day text NOT NULL,
      start_time time NOT NULL,
      end_time time NOT NULL,
      tipo text,
      CHECK (start_time <> end_time)
    );
  `;

  // 2. View vw_lojas_json
  console.log('👁️ 2/4 Criando view vw_lojas_json...');
  await sql`
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
          'horario_funcionamento', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'day_of_week', g.dow,
                'day', (ARRAY['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'])[g.dow + 1],
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
    FROM lojas l
    WHERE l.ativo = true;
  `;

  // 3. Lê dados de public/lojas.json
  const jsonPath = path.join(rootDir, 'public', 'lojas.json');
  console.log(`📖 3/4 Lendo dados de ${jsonPath}...`);
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const lojasList = rawData.result || [];

  console.log(`💾 Inserindo ${lojasList.length} lojas no Neon em lote de alta velocidade...`);

  await sql`TRUNCATE loja_horarios, lojas RESTART IDENTITY CASCADE;`;

  const lojasRecords = [];
  const horariosRecords = [];

  for (const l of lojasList) {
    const nome = (l.nome_empresa || '').trim();
    const lat = parseFloat(l.Latitude);
    const lon = parseFloat(l.Longitude);
    if (isNaN(lat) || isNaN(lon) || !nome) continue;

    const slug = `${slugify(nome)}-${lat}-${lon}`;
    const cidade = (l.cidade || '').trim();
    const horarios = Array.isArray(l.horario_funcionamento) ? l.horario_funcionamento : [];
    const temHorario = horarios.some((d) => Array.isArray(d.hours) && d.hours.length > 0);

    lojasRecords.push({
      nome_empresa: nome,
      modelo_negocio: (l.modelo_negocio || 'Outros').trim(),
      tipo_atendimento: l.tipo_atendimento?.trim() || null,
      link_delivery: l['link delivery']?.trim() || null,
      banner_url: l.banner || null,
      tem_clube_cupons: Boolean(l.tem_clube_cupons),
      logradouro: l.logradouro?.trim() || null,
      numero: (l['número'] || l.numero || '') ? String(l['número'] || l.numero).trim() : null,
      bairro: l.bairro?.trim() || null,
      cidade,
      estado: l.estado?.trim() || 'ES',
      cep: l.cep?.trim() || null,
      endereco_completo: l['endereco completo']?.trim() || '',
      latitude: lat,
      longitude: lon,
      slug,
      cidade_slug: semAcento(cidade),
      nome_slug: semAcento(nome),
      tem_horario: temHorario,
    });

    for (const d of horarios) {
      const dow = parseInt(d.day_of_week, 10);
      const dayName = d.day || '';
      for (const h of d.hours || []) {
        if (!h.start || !h.end || h.start === h.end) continue;
        horariosRecords.push({
          slug,
          day_of_week: dow,
          day: dayName,
          start_time: h.start,
          end_time: h.end,
          tipo: h.type || 'REGULAR',
        });
      }
    }
  }

  const CHUNK_SIZE = 200;
  for (let i = 0; i < lojasRecords.length; i += CHUNK_SIZE) {
    const chunk = lojasRecords.slice(i, i + CHUNK_SIZE);
    await sql`
      INSERT INTO lojas (
        nome_empresa, modelo_negocio, tipo_atendimento, link_delivery, banner_url,
        tem_clube_cupons, logradouro, numero, bairro, cidade, estado, cep,
        endereco_completo, latitude, longitude, slug, cidade_slug, nome_slug, tem_horario
      )
      SELECT
        nome_empresa, modelo_negocio, tipo_atendimento, link_delivery, banner_url,
        tem_clube_cupons, logradouro, numero, bairro, cidade, estado, cep,
        endereco_completo, latitude, longitude, slug, cidade_slug, nome_slug, tem_horario
      FROM json_to_recordset(${JSON.stringify(chunk)}::json) AS x(
        nome_empresa text, modelo_negocio text, tipo_atendimento text, link_delivery text, banner_url text,
        tem_clube_cupons boolean, logradouro text, numero text, bairro text, cidade text, estado char(2), cep text,
        endereco_completo text, latitude double precision, longitude double precision, slug text, cidade_slug text, nome_slug text, tem_horario boolean
      )
      ON CONFLICT (slug) DO NOTHING;
    `;
  }

  const H_CHUNK_SIZE = 500;
  for (let i = 0; i < horariosRecords.length; i += H_CHUNK_SIZE) {
    const chunk = horariosRecords.slice(i, i + H_CHUNK_SIZE);
    await sql`
      INSERT INTO loja_horarios (loja_id, day_of_week, day, start_time, end_time, tipo)
      SELECT
        l.id,
        h.day_of_week,
        h.day,
        h.start_time::time,
        h.end_time::time,
        h.tipo
      FROM json_to_recordset(${JSON.stringify(chunk)}::json) AS h(
        slug text, day_of_week smallint, day text, start_time text, end_time text, tipo text
      )
      JOIN lojas l ON l.slug = h.slug;
    `;
  }

  // 4. Validação
  console.log('✅ 4/4 Verificando carga...');
  const countResult = await sql`SELECT count(*) as total FROM lojas;`;
  const horResult = await sql`SELECT count(*) as total FROM loja_horarios;`;
  console.log(`\n🎉 Migração concluída com sucesso!`);
  console.log(`   Total de lojas no banco: ${countResult[0]?.total} (horários: ${horResult[0]?.total})`);
  console.log(`   O endpoint /api/lojas e o front já estão configurados para consumir o Neon!`);
}

main().catch((err) => {
  console.error('❌ Falha na migração:', err);
  process.exit(1);
});
