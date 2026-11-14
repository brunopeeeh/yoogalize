#!/usr/bin/env python3
"""
Carrega public/lojas.json no PostgreSQL (base bruno_db do Raspberry Pi).

Sem dependencias externas: gera CSVs e usa `psql` com \\copy.

Uso:
    python3 tools/load-lojas.py --json public/lojas.json
    python3 tools/load-lojas.py --json public/lojas.json --truncate
"""
import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile
import unicodedata

# ----------------------------------------------------------------------------- args
ap = argparse.ArgumentParser()
ap.add_argument("--json", default="public/lojas.json")
ap.add_argument("--psql", default="psql")
ap.add_argument("--db", default="bruno_db")
ap.add_argument("--user", default="postgres")
ap.add_argument("--host", default="127.0.0.1")
ap.add_argument("--port", default="5432")
ap.add_argument("--truncate", action="store_true")
ap.add_argument("--patch", default="", help="SQL de patches de catalogo (remocoes/links quebrados)")
args = ap.parse_args()

# colunas de `lojas` (mesma ordem do \copy)
COLS_LOJAS = [
    "nome_empresa", "modelo_negocio", "tipo_atendimento", "link_delivery",
    "logradouro", "numero", "bairro", "cidade", "estado", "cep",
    "endereco_completo", "latitude", "longitude",
    "slug", "cidade_slug", "nome_slug", "tem_horario",
]


# ----------------------------------------------------------------------------- helpers
def sem_acento(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()


def slugify(s):
    """Mesma funcao do front (src/lib/normalizers.ts) -> id de favorito."""
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = "".join(c if c.isalnum() else "-" for c in s)
    while "--" in s:
        s = s.replace("--", "-")
    return s.strip("-")


def hhmm_to_time(v):
    """'HH:MM:SS' -> 'HH:MM:SS'. None se invalido."""
    if not v or not isinstance(v, str):
        return None
    parts = v.split(":")
    if len(parts) < 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
        s = int(parts[2]) if len(parts) > 2 else 0
    except ValueError:
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59 and 0 <= s <= 59):
        return None
    return f"{h:02d}:{m:02d}:{s:02d}"


def run_psql(sql):
    cmd = [
        args.psql, "-X", "-v", "ON_ERROR_STOP=1",
        "-h", args.host, "-p", args.port,
        "-U", args.user, "-d", args.db,
    ]
    p = subprocess.run(cmd, input=sql, capture_output=True, text=True, encoding="utf-8")
    if p.returncode != 0:
        sys.stderr.write(p.stdout or "")
        sys.stderr.write(p.stderr or "")
        raise SystemExit(f"psql falhou (exit {p.returncode})")
    return p.stdout


