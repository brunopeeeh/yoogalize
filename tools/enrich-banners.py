import json
import sys
import os

sys.path.insert(0, os.path.abspath("."))
from atualizar_lojas import run_sql

print("📡 Buscando banners no Databricks...")
sql = """
select display_name, image_url
from yooga_delta_lake_cleaned.mysql_yooga_delivery.stores
where not coalesce(is_merge_deletion_detected, false)
  and image_url is not null
  and display_name is not null
qualify row_number() over (partition by display_name order by updated_at desc) = 1
"""
rows = run_sql(sql)
banners = {r["display_name"]: r["image_url"] for r in rows if r.get("display_name") and r.get("image_url")}
print(f"   {len(banners)} banners únicos encontrados no Databricks.")

with open("public/lojas.json", "r", encoding="utf-8") as f:
    data = json.load(f)

matched = 0
for loja in data["result"]:
    slug = loja.get("link delivery")
    banner = banners.get(slug) if slug else None
    loja["banner"] = banner
    if banner:
        matched += 1

with open("public/lojas.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)

print(f"💾 public/lojas.json atualizado com sucesso! {matched} de {len(data['result'])} lojas agora têm banner ({round(matched/len(data['result'])*100, 1)}%).")
