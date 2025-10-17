import pandas as pd
import requests
import time
import re
import json
from datetime import datetime, timedelta

# ======= CONFIGURAÇÕES =======
INPUT_FILE = "Base cliente Vila Velha.xlsx"
OUTPUT_FILE = "public/lojas.json"

# ======= FUNÇÕES AUXILIARES =======
def get_coords_from_address(address, require_street_level=False):
    """Converte endereço em latitude e longitude via Nominatim, com validação de precisão."""
    if not isinstance(address, str) or not address.strip():
        return None, None

    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "addressdetails": 1, "limit": 1}
    headers = {"User-Agent": "YoogaGeocodeScript/1.6"} # Versão incrementada

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None

        result = data[0]

        # Se uma correspondência a nível de rua é necessária, verifica o tipo de resultado.
        if require_street_level:
            bad_types = ['city', 'town', 'village', 'hamlet', 'suburb', 'county', 'state', 'country', 'administrative']
            if result.get('type') in bad_types:
                print(f"     Resultado muito genérico para '{address}' (tipo: {result.get('type')}). Rejeitando.")
                return None, None

        return float(result["lat"]), float(result["lon"])
    except requests.exceptions.RequestException as e:
        print(f"Erro de rede ao buscar '{address}': {e}")
        return None, None
    except Exception as e:
        print(f"Erro inesperado ao buscar '{address}': {e}")
        return None, None

def traduzir_type(tipo):
    """Traduz o tipo de atendimento para texto legível."""
    mapa = {
        "IMEDIATE": "Delivery",
        "BOTH": "Delivery e Agendamento",
        "SCHEDULED": "Agendamento"
    }
    return mapa.get(tipo.upper(), tipo)

def extract_and_adjust_time(dt_string):
    """Extrai HH:MM:SS de uma string de data/hora ISO, ajusta para UTC-3 e retorna como string."""
    if not isinstance(dt_string, str) or 'inválida' in dt_string:
        return None
    try:
        dt_obj_utc = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        fuso_horario_utc_menos_3 = timedelta(hours=-3)
        dt_obj_adjusted = dt_obj_utc + fuso_horario_utc_menos_3
        return dt_obj_adjusted.strftime('%H:%M:%S')
    except (ValueError, TypeError):
        return None

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

    mapa_existentes = {d["day_of_week"]: d for d in dados if "day_of_week" in d}

    resultado = []
    for d in dias_semana:
        dia_dados = mapa_existentes.get(d["day_of_week"], {"hours": []})
        dia_dados["day_of_week"] = d["day_of_week"]
        dia_dados["day"] = d["day"]

        for h in dia_dados.get("hours", []):
            if "type" in h:
                h["type"] = traduzir_type(h["type"])

        resultado.append(dia_dados)

    return resultado


# ======= EXECUÇÃO =======
print(f"Lendo planilha de entrada: {INPUT_FILE}")
try:
    sheets = pd.read_excel(INPUT_FILE, sheet_name=None)
except FileNotFoundError:
    print(f"ERRO: O arquivo de entrada '{INPUT_FILE}' não foi encontrado.")
    exit()

dados_finais_json = {}

for sheet_name, df in sheets.items():
    print(f"\nProcessando aba: {sheet_name}")

    if "Latitude" not in df.columns: df["Latitude"] = None
    if "Longitude" not in df.columns: df["Longitude"] = None

    for i, row in df.iterrows():
        lat_existente = pd.to_numeric(row.get("Latitude"), errors='coerce')
        lon_existente = pd.to_numeric(row.get("Longitude"), errors='coerce')

        if pd.notna(lat_existente) and pd.notna(lon_existente):
            continue

        endereco = row.get("endereço completo", "")
        print(f"  ({i+1}/{len(df)}) Buscando coordenadas para: {endereco}")
        
        # 1. Tenta buscar pelo endereço completo, exigindo resultado a nível de rua
        lat, lon = get_coords_from_address(endereco, require_street_level=True)

        # 2. Se falhar, tenta uma busca mais específica com CEP, cidade e estado
        if lat is None or lon is None:
            cep = row.get('cep', '')
            cidade = row.get('cidade', '')
            estado = row.get('estado', '')
            if cep and cidade and estado:
                cep_query = f"{cep}, {cidade}, {estado}, Brasil"
                print(f"     Tentando via CEP: {cep_query}")
                lat, lon = get_coords_from_address(cep_query)

        df.at[i, "Latitude"] = lat
        df.at[i, "Longitude"] = lon
        time.sleep(1.1)

    if "horario_funcionamento" in df.columns:
        def parse_horario(valor):
            if isinstance(valor, str) and valor.strip():
                try:
                    dados = json.loads(valor)
                    for day_schedule in dados:
                        if 'hours' in day_schedule and isinstance(day_schedule['hours'], list):
                            cleaned_hours = []
                            for hour_range in day_schedule['hours']:
                                start_time = extract_and_adjust_time(hour_range.get('start'))
                                end_time = extract_and_adjust_time(hour_range.get('end'))
                                
                                if start_time and end_time:
                                    hour_range['start'] = start_time
                                    hour_range['end'] = end_time
                                    cleaned_hours.append(hour_range)
                            day_schedule['hours'] = cleaned_hours
                    
                    return validar_horario_funcionamento(dados)
                except json.JSONDecodeError:
                    print(f"Erro ao decodificar horário: {valor}")
                    return validar_horario_funcionamento([])
            return validar_horario_funcionamento([])
        df["horario_funcionamento"] = df["horario_funcionamento"].apply(parse_horario)
    else:
        df["horario_funcionamento"] = [validar_horario_funcionamento([]) for _ in range(len(df))]

    df_valid = df.dropna(subset=["Latitude", "Longitude"])
    registros = df_valid.fillna("").to_dict(orient="records")
    dados_finais_json[sheet_name] = registros

print(f"\nSalvando arquivo JSON final em: {OUTPUT_FILE}")
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(dados_finais_json, f, ensure_ascii=False, indent=2)

print("\nProcesso concluído com sucesso!")
