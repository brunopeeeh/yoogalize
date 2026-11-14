import pandas as pd
import json

# ======= CONFIGURAÇÕES =======
INPUT_FILE = "Base cliente Vila Velha_com_coordenadas.xlsx"
OUTPUT_FILE = "Base cliente Vila Velha_com_coordenadas.json"

# ======= EXECUÇÃO =======
print("📖 Lendo planilhas...")
sheets = pd.read_excel(INPUT_FILE, sheet_name=None)  # Lê todas as abas

dados = {}

for sheet_name, df in sheets.items():
    print(f"🔄 Convertendo aba: {sheet_name}")
    
    # Converte o DataFrame em lista de dicionários (1 por linha)
    registros = df.fillna("").to_dict(orient="records")
    
    # Salva no dicionário principal
    dados[sheet_name] = registros

# Salva tudo em um único arquivo JSON
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(dados, f, ensure_ascii=False, indent=2)

print(f"\n✅ Conversão concluída com sucesso!")
print(f"📁 Arquivo salvo como: {OUTPUT_FILE}")
