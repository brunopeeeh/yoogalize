"""
Atualiza public/lojas.json com todos os clientes ativos do ES, direto do Databricks.

Fontes:
  - consumers.active_companies               -> clientes ativos (filtro ES)
  - consumers.customers                      -> endereço estruturado (logradouro, número, bairro, CEP)
  - customer_experience.company_detailed_metrics -> tipo de atendimento
  - mysql_yooga_delivery.stores              -> link do delivery e horário de funcionamento
  - consumers.installation_geolocation / stores.latitude -> coordenadas

Coordenadas, em ordem de prioridade:
  1. a do lojas.json atual, se a loja já existia com o mesmo endereço E alguma fonte do
     Databricks a confirma (<= 1,5 km). Se diverge de todas, o geocode do endereço decide;
     sem evidência (geocode falhou ou não bate com nenhuma), mantém a anterior;
  2. geolocalização e coordenada do delivery, quando concordam (< 1 km);
  3. se divergem, desempata com o Nominatim (endereço com bairro); sem consenso, fica a do delivery;
  4. se só uma existe, usa ela;
  5. sem nenhuma, geocodifica o endereço e por último o CEP (Nominatim, com cache local);
  6. ponto default (coordenada compartilhada por >= DEFAULT_MIN_LOJAS lojas) só é usado
     como último recurso, quando nada acima existir — não é geolocalização real
     (auditoria de 14/11/2026: 9 lojas amontoadas no default do Yooga em Cariacica,
     sendo de Colatina, Guarapari, Vitória etc.).

Requer o Databricks CLI autenticado: databricks auth login --profile yooga
Uso: python atualizar_lojas.py
"""
import json
import math
import os
import re
import subprocess
import time
import unicodedata
from collections import Counter
from datetime import datetime, timedelta

import requests

# ======= CONFIGURAÇÕES =======
DATABRICKS_PROFILE = "yooga"
WAREHOUSE_ID = "c6b0691159f45f15"
OUTPUT_FILE = "public/lojas.json"
GEOCODE_CACHE_FILE = "geocode_cache.json"
MAX_DIVERGENCIA_KM = 1.0
TOLERANCIA_ANTERIOR_KM = 1.5  # mesma tolerância do tools/validar-coordenadas.mjs
DEFAULT_MIN_LOJAS = 3         # coordenada repetida em >= N lojas = ponto default do sistema

SQL = """
with ac as (
  select * from yooga_delta_lake_curated.consumers.active_companies
  where address_state = 'ES'
),
st as (
  select installation_id, display_name, latitude, longitude, schedule_config
  from yooga_delta_lake_cleaned.mysql_yooga_delivery.stores
  where not coalesce(is_merge_deletion_detected, false)
  qualify row_number() over (partition by installation_id order by updated_at desc) = 1
)
select
  ac.installation_id,
  ac.company_name,
  ac.business_model,
  cdm.tipo_atendimento,
  trim(ac.address_city) as address_city,
  c.logradouro,
  c.address_number,
  c.bairro,
  c.address_zip_code,
  ac.address_street_name,
  ac.address_postal_code_cleaned,
  st.display_name as link_delivery,
  st.schedule_config,
  st.latitude as store_lat,
  st.longitude as store_lng,
  ig.lat as geo_lat,
  ig.lng as geo_lng,
  ig.full_address as geo_full_address
from ac
left join yooga_delta_lake_curated.customer_experience.company_detailed_metrics cdm on cdm.company_id = ac.company_id
left join yooga_delta_lake_curated.consumers.installations i on i.installation_id = ac.installation_id
left join yooga_delta_lake_curated.consumers.customers c on c.customer_id = i.customer_id
left join st on st.installation_id = ac.installation_id
left join yooga_delta_lake_curated.consumers.installation_geolocation ig on ig.installation_id = ac.installation_id
"""