# ----------------------------------------------------------------------------- main
def main():
    if not os.path.exists(args.json):
        raise SystemExit(f"Arquivo nao encontrado: {args.json}")

    with open(args.json, encoding="utf-8") as f:
        raw = json.load(f)
    lojas = raw["result"] if isinstance(raw, dict) and "result" in raw else raw
    print(f"Origem: {args.json}  ({len(lojas)} lojas)")

    linhas_lojas = []
    linhas_hor = []
    sem_coordenada = 0
    n_degeneradas = 0

    for l in lojas:
        nome = (l.get("nome_empresa") or "").strip()
        lat, lon = l.get("Latitude"), l.get("Longitude")
        if lat is None or lon is None:
            sem_coordenada += 1
            continue
        lat, lon = float(lat), float(lon)

        slug = f"{slugify(nome)}-{lat}-{lon}"
        cidade = (l.get("cidade") or "").strip()

        faixas = []
        degeneradas = 0
        for d in (l.get("horario_funcionamento") or []):
            for h in (d.get("hours") or []):
                ini = hhmm_to_time(h.get("start"))
                fim = hhmm_to_time(h.get("end"))
                if ini is None or fim is None:
                    continue          # "Data inválida" ou formato invalido
                if ini == fim:
                    degeneradas += 1  # placeholder "horario nao informado"
                    continue
                faixas.append((slug, d.get("day_of_week"), d.get("day") or "", ini, fim, h.get("type")))
        linhas_hor.extend(faixas)
        n_degeneradas += degeneradas

        linhas_lojas.append([
            nome,
            (l.get("modelo_negocio") or "Outros").strip(),
            (l.get("tipo_atendimento") or None),
            (l.get("link delivery") or None),
            (l.get("logradouro") or None),
            (l.get("número") or l.get("numero") or None),
            (l.get("bairro") or None),
            cidade,
            (l.get("estado") or "ES").strip()[:2],
            (l.get("cep") or None),
            (l.get("endereco completo") or None),
            lat, lon,
            slug,
            sem_acento(cidade),
            sem_acento(nome),
            1 if faixas else 0,
        ])

    tmpdir = tempfile.mkdtemp(prefix="yoogalize-")
    lojas_csv = os.path.join(tmpdir, "lojas.csv")
    hor_csv = os.path.join(tmpdir, "loja_horarios.csv")

    with open(lojas_csv, "w", newline="", encoding="utf-8") as f:
        csv.writer(f, quoting=csv.QUOTE_MINIMAL, lineterminator="\n").writerows(linhas_lojas)
    with open(hor_csv, "w", newline="", encoding="utf-8") as f:
        csv.writer(f, quoting=csv.QUOTE_MINIMAL, lineterminator="\n").writerows(linhas_hor)

    print(f"lojas:   {len(linhas_lojas)} linhas (ignoradas {sem_coordenada} sem coordenada)")
    print(f"horarios:{len(linhas_hor)} faixas (ignoradas {n_degeneradas} degeneradas start==end)")

    # ---------------------------------------------------------------- carga
    if args.truncate:
        print("TRUNCATE...")
        run_psql("TRUNCATE loja_horarios, lojas RESTART IDENTITY CASCADE;")

    print("Criando tabela temporaria...")
    run_psql("""
        DROP TABLE IF EXISTS loja_horarios_tmp;
        CREATE TABLE loja_horarios_tmp (
            slug text, day_of_week smallint, day text,
            start_time time, end_time time, tipo text
        );
    """)

    print("\\copy lojas...")
    cols = ", ".join(COLS_LOJAS)
    run_psql(
        f"\\copy lojas ({cols}) FROM '{lojas_csv}' "
        "WITH (FORMAT csv, HEADER false, NULL '')"
    )

    print("\\copy loja_horarios_tmp...")
    run_psql(
        f"\\copy loja_horarios_tmp (slug,day_of_week,day,start_time,end_time,tipo) FROM '{hor_csv}' "
        "WITH (FORMAT csv, HEADER false, NULL '')"
    )

    print("Vinculando horarios...")
    # o filtro start_time <> end_time evita que uma faixa degenerada
    # ("horario nao informado") derrube a carga inteira
    run_psql("""
        INSERT INTO loja_horarios (loja_id, day_of_week, day, start_time, end_time, tipo)
        SELECT l.id, t.day_of_week, t.day, t.start_time, t.end_time, t.tipo
        FROM loja_horarios_tmp t
        JOIN lojas l ON l.slug = t.slug
        WHERE t.start_time IS NOT NULL
          AND t.end_time   IS NOT NULL
          AND t.start_time <> t.end_time;
        DROP TABLE loja_horarios_tmp;
    """)

    print("Calculando status de horario...")
    run_psql("""
        UPDATE lojas l SET
            status_horario = fn_loja_status_agora(l.id),
            abre_agora = CASE
                WHEN fn_loja_status_agora(l.id) = 'desconhecido' THEN NULL
                ELSE fn_loja_status_agora(l.id) = 'aberto'
            END;
    """)

    # patches de catalogo (remove lojas que sairam, marca links quebrados)
    candidatos = [
        args.patch,
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "patches-catalogo.sql"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sql", "patches-catalogo.sql"),
    ]
    patch = next((os.path.normpath(p) for p in candidatos if p and os.path.exists(p)), None)
    if patch:
        print(f"Aplicando patches de catalogo ({patch})...")
        run_psql(open(patch, encoding="utf-8").read())
    else:
        print("(aviso: patches-catalogo.sql nao encontrado - removidas/links quebrados nao aplicados)")

    # ---------------------------------------------------------------- resumo
    print("\n--- Resultado ---")
    print(run_psql("""
        SELECT 'lojas' AS metrica, count(*)::text AS valor FROM lojas
        UNION ALL SELECT 'loja_horarios', count(*)::text FROM loja_horarios
        UNION ALL SELECT 'com_horario', count(*)::text FROM lojas WHERE tem_horario
        UNION ALL SELECT 'sem_horario', count(*)::text FROM lojas WHERE NOT tem_horario
        UNION ALL SELECT 'com_link_delivery', count(*)::text FROM lojas WHERE link_delivery IS NOT NULL
        UNION ALL SELECT 'cidades', count(DISTINCT cidade)::text FROM lojas
        UNION ALL SELECT 'segmentos', count(DISTINCT modelo_negocio)::text FROM lojas
        ORDER BY 1;
    """))
    print(run_psql("SELECT status_horario, count(*) FROM lojas GROUP BY 1 ORDER BY 2 DESC;"))
    print("OK.")


if __name__ == "__main__":
    main()
