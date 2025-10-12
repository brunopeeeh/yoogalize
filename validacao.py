import pandas as pd
import requests
import time
import re

# ======= CONFIGURAÇÕES =======
INPUT_FILE = "Base cliente Vila Velha.xlsx"
OUTPUT_FILE = "Base cliente Vila Velha_com_coordenadas.xlsx"

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
    headers = {"User-Agent": "YoogaGeocodeScript/1.1"}

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Erro {resp.status_code} em '{address}'")
            return None, None

        data = resp.json()
        if not data:
            return None, None

        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        return lat, lon

    except Exception as e:
        print(f"⚠️ Erro ao buscar '{address}': {e}")
        return None, None


def get_coords_from_cep(text):
    """Procura CEP no texto e tenta buscar localização pelo CEP."""
    cep_pattern = re.search(r"\b\d{5}-?\d{3}\b", text or "")
    if not cep_pattern:
        return None, None
    cep = cep_pattern.group().replace("-", "")
    return get_coords_from_address(f"CEP {cep}, Brasil")


# ======= EXECUÇÃO =======
print("📖 Lendo planilhas...")
sheets = pd.read_excel(INPUT_FILE, sheet_name=None)  # Lê todas as abas
result_sheets = {}

for sheet_name, df in sheets.items():
    print(f"\n📍 Processando aba: {sheet_name}")
    
    # Garante colunas de saída
    if "Latitude" not in df.columns:
        df["Latitude"] = None
    if "Longitude" not in df.columns:
        df["Longitude"] = None

    for i, endereco in enumerate(df.iloc[:, 10]):  # Coluna K
        print(f"  🔍 ({i+1}/{len(df)}) Endereço: {endereco}")
        
        lat, lon = get_coords_from_address(endereco)

        # Se não encontrou, tenta via CEP
        if lat is None or lon is None:
            lat, lon = get_coords_from_cep(endereco)
            if lat and lon:
                print("     ✅ Coordenadas encontradas via CEP!")
            else:
                print("     ⚠️ Endereço e CEP não encontrados.")
        
        df.at[i, "Latitude"] = lat
        df.at[i, "Longitude"] = lon
        time.sleep(1)  # Evita bloqueio (1 req/s)

    result_sheets[sheet_name] = df

# Salva todas as abas novamente
with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
    for sheet_name, df in result_sheets.items():
        df.to_excel(writer, sheet_name=sheet_name, index=False)

print(f"\n✅ Processo concluído com sucesso!")
print(f"📁 Arquivo salvo como: {OUTPUT_FILE}")
