\
import sys, json, math, re
from pathlib import Path
import openpyxl

SHEETS = ["CLASSES","BOSSES","ITEMS","SKILLS_PLAYER","SKILLS_BOSS","STATUSES","VFX_LIBRARY"]

def is_nan(x):
  return isinstance(x, float) and math.isnan(x)

def clean(v):
  if v is None or is_nan(v):
    return None
  if isinstance(v, str):
    v = v.strip()
    return v if v != "" else None
  if isinstance(v, (int, float)):
    if isinstance(v, float) and abs(v - int(v)) < 1e-9:
      return int(v)
    return v
  return v

def slugify(s: str) -> str:
  import unicodedata
  s = unicodedata.normalize("NFD", s)
  s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
  s = s.lower()
  s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
  return s

def export_sheet(wb, name: str):
  sh = wb[name]
  rows = list(sh.iter_rows(values_only=True))
  header = [clean(c) for c in rows[0]]
  data = []
  for r in rows[1:]:
    if all(clean(c) is None for c in r):
      continue
    obj = { header[i]: clean(r[i]) for i in range(len(header)) if header[i] is not None }
    data.append(obj)
  return data

def transform_items(items):
  out = []
  seen = set()
  for it in items:
    name = it.get("name") or "item"
    typ = it.get("type") or "type"
    item_id = f"{slugify(typ)}_{slugify(name)}"
    base = item_id
    k = 2
    while item_id in seen:
      item_id = f"{base}_{k}"
      k += 1
    seen.add(item_id)

    pub = dict(it)
    pub.pop("code_id", None)  # não publicar código em texto puro
    pub["item_id"] = item_id

    # patch: evolução Algoz tem +12% crit no texto
    eff = str(pub.get("effect_text") or "")
    if "Algoz" in name and "+12% Chance de crítico" in eff and not pub.get("stat_crit_pp"):
      pub["stat_crit_pp"] = 12

    out.append(pub)
  return out

def main():
  if len(sys.argv) < 2:
    print("Uso: python tools/export_balance_to_json.py <BalanceSheet.xlsx>")
    sys.exit(1)

  xlsx = Path(sys.argv[1])
  wb = openpyxl.load_workbook(xlsx, data_only=True)

  out_dir = Path("src/data")
  out_dir.mkdir(parents=True, exist_ok=True)

  for sheet in SHEETS:
    data = export_sheet(wb, sheet)
    if sheet == "ITEMS":
      data = transform_items(data)
      out_file = out_dir / "items.json"
    else:
      out_file = out_dir / f"{sheet.lower()}.json"
    out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK:", out_file)

if __name__ == "__main__":
  main()
