#!/usr/bin/env node
/**
 * tools/migrate-to-neon.mjs
 *
 * Cria o schema no Neon Postgres e carrega todas as lojas e horários de public/lojas.json.
 *
 * Uso:
 *   node tools/migrate-to-neon.mjs [DATABASE_URL]
 *
 * Se DATABASE_URL não for informada via argumento, lê de process.env.DATABASE_URL ou process.env.POSTGRES_URL.
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
  console.log('👁️ 2/4 Criando views de compatibilidade (vw_lojas_json)...');
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
    FROM lojas l;
  `;

  // 3. Lê dados de public/lojas.json
  const jsonPath = path.join(rootDir, 'public', 'lojas.json');
  console.log(`📖 3/4 Lendo dados de ${jsonPath}...`);
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const lojasList = rawData.result || [];

  console.log(`💾 Inserindo ${lojasList.length} lojas no Neon...`);

  // Limpa para carga limpa idempotente
  await sql`TRUNCATE loja_horarios, lojas RESTART IDENTITY CASCADE;`;

  let totalLojas = 0;
  let totalHorarios = 0;

  for (const l of lojasList) {
    const nome = (l.nome_empresa || '').trim();
    const lat = parseFloat(l.Latitude);
    const lon = parseFloat(l.Longitude);
    if (isNaN(lat) || isNaN(lon)) continue;

    const slug = `${slugify(nome)}-${lat}-${lon}`;
    const cidade = (l.cidade || '').trim();
    const horarios = Array.isArray(l.horario_funcionamento) ? l.horario_funcionamento : [];
    const temHorario = horarios.some((d) => Array.isArray(d.hours) && d.hours.length > 0);

    const rows = await sql`
      INSERT INTO lojas (
        nome_empresa, modelo_negocio, tipo_atendimento, link_delivery, banner_url, tem_clube_cupons,
        logradouro, numero, bairro, cidade, estado, cep, endereco_completo,
        latitude, longitude, slug, cidade_slug, nome_slug, tem_horario
      ) VALUES (
        ${nome}, ${l.modelo_negocio || 'Outros'}, ${l.tipo_atendimento || null},
        ${l['link delivery'] || null}, ${l.banner || null}, ${Boolean(l.tem_clube_cupons)},
        ${l.logradouro || null}, ${l['número'] || l.numero || null}, ${l.bairro || null},
        ${cidade}, ${l.estado || 'ES'}, ${l.cep || null}, ${l['endereco completo'] || null},
        ${lat}, ${lon}, ${slug}, ${semAcento(cidade)}, ${semAcento(nome)}, ${temHorario}
      )
      RETURNING id;
    `;

    const lojaId = rows[0]?.id;
    if (!lojaId) continue;
    totalLojas++;

    for (const d of horarios) {
      const dow = parseInt(d.day_of_week, 10);
      const dayName = d.day || '';
      for (const h of d.hours || []) {
        if (!h.start || !h.end || h.start === h.end) continue;
        try {
          await sql`
            INSERT INTO loja_horarios (loja_id, day_of_week, day, start_time, end_time, tipo)
            VALUES (${lojaId}, ${dow}, ${dayName}, ${h.start}::time, ${h.end}::time, ${h.type || null});
          `;
          totalHorarios++;
        } catch {
          // Ignora horários inválidos
        }
      }
    }
  }

  // 4. Validação
  console.log('✅ 4/4 Verificando carga...');
  const countResult = await sql`SELECT count(*) as total FROM lojas;`;
  console.log(`\n🎉 Migração concluída com sucesso!`);
  console.log(`   Total de lojas no banco: ${countResult[0]?.total} (horários: ${totalHorarios})`);
  console.log(`   O endpoint /api/lojas e o front já estão configurados para consumir o Neon!`);
}

main().catch((err) => {
  console.error('❌ Falha na migração:', err);
  process.exit(1);
});