# ======= DATABRICKS =======
def databricks_api(method, path, body=None):
    cmd = ["databricks", "api", method, path, "--profile", DATABRICKS_PROFILE]
    if body is not None:
        cmd += ["--json", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(f"Erro no Databricks CLI: {out.stderr.strip()}")
    return json.loads(out.stdout)


def run_sql(sql):
    """Executa SQL no warehouse e devolve uma lista de dicts."""
    r = databricks_api("post", "/api/2.0/sql/statements", {
        "warehouse_id": WAREHOUSE_ID, "statement": sql, "wait_timeout": "50s",
        "disposition": "INLINE", "format": "JSON_ARRAY", "on_wait_timeout": "CONTINUE",
    })
    while r["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(3)
        r = databricks_api("get", f"/api/2.0/sql/statements/{r['statement_id']}")
    if r["status"]["state"] != "SUCCEEDED":
        raise RuntimeError(f"Query falhou: {r['status']}")

    cols = [c["name"] for c in r["manifest"]["schema"]["columns"]]
    rows = r.get("result", {}).get("data_array") or []
    next_link = r.get("result", {}).get("next_chunk_internal_link")
    while next_link:
        chunk = databricks_api("get", next_link)
        rows += chunk.get("data_array") or []
        next_link = chunk.get("next_chunk_internal_link")
    return [dict(zip(cols, row)) for row in rows]


# ======= GEOLOCALIZAÇÃO =======
def to_coords(lat, lng):
    """Converte para float e descarta coordenadas fora do ES."""
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    if -21.4 < lat < -17.8 and -41.9 < lng < -39.6:
        return lat, lng
    return None


def dist_km(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


class Geocoder:
    """Nominatim com cache em disco e respeito ao limite de 1 req/s."""

    def __init__(self, cache_file):
        self.cache_file = cache_file
        self.cache = {}
        if os.path.exists(cache_file):
            with open(cache_file, encoding="utf-8") as f:
                self.cache = json.load(f)

    def save(self):
        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump(self.cache, f, ensure_ascii=False, indent=1)

    def geocode(self, query, require_street_level=False):
        key = f"{query}|{require_street_level}"
        if key in self.cache:
            return tuple(self.cache[key]) if self.cache[key] else None

        time.sleep(1.1)
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "br"},
                headers={"User-Agent": "DescubraYoogaGeocodeScript/2.0"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            print(f"     ⚠️ Erro de rede ao buscar '{query}': {e}")
            return None

        result = None
        if data:
            bad_types = ["city", "town", "village", "hamlet", "suburb", "county", "state", "country", "administrative"]
            if not (require_street_level and data[0].get("type") in bad_types):
                result = to_coords(data[0]["lat"], data[0]["lon"])
        self.cache[key] = result
        self._save_periodicamente()
        return result

    def reverse_city(self, lat, lng):
        """Descobre a cidade a partir das coordenadas."""
        key = f"reverse|{lat:.5f},{lng:.5f}"
        if key in self.cache:
            return self.cache[key]

        time.sleep(1.1)
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "zoom": 10},
                headers={"User-Agent": "DescubraYoogaGeocodeScript/2.0"},
                timeout=15,
            )
            resp.raise_for_status()
            endereco = resp.json().get("address", {})
        except requests.exceptions.RequestException as e:
            print(f"     ⚠️ Erro de rede no reverse geocode ({lat}, {lng}): {e}")
            return None

        cidade = endereco.get("city") or endereco.get("town") or endereco.get("municipality") or endereco.get("village")
        self.cache[key] = cidade
        self._save_periodicamente()
        return cidade

    def _save_periodicamente(self):
        self.novas_consultas = getattr(self, "novas_consultas", 0) + 1
        if self.novas_consultas % 25 == 0:
            self.save()


def chave_loja(loja):
    """Identifica a loja + endereço, para reaproveitar coordenadas de execuções anteriores."""
    identificador = loja.get("link delivery") or (loja.get("nome_empresa") or "").lower().strip()
    return f"{identificador}|{re.sub(r'\D', '', loja.get('cep') or '')}|{(loja.get('número') or '').strip()}"


def carregar_coordenadas_anteriores(arquivo):
    if not os.path.exists(arquivo):
        return {}
    with open(arquivo, encoding="utf-8") as f:
        lojas = json.load(f).get("result", [])
    return {chave_loja(l): to_coords(l.get("Latitude"), l.get("Longitude")) for l in lojas}


def geocode_endereco(loja, geocoder, com_bairro=True):
    if not (loja["logradouro"] and loja["cidade"]):
        return None
    if com_bairro and not loja["bairro"]:
        return None
    partes = [loja["logradouro"], loja["número"], loja["bairro"] if com_bairro else None, loja["cidade"], "ES, Brasil"]
    return geocoder.geocode(", ".join(p for p in partes if p), require_street_level=True)


def detectar_defaults(lojas):
    """Coordenadas compartilhadas por muitas lojas nao sao geolocalizacao real.

    O sistema Yooga grava um ponto default quando o lojista nunca configurou a
    localizacao, e o geocoder pode cair no centroid da cidade. Detectadas pela
    repeticao exata da coordenada entre instalacoes distintas.
    """
    conta = Counter()
    for l in lojas:
        for c in (to_coords(l["geo_lat"], l["geo_lng"]), to_coords(l["store_lat"], l["store_lng"])):
            if c:
                conta[(round(c[0], 7), round(c[1], 7))] += 1
    return {c for c, n in conta.items() if n >= DEFAULT_MIN_LOJAS}


def escolher_coordenadas(loja, geocoder, anteriores, defaults=()):
    """Retorna (lat, lng, origem) ou None."""
    geo = to_coords(loja["geo_lat"], loja["geo_lng"])
    store = to_coords(loja["store_lat"], loja["store_lng"])

    # Ponto default compartilhado nao serve como coordenada real: fica de lado
    # e so volta como ultimo recurso, se nenhuma outra fonte existir.
    fallback_default = None
    if geo and (round(geo[0], 7), round(geo[1], 7)) in defaults:
        fallback_default = fallback_default or geo
        geo = None
    if store and (round(store[0], 7), round(store[1], 7)) in defaults:
        fallback_default = fallback_default or store
        store = None

    fontes = [c for c in (geo, store) if c]

    # A coordenada anterior só é reaproveitada se alguma fonte a confirmar
    anterior = anteriores.get(chave_loja(loja))
    if anterior:
        if not fontes or any(dist_km(anterior, c) <= TOLERANCIA_ANTERIOR_KM for c in fontes):
            return (*anterior, "anterior")
        # Diverge de todas as fontes do Databricks: o endereço decide.
        # Sem geocode (ou sem consenso) não há evidência para alterar, então mantém a anterior.
        nominatim = geocode_endereco(loja, geocoder)
        if nominatim:
            melhor = min([anterior, *fontes], key=lambda c: dist_km(c, nominatim))
            if melhor is not anterior and dist_km(melhor, nominatim) <= TOLERANCIA_ANTERIOR_KM:
                return (*melhor, "databricks+nominatim")
        return (*anterior, "anterior")

    if geo and store:
        if dist_km(geo, store) <= MAX_DIVERGENCIA_KM:
            return (*geo, "databricks")
        # Fontes divergem: desempata pelo endereço; sem consenso, fica com a do lojista
        nominatim = geocode_endereco(loja, geocoder)
        if nominatim and dist_km(geo, nominatim) < dist_km(store, nominatim) and dist_km(geo, nominatim) <= MAX_DIVERGENCIA_KM:
            return (*geo, "databricks+nominatim")
        return (*store, "databricks")

    if geo or store:
        return (*(geo or store), "databricks")

    # Sem coordenada no Databricks: geocodifica o endereço (com bairro, depois sem) e por último o CEP
    nominatim = geocode_endereco(loja, geocoder) or geocode_endereco(loja, geocoder, com_bairro=False)
    if nominatim:
        return (*nominatim, "nominatim")

    cep = re.sub(r"\D", "", loja["cep"] or "")
    if len(cep) == 8:
        por_cep = geocoder.geocode(f"{cep[:5]}-{cep[5:]}, Brasil")
        if por_cep:
            return (*por_cep, "nominatim-cep")

    # Ultimo recurso: melhor o ponto default do que descartar a loja do catalogo.
    if fallback_default:
        return (*fallback_default, "default-yooga")
    return None


# ======= NORMALIZAÇÃO =======
def sem_acento(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def municipios_es():
    """Lista oficial de municípios do ES (IBGE), indexada pelo nome sem acento."""
    resp = requests.get("https://servicodados.ibge.gov.br/api/v1/localidades/estados/32/municipios", timeout=30)
    resp.raise_for_status()
    return {sem_acento(m["nome"]): m["nome"] for m in resp.json()}


def limpar_cidade(cidade):
    # Remove sobras como ", Vila Velha" ou "Vitória - ES"
    cidade = re.sub(r"\s*-\s*ES$", "", (cidade or "").strip(), flags=re.IGNORECASE)
    return cidade.strip(" ,-")


def cidade_do_full_address(full_address):
    # Formato: "Rua X, 10, Bairro, Cidade, Es, Brasil 29000000"
    partes = [p.strip() for p in (full_address or "").split(",")]
    if len(partes) >= 3 and partes[-2].lower() == "es":
        return partes[-3]
    return None


def normalizar_tipo_atendimento(tipo):
    t = sem_acento(tipo or "")
    presencial = "presencial" in t
    delivery = "delivery" in t or "ifood" in t
    if presencial and delivery:
        return "Presencial e Delivery"
    if presencial:
        return "Somente Presencial"
    if delivery:
        return "Somente Delivery"
    return None


def formatar_cep(cep):
    digitos = re.sub(r"\D", "", cep or "")
    return f"{digitos[:5]}-{digitos[5:]}" if len(digitos) == 8 else (cep or "")


# ======= HORÁRIO DE FUNCIONAMENTO =======
DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
TIPOS = {"IMEDIATE": "Delivery", "BOTH": "Delivery e Agendamento", "SCHEDULED": "Agendamento"}


def ajustar_horario(valor):
    """Extrai o horário de um timestamp UTC e converte para UTC-3."""
    if not valor or not isinstance(valor, str):
        return None
    match = re.search(r"(\d{2}:\d{2}:\d{2})", valor)
    if not match:
        return valor
    t = datetime.strptime(match.group(1), "%H:%M:%S") - timedelta(hours=3)
    return t.strftime("%H:%M:%S")


def montar_horario(schedule_config):
    try:
        dados = json.loads(schedule_config) if schedule_config else []
    except json.JSONDecodeError:
        dados = []
    existentes = {d["day_of_week"]: d for d in dados if isinstance(d, dict) and "day_of_week" in d}

    resultado = []
    for i, nome in enumerate(DIAS_SEMANA):
        horas = []
        for h in existentes.get(i, {}).get("hours", []) or []:
            horas.append({
                "start": ajustar_horario(h.get("start")),
                "end": ajustar_horario(h.get("end")),
                "type": TIPOS.get(str(h.get("type", "")).upper(), h.get("type")),
            })
        resultado.append({"day_of_week": i, "day": nome, "hours": horas})
    return resultado


# ======= EXECUÇÃO PRINCIPAL =======
def main():
    print("📡 Buscando clientes ativos do ES no Databricks...")
    lojas = run_sql(SQL)
    print(f"   {len(lojas)} clientes ativos encontrados.")

    municipios = municipios_es()
    geocoder = Geocoder(GEOCODE_CACHE_FILE)
    anteriores = carregar_coordenadas_anteriores(OUTPUT_FILE)
    defaults = detectar_defaults(lojas)
    if defaults:
        print(f"   {len(defaults)} ponto(s) default detectado(s) (coordenada compartilhada por >= {DEFAULT_MIN_LOJAS} lojas).")

    resultado, sem_coordenadas, fora_do_es, origens = [], [], [], Counter()
    try:
        for i, l in enumerate(lojas, 1):
            # Cidade só é aceita se for um município do ES; senão sai das coordenadas mais abaixo
            cidade = municipios.get(sem_acento(limpar_cidade(l["address_city"])))                 or municipios.get(sem_acento(limpar_cidade(cidade_do_full_address(l["geo_full_address"]))))                 or ""

            logradouro, numero, bairro = l["logradouro"], l["address_number"], l["bairro"]
            if not logradouro and l["address_street_name"]:
                logradouro = l["address_street_name"]
            cep = formatar_cep(l["address_zip_code"] or l["address_postal_code_cleaned"])

            loja = {
                "nome_empresa": (l["company_name"] or "").strip(),
                "modelo_negocio": (l["business_model"] or "Outros").strip(),
                "tipo_atendimento": normalizar_tipo_atendimento(l["tipo_atendimento"]),
                "logradouro": logradouro,
                "número": numero,
                "bairro": bairro,
                "cidade": cidade,
                "estado": "ES",
                "cep": cep,
                "link delivery": l["link_delivery"] or None,
            }
            loja["horario_funcionamento"] = montar_horario(l["schedule_config"])

            print(f"  🔍 ({i}/{len(lojas)}) {loja['nome_empresa']}", end="\r")
            coords = escolher_coordenadas({**l, **loja}, geocoder, anteriores, defaults)
            if not coords:
                sem_coordenadas.append(loja["nome_empresa"])
                continue
            loja["Latitude"], loja["Longitude"], origem = round(coords[0], 7), round(coords[1], 7), coords[2]
            if not cidade:
                cidade = municipios.get(sem_acento(geocoder.reverse_city(loja["Latitude"], loja["Longitude"]) or ""))
                if not cidade:
                    fora_do_es.append(loja["nome_empresa"])
                    continue
                loja["cidade"] = cidade

            rua = f"{logradouro}, {numero}" if numero else (logradouro or "")
            loja["endereco completo"] = f"{rua} - {bairro or ''}, {cidade} - ES, {cep}".strip(" ,-")
            origens[origem] += 1
            resultado.append(loja)
    finally:
        geocoder.save()

    resultado.sort(key=lambda x: (x["cidade"], x["nome_empresa"]))
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"result": resultado}, f, ensure_ascii=False, indent=1)

    print(f"\n\n💾 {len(resultado)} lojas salvas em {OUTPUT_FILE}")
    print(f"   Origem das coordenadas: {dict(origens)}")
    if sem_coordenadas:
        print(f"⚠️ {len(sem_coordenadas)} lojas sem coordenadas (ignoradas): {', '.join(sem_coordenadas)}")
    if fora_do_es:
        print(f"⚠️ {len(fora_do_es)} lojas com coordenadas fora do ES (ignoradas): {', '.join(fora_do_es)}")


if __name__ == "__main__":
    main()
