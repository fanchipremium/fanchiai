"""FANCHI catalog sync: scrapes fanchi.id/katalog-produk into catalog_data.json + catalog_meta.json."""
import re
import json
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

import requests

ROOT = Path(__file__).parent
DATA_FILE = ROOT / "catalog_data.json"
META_FILE = ROOT / "catalog_meta.json"
SYNC_INTERVAL_HOURS = 24

HEADERS = {"User-Agent": "Mozilla/5.0"}

CATS = {
    "carbon-pet": ("PET", "GLOSSY"), "colour-shift": ("PET", "COLOR SHIFT"),
    "chameleon-series": ("PET", "COLOR SHIFT"), "diamond-crystal": ("PET", "METALLIC"),
    "diamond-heavy-metal": ("PET", "METALLIC"), "galactic": ("PET", "METALLIC"),
    "glossy-crystal": ("PET", "GLOSSY"), "glossy-metallic-candy": ("PET", "CANDY"),
    "glossy-pearl-satin-white": ("PET", "SATIN"), "glossy-satin-pearl-white-pet-series": ("PET", "SATIN"),
    "liquid-metal": ("PET", "METALLIC"), "liquid-metaly": ("PET", "METALLIC"),
    "magic-candyy": ("PET", "CANDY"), "magic-candy-color-flip-pet": ("PET", "COLOR SHIFT"),
    "magic-candy-color-flip-pvc": ("PVC", "COLOR SHIFT"), "magic-gold": ("PET", "METALLIC"),
    "matte-series": ("PET", "MATTE"), "matte-chrome": ("PET", "CHROME"),
    "oxide-pet": ("PET", "MATTE"), "paint-metallic": ("PET", "METALLIC"),
    "paint-protection-film": ("TPU", "GLOSSY"), "pet-liner": ("PET", "GLOSSY"),
    "satin-metallic-pet": ("PET", "SATIN"), "satin-metallic-glossy": ("PET", "SATIN"),
    "satin-metallic-glossy-pet": ("PET", "SATIN"), "super-glossy": ("PET", "GLOSSY"),
    "tpu-colour": ("TPU", "GLOSSY"), "ultra-matte": ("PET", "MATTE"),
    "platinum-y-series": ("PET", "COLOR SHIFT"),
}

CAT_LABEL = {
    "carbon-pet": "Carbon PET", "colour-shift": "Colour Shift", "chameleon-series": "Chameleon Series",
    "diamond-crystal": "Diamond Crystal", "diamond-heavy-metal": "Diamond Heavy Metal", "galactic": "Galactic",
    "glossy-crystal": "Glossy Crystal", "glossy-metallic-candy": "Glossy Metallic Candy",
    "glossy-pearl-satin-white": "Glossy Pearl & Satin White", "glossy-satin-pearl-white-pet-series": "Glossy Pearl & Satin White PET Series",
    "liquid-metal": "Liquid Metal", "liquid-metaly": "Liquid Metal (Y)", "magic-candyy": "Magic Candy (Y)",
    "magic-candy-color-flip-pet": "Magic Candy Color Flip PET", "magic-candy-color-flip-pvc": "Magic Candy Color Flip PVC",
    "magic-gold": "Magic Gold", "matte-series": "Matte Series", "matte-chrome": "Matte Chrome",
    "oxide-pet": "Oxide PET", "paint-metallic": "Paint Metallic", "paint-protection-film": "Paint Protection Film",
    "pet-liner": "PET Liner", "satin-metallic-pet": "Satin Metallic PET", "satin-metallic-glossy": "Satin Metallic Glossy",
    "satin-metallic-glossy-pet": "Satin Metallic Glossy PET", "super-glossy": "Super Glossy",
    "tpu-colour": "TPU Colour", "ultra-matte": "Ultra Matte", "platinum-y-series": "Platinum Series Y",
}

LI_RE = re.compile(r'<li[^>]*class="[^"]*\bproduct\b[^"]*"[\s\S]*?</li>')
HREF_RE = re.compile(r'href="(https://fanchi\.id/product/[^"]+)"')
LABEL_RE = re.compile(r'aria-label="([^"]+)"')
SRCSET_RE = re.compile(r'data-srcset="([^"]+)"')
DSRC_RE = re.compile(r'data-src="([^"]+)"')
CODE_PATTERNS = [
    re.compile(r'(ID[-_]?\d{2,5}[A-Za-z]?(?:[-_]Y)?)', re.I),
    re.compile(r'(FC[-_]?\d{2,5}[A-Za-z]?)', re.I),
    re.compile(r'\b(\d{3,5}[A-Za-z]?)\b'),
]


