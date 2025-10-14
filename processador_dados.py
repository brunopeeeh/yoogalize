import pandas as pd
import requests
import time
import re
import json

# ======= CONFIGURAÇÕES =======
INPUT_FILE = "Base cliente Vila Velha.xlsx"
# O arquivo de saída é o que a aplicação consome diretamente
OUTPUT_FILE = "public/lojas.json"

# ======= FUNÇÕES AUXILIARES (do validacao.py) =======
def get_coords_from_address(address):
    """Converte endereço em latitude e longitude via Nominatim."""
    if not isinstance(address, str) or not address.strip():
        return None, None

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": address,
        "format": "json",
        "addressdetails": 1,
        "limit": 1
    }
    headers = {"User-Agent": "YoogaGeocodeScript/1.2"} # Versão atualizada

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        resp.raise_for_status() # Lança um erro para status HTTP 4xx/5xx

        data = resp.json()
        if not data:
            return None, None

        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        return lat, lon

    except requests.exceptions.RequestException as e:
        print(f"⚠️  Erro de rede ao buscar '{address}': {e}")
        return None, None
    except Exception as e:
        print(f"⚠️  Erro inesperado ao buscar '{address}': {e}")
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

    # Garante que as colunas de coordenadas existam
    if "Latitude" not in df.columns:
        df["Latitude"] = None
    if "Longitude" not in df.columns:
        df["Longitude"] = None

    # --- 1. Lógica de Validação (Geocoding) ---
    for i, row in df.iterrows():
        # A coluna 10 (índice) é a "endereço completo"
        endereco = row.get("endereço completo", df.iloc[i, 10])

        # Verifica se as coordenadas já existem e são válidas
        lat_existente = pd.to_numeric(row.get("Latitude"), errors='coerce')
        lon_existente = pd.to_numeric(row.get("Longitude"), errors='coerce')

        if pd.notna(lat_existente) and pd.notna(lon_existente):
            print(f"  ✅ ({i+1}/{len(df)}) Coordenadas já existem.")
            continue

        print(f"  🔍 ({i+1}/{len(df)}) Buscando coordenadas para: {endereco}")

        lat, lon = get_coords_from_address(endereco)

        # Se não encontrou, tenta via CEP
        if lat is None or lon is None:
            lat, lon = get_coords_from_cep(str(endereco))
            if lat and lon:
                print("     ✅ Coordenadas encontradas via CEP!")
            else:
                print("     ⚠️ Endereço e CEP não encontrados.")

        df.at[i, "Latitude"] = lat
        df.at[i, "Longitude"] = lon
        time.sleep(1.1)  # Aumenta o delay para garantir o respeito ao rate limit da API

    # --- 2. Lógica de Conversão ---
    print(f"🔄 Convertendo aba '{sheet_name}' para o formato JSON...")
    
    # Remove linhas onde as coordenadas não puderam ser encontradas
    df_valid = df.dropna(subset=['Latitude', 'Longitude'])
    
    # Converte o DataFrame limpo para uma lista de dicionários
    registros = df_valid.fillna("").to_dict(orient="records")
    
    # Adiciona ao dicionário final que será salvo como JSON
    dados_finais_json[sheet_name] = registros

# --- 3. Salvando o arquivo JSON final ---
print(f"\n💾 Salvando arquivo JSON final em: {OUTPUT_FILE}")
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(dados_finais_json, f, ensure_ascii=False, indent=2)

print(f"\n✅ Processo concluído com sucesso!")
