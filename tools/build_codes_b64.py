\
import sys, json, math, re, base64
from pathlib import Path
import openpyxl

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

def normalize_code(s: str) -> str:
  return re.sub(r"\\s+", " ", (s or "").strip().lower())

def slugify(s: str) -> str:
  import unicodedata
  s = unicodedata.normalize("NFD", s)
  s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
  s = s.lower()
  s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
  return s

def main():
  if len(sys.argv) < 2:
    print("Uso: python tools/build_codes_b64.py <BalanceSheet.xlsx>")
    sys.exit(1)

  xlsx = Path(sys.argv[1])
  wb = openpyxl.load_workbook(xlsx, data_only=True)
  sh = wb["ITEMS"]
  # header
  rows = list(sh.iter_rows(values_only=True))
  header = [clean(c) for c in rows[0]]

  try:
    idx_code = header.index("code_id")
    idx_type = header.index("type")
    idx_name = header.index("name")
  except ValueError as e:
    raise SystemExit(f"Colunas esperadas ausentes em ITEMS: {e}")

  seen_item_ids = set()
  def make_item_id(typ, name):
    base = f"{slugify(typ)}_{slugify(name)}"
    item_id = base
    k = 2
    while item_id in seen_item_ids:
      item_id = f"{base}_{k}"
      k += 1
    seen_item_ids.add(item_id)
    return item_id

  used_norm = set()
  mapping = {}

  for r in rows[1:]:
    if all(clean(c) is None for c in r):
      continue
    code = clean(r[idx_code])
    typ = clean(r[idx_type]) or "type"
    name = clean(r[idx_name]) or "item"
    item_id = make_item_id(typ, name)

    if not code:
      continue

    code_norm = normalize_code(str(code))
    if code_norm in used_norm:
      raise SystemExit(f"code_id duplicado após normalização: {code_norm}")
    used_norm.add(code_norm)

    b64 = base64.b64encode(code_norm.encode("utf-8")).decode("ascii")
    mapping[b64] = item_id

  out_dir = Path("src/data")
  out_dir.mkdir(parents=True, exist_ok=True)
  out_file = out_dir / "codes_b64.json"
  out_file.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
  print("OK:", out_file, f"({len(mapping)} códigos)")

if __name__ == "__main__":
  main()
