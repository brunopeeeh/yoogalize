import pandas as pd
import requests
import time
import re
import json

# ======= CONFIGURAÇÕES =======
INPUT_FILE = "Base cliente Vila Velha.xlsx"
OUTPUT_CSV_FILE = "lojas_para_importar.csv"

# ======= FUNÇÕES AUXILIARES (sem alteração) =======
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
        if not data: return None, None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Erro de rede ao buscar '{address}': {e}")
        return None, None
    except Exception as e:
        print(f"⚠️ Erro inesperado ao buscar '{address}': {e}")
        return None, None

def get_coords_from_cep(text):
    """Procura CEP no texto e tenta buscar localização pelo CEP."""
    if not isinstance(text, str): return None, None
    cep_pattern = re.search(r"\b\d{5}-?\d{3}\b", text)
    if not cep_pattern: return None, None
    cep = cep_pattern.group().replace("-", "")
    print(f"     ℹ️ Tentando via CEP: {cep}")
    return get_coords_from_address(f"CEP {cep}, Brasil")

def traduzir_type(tipo):
    """Traduz o tipo de atendimento para texto legível."""
    mapa = {"IMEDIATE": "Delivery", "BOTH": "Delivery e Agendamento", "SCHEDULED": "Agendamento"}
    return mapa.get(tipo.upper(), tipo)

def validar_horario_funcionamento(dados):
    """Garante que todos os dias da semana existam e que os tipos estejam traduzidos."""
    dias_semana = [{"day_of_week": i, "day": d} for i, d in enumerate(["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"])]
    mapa_existentes = {d["day_of_week"]: d for d in dados if "day_of_week" in d}
    resultado = []
    for d in dias_semana:
        dia_dados = mapa_existentes.get(d["day_of_week"], {"hours": []})
        dia_dados.update(d)
        for h in dia_dados.get("hours", []):
            if "type" in h: h["type"] = traduzir_type(h["type"])
        resultado.append(dia_dados)
    return resultado

# ======= EXECUÇÃO PRINCIPAL =======
def main():
    """Função principal que orquestra todo o processo."""
    print(f"📖 Lendo planilha de entrada: {INPUT_FILE}")
    try:
        sheets = pd.read_excel(INPUT_FILE, sheet_name=None)
    except FileNotFoundError:
        print(f"❌ ERRO: O arquivo de entrada '{INPUT_FILE}' não foi encontrado.")
        exit()

    lista_dfs_processados = []

    for sheet_name, df in sheets.items():
        print(f"\n📍 Processando aba: {sheet_name}")
        df['categoria'] = sheet_name # Adiciona a categoria

        if "Latitude" not in df.columns: df["Latitude"] = None
        if "Longitude" not in df.columns: df["Longitude"] = None

        for i, row in df.iterrows():
            lat_existente = pd.to_numeric(row.get("Latitude"), errors='coerce')
            lon_existente = pd.to_numeric(row.get("Longitude"), errors='coerce')
            if pd.notna(lat_existente) and pd.notna(lon_existente):
                continue
            
            endereco = row.get("endereço completo", "")
            print(f"  🔍 ({i+1}/{len(df)}) Buscando coordenadas para: {endereco}")
            lat, lon = get_coords_from_address(endereco)
            if lat is None or lon is None:
                lat, lon = get_coords_from_cep(str(endereco))
            df.at[i, "Latitude"] = lat
            df.at[i, "Longitude"] = lon
            time.sleep(1.1)

        if "horario_funcionamento" in df.columns:
            def parse_horario(valor):
                if isinstance(valor, str) and valor.strip():
                    try:
                        dados = json.loads(valor)
                        return json.dumps(validar_horario_funcionamento(dados), ensure_ascii=False)
                    except json.JSONDecodeError:
                        return json.dumps(validar_horario_funcionamento([]), ensure_ascii=False)
                return json.dumps(validar_horario_funcionamento([]), ensure_ascii=False)
            df["horario_funcionamento"] = df["horario_funcionamento"].apply(parse_horario)
        else:
            df["horario_funcionamento"] = [json.dumps(validar_horario_funcionamento([]), ensure_ascii=False) for _ in range(len(df))]

        df.dropna(subset=["Latitude", "Longitude"], inplace=True)
        lista_dfs_processados.append(df)

    # --- Consolida todos os dataframes em um só ---
    if not lista_dfs_processados:
        print("\n⚠️ Nenhum dado válido foi processado. O arquivo CSV não será gerado.")
        return

    df_final = pd.concat(lista_dfs_processados, ignore_index=True)

    # Renomeia colunas para corresponder à tabela do Supabase
    df_final.rename(columns={
        'Latitude': 'latitude',
        'Longitude': 'longitude',
        'endereço completo': 'endereco_completo'
    }, inplace=True)

    # Garante que todas as colunas da tabela existam, preenchendo com valores vazios se necessário
    colunas_tabela = ['nome_fantasia', 'categoria', 'endereco_completo', 'telefone', 'instagram', 'latitude', 'longitude', 'horario_funcionamento']
    for col in colunas_tabela:
        if col not in df_final.columns:
            df_final[col] = ""

    # Seleciona e ordena as colunas para o CSV final
    df_final = df_final[colunas_tabela]

    # --- Salva o arquivo CSV final ---
    print(f"\n💾 Salvando arquivo CSV final em: {OUTPUT_CSV_FILE}")
    df_final.to_csv(OUTPUT_CSV_FILE, index=False, encoding='utf-8')

    print("\n🎉 Processo concluído com sucesso!")

if __name__ == "__main__":
    main()
