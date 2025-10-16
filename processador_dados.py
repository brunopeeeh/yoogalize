import pandas as pd
import requests
import time
import re
import json

# ======= CONFIGURAÇÕES =======
INPUT_FILE = "Base cliente Vila Velha.xlsx"
OUTPUT_FILE = "public/lojas.json"

# ======= FUNÇÕES AUXILIARES =======
def get_coords_from_address(address):
    """Converte endereço em latitude e longitude via Nominatim."""
    if not isinstance(address, str) or not address.strip():
        return None, None

    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "addressdetails": 1, "limit": 1}
    headers = {"User-Agent": "YoogaGeocodeScript/1.5"}

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Erro de rede ao buscar '{address}': {e}")
        return None, None
    except Exception as e:
        print(f"⚠️ Erro inesperado ao buscar '{address}': {e}")
        return None, None


def get_coords_from_cep(text):
    """Procura CEP no texto e tenta buscar localização pelo CEP."""
    if not isinstance(text, str):
        return None, None
    cep_pattern = re.search(r"\b\d{5}-?\d{3}\b", text)
    if not cep_pattern:
        return None, None
    cep = cep_pattern.group().replace("-", "")
    print(f"     ℹ️ Tentando via CEP: {cep}")
    return get_coords_from_address(f"CEP {cep}, Brasil")


def traduzir_type(tipo):
    """Traduz o tipo de atendimento para texto legível."""
    mapa = {
        "IMEDIATE": "Delivery",
        "BOTH": "Delivery e Agendamento",
        "SCHEDULED": "Agendamento"
    }
    return mapa.get(tipo.upper(), tipo)


def validar_horario_funcionamento(dados):
    """Garante que todos os dias da semana existam e que os tipos estejam traduzidos."""
    dias_semana = [
        {"day_of_week": 0, "day": "Domingo"},
        {"day_of_week": 1, "day": "Segunda-feira"},
        {"day_of_week": 2, "day": "Terça-feira"},
        {"day_of_week": 3, "day": "Quarta-feira"},
        {"day_of_week": 4, "day": "Quinta-feira"},
        {"day_of_week": 5, "day": "Sexta-feira"},
        {"day_of_week": 6, "day": "Sábado"},
    ]

    # Cria um mapa rápido de dias já presentes
    mapa_existentes = {d["day_of_week"]: d for d in dados if "day_of_week" in d}

    resultado = []
    for d in dias_semana:
        dia_dados = mapa_existentes.get(d["day_of_week"], {"hours": []})
        dia_dados["day_of_week"] = d["day_of_week"]
        dia_dados["day"] = d["day"]

        # Traduz o tipo dentro dos hours, se houver
        for h in dia_dados.get("hours", []):
            if "type" in h:
                h["type"] = traduzir_type(h["type"])

        resultado.append(dia_dados)

    return resultado


# ======= EXECUÇÃO =======
print(f"📖 Lendo planilha de entrada: {INPUT_FILE}")
try:
    sheets = pd.read_excel(INPUT_FILE, sheet_name=None)
except FileNotFoundError:
    print(f"❌ ERRO: O arquivo de entrada '{INPUT_FILE}' não foi encontrado.")
    exit()

dados_finais_json = {}

for sheet_name, df in sheets.items():
    print(f"\n📍 Processando aba: {sheet_name}")

    # Garante colunas de coordenadas
    if "Latitude" not in df.columns:
        df["Latitude"] = None
    if "Longitude" not in df.columns:
        df["Longitude"] = None

    # --- 1. Geocoding ---
    for i, row in df.iterrows():
        endereco = row.get("endereço completo", df.iloc[i, 10])
        lat_existente = pd.to_numeric(row.get("Latitude"), errors='coerce')
        lon_existente = pd.to_numeric(row.get("Longitude"), errors='coerce')

        if pd.notna(lat_existente) and pd.notna(lon_existente):
            continue

        print(f"  🔍 ({i+1}/{len(df)}) Buscando coordenadas para: {endereco}")
        lat, lon = get_coords_from_address(endereco)
        if lat is None or lon is None:
            lat, lon = get_coords_from_cep(str(endereco))
        df.at[i, "Latitude"] = lat
        df.at[i, "Longitude"] = lon
        time.sleep(1.1)

    # --- 2. Converte e valida horario_funcionamento ---
    if "horario_funcionamento" in df.columns:
        def parse_horario(valor):
            if isinstance(valor, str) and valor.strip():
                try:
                    dados = json.loads(valor)
                    return validar_horario_funcionamento(dados)
                except json.JSONDecodeError:
                    print(f"⚠️ Erro ao decodificar horário: {valor}")
                    return validar_horario_funcionamento([])
            return validar_horario_funcionamento([])
        df["horario_funcionamento"] = df["horario_funcionamento"].apply(parse_horario)
    else:
        df["horario_funcionamento"] = [validar_horario_funcionamento([]) for _ in range(len(df))]

    # --- 3. Remove linhas sem coordenadas ---
    df_valid = df.dropna(subset=["Latitude", "Longitude"])

    # --- 4. Converte para lista de dicionários ---
    registros = df_valid.fillna("").to_dict(orient="records")

    dados_finais_json[sheet_name] = registros

# --- 5. Salva o JSON final ---
print(f"\n💾 Salvando arquivo JSON final em: {OUTPUT_FILE}")
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(dados_finais_json, f, ensure_ascii=False, indent=2)

print("\n✅ Processo concluído com sucesso!")