def _best_image(srcset, dsrc):
    if srcset:
        pairs = []
        for part in srcset.split(","):
            m = re.match(r'(\S+)\s+(\d+)w', part.strip())
            if m:
                pairs.append((int(m.group(2)), m.group(1)))
        if pairs:
            pairs.sort(key=lambda x: abs(x[0] - 600))
            return pairs[0][1]
    return dsrc


def _stem(url):
    fn = url.rsplit("/", 1)[-1]
    fn = re.sub(r'-\d+x\d+', '', fn)
    return re.sub(r'\.(jpg|jpeg|png|webp)$', '', fn, flags=re.I)


def _find_code(img, name):
    s = _stem(img or "")
    if s and not s.lower().startswith("whatsapp"):
        for pat in CODE_PATTERNS:
            m = pat.search(s)
            if m:
                return m.group(1).upper().replace("_", "-")
    for pat in CODE_PATTERNS[:2]:
        m = pat.search(name)
        if m:
            return m.group(1).upper().replace("_", "-")
    return ""


def _parse_category(slug):
    material, finish = CATS[slug]
    label = CAT_LABEL[slug]
    products, seen = [], set()
    for page in range(1, 10):
        url = f"https://fanchi.id/product-category/{slug}/" if page == 1 else f"https://fanchi.id/product-category/{slug}/page/{page}/"
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
        except Exception:
            break
        if r.status_code != 200:
            break
        blocks = LI_RE.findall(r.text)
        if not blocks:
            break
        new = 0
        for b in blocks:
            href = HREF_RE.search(b)
            if not href:
                continue
            purl = href.group(1)
            if purl in seen:
                continue
            seen.add(purl)
            new += 1
            name_m = LABEL_RE.search(b)
            name = name_m.group(1).strip() if name_m else purl.rstrip("/").rsplit("/", 1)[-1].replace("-", " ").title()
            srcset = SRCSET_RE.search(b)
            dsrc = DSRC_RE.search(b)
            img = _best_image(srcset.group(1) if srcset else "", dsrc.group(1) if dsrc else "")
            pslug = purl.rstrip("/").rsplit("/", 1)[-1]
            products.append({
                "id": pslug, "name": name, "color_name": name,
                "color_code": _find_code(img or "", name),
                "material": material, "finish": finish, "series": label,
                "series_slug": slug, "swatch_image": img,
            })
        if new == 0:
            break
        time.sleep(0.2)
    return products


def build_meta(products):
    from collections import Counter, OrderedDict
    counts = Counter(p["series"] for p in products)
    slug_of = {}
    for p in products:
        slug_of.setdefault(p["series"], p.get("series_slug", ""))
    series = [{"name": name, "slug": slug_of.get(name, ""), "count": counts[name]}
              for name in sorted(counts, key=lambda n: -counts[n])]
    now = datetime.now(timezone.utc)
    return {
        "total": len(products),
        "categories": len(series),
        "series": series,
        "last_sync": now.isoformat(),
        "next_sync": (now + timedelta(hours=SYNC_INTERVAL_HOURS)).isoformat(),
    }


def sync_catalog():
    """Scrape all categories, write catalog_data.json + catalog_meta.json. Returns meta."""
    all_products, seen = [], set()
    for slug in CATS:
        for p in _parse_category(slug):
            if p["id"] in seen:
                continue
            seen.add(p["id"])
            all_products.append(p)
    if not all_products:
        raise RuntimeError("sync produced no products")
    DATA_FILE.write_text(json.dumps(all_products, ensure_ascii=False), encoding="utf-8")
    meta = build_meta(all_products)
    META_FILE.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return meta


def ensure_meta():
    """Compute meta from existing catalog_data.json if meta is missing (no scraping)."""
    if META_FILE.exists():
        try:
            return json.loads(META_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    if DATA_FILE.exists():
        products = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        for p in products:
            p.setdefault("series", "Other")
        meta = build_meta(products)
        META_FILE.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        return meta
    return {"total": 0, "categories": 0, "series": [], "last_sync": None, "next_sync": None}


def get_meta():
    if META_FILE.exists():
        return json.loads(META_FILE.read_text(encoding="utf-8"))
    return ensure_meta()
