"""FANCHI product catalog (imported from fanchi.id/katalog-produk)."""
import json
from pathlib import Path

_DATA_FILE = Path(__file__).parent / "catalog_data.json"

# Demo fallback (used only if the imported catalog file is missing)
_DEMO_CATALOG = [
    {
        "id": "FC-8139",
        "name": "Magic Candy Flip Grey Green",
        "color_name": "Grey Green Chameleon",
        "color_code": "FC-8139",
        "material": "PET",
        "finish": "COLOR SHIFT",
        "hex_primary": "#4A6B6C",
        "hex_secondary": "#88A795",
        "gradient_css": "linear-gradient(135deg, #2D3748 0%, #4A6B6C 50%, #88A795 100%)",
        "badge": "BESTSELLER",
    },
    {
        "id": "FC-8312",
        "name": "Magic Candy Color Flip Grey Blue",
        "color_name": "Grey Blue Flip",
        "color_code": "FC-8312",
        "material": "PET",
        "finish": "COLOR SHIFT",
        "hex_primary": "#3B5B73",
        "hex_secondary": "#7FA3C4",
        "gradient_css": "linear-gradient(135deg, #23303F 0%, #3B5B73 50%, #7FA3C4 100%)",
        "badge": "COLOR SHIFT",
    },
    {
        "id": "FC-201",
        "name": "Liquid Metal Sterling Silver",
        "color_name": "Sterling Silver",
        "color_code": "FC-201",
        "material": "TPU",
        "finish": "METALLIC",
        "hex_primary": "#CBD5E1",
        "hex_secondary": "#64748B",
        "gradient_css": "linear-gradient(135deg, #F8FAFC 0%, #94A3B8 50%, #334155 100%)",
        "badge": "TPU PPF",
    },
    {
        "id": "FC-612",
        "name": "Glossy Candy Apple Red",
        "color_name": "Candy Apple Red",
        "color_code": "FC-612",
        "material": "PET",
        "finish": "CANDY",
        "hex_primary": "#DC2626",
        "hex_secondary": "#991B1B",
        "gradient_css": "linear-gradient(135deg, #FF1A1A 0%, #B91C1C 60%, #450A0A 100%)",
        "badge": "HIGH GLOSS",
    },
    {
        "id": "FC-305",
        "name": "Satin Metallic Emerald Green",
        "color_name": "Emerald Green",
        "color_code": "FC-305",
        "material": "PET",
        "finish": "SATIN",
        "hex_primary": "#059669",
        "hex_secondary": "#064E3B",
        "gradient_css": "linear-gradient(135deg, #10B981 0%, #047857 50%, #064E3B 100%)",
        "badge": "PREMIUM",
    },
    {
        "id": "FC-402",
        "name": "Ultra Matte Stealth Black",
        "color_name": "Stealth Matte Black",
        "color_code": "FC-402",
        "material": "PVC",
        "finish": "MATTE",
        "hex_primary": "#18181B",
        "hex_secondary": "#09090B",
        "gradient_css": "linear-gradient(135deg, #27272A 0%, #18181B 50%, #09090B 100%)",
        "badge": "STEALTH",
    },
    {
        "id": "FC-582",
        "name": "Mirror Chrome Silver",
        "color_name": "Mirror Chrome Silver",
        "color_code": "FC-582",
        "material": "PET",
        "finish": "CHROME",
        "hex_primary": "#E2E8F0",
        "hex_secondary": "#475569",
        "gradient_css": "linear-gradient(135deg, #FFFFFF 0%, #94A3B8 25%, #FFFFFF 50%, #334155 75%, #CBD5E1 100%)",
        "badge": "MIRROR",
    },
    {
        "id": "FC-509",
        "name": "Mirror Chrome Royale Gold",
        "color_name": "Royale Gold Chrome",
        "color_code": "FC-509",
        "material": "PET",
        "finish": "CHROME",
        "hex_primary": "#EAB308",
        "hex_secondary": "#A16207",
        "gradient_css": "linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #854D0E 100%)",
        "badge": "SPECIAL EDITION",
    },
    {
        "id": "FC-708",
        "name": "Magic Sunset Cyan-Purple Shift",
        "color_name": "Cyan Purple Flip",
        "color_code": "FC-708",
        "material": "TPU",
        "finish": "COLOR SHIFT",
        "hex_primary": "#06B6D4",
        "hex_secondary": "#9333EA",
        "gradient_css": "linear-gradient(135deg, #00F0FF 0%, #8B5CF6 50%, #EC4899 100%)",
        "badge": "TPU PPF",
    },
    {
        "id": "FC-110",
        "name": "Super Gloss Nardo Grey",
        "color_name": "Nardo Grey",
        "color_code": "FC-110",
        "material": "PET",
        "finish": "GLOSSY",
        "hex_primary": "#64748B",
        "hex_secondary": "#334155",
        "gradient_css": "linear-gradient(135deg, #94A3B8 0%, #64748B 60%, #334155 100%)",
        "badge": "POPULAR",
    },
    {
        "id": "FC-118",
        "name": "Glossy Piano Black",
        "color_name": "Crystal Piano Black",
        "color_code": "FC-118",
        "material": "TPU",
        "finish": "GLOSSY",
        "hex_primary": "#0A0A0A",
        "hex_secondary": "#262626",
        "gradient_css": "linear-gradient(135deg, #404040 0%, #171717 55%, #000000 100%)",
        "badge": "TPU PPF",
    },
    {
        "id": "FC-8422",
        "name": "Platinum Pearl Silver Orange Shift",
        "color_name": "Pearl Silver Orange Flip",
        "color_code": "FC-8422",
        "material": "PET",
        "finish": "COLOR SHIFT",
        "hex_primary": "#D6D3D1",
        "hex_secondary": "#EA580C",
        "gradient_css": "linear-gradient(135deg, #F5F5F4 0%, #D6D3D1 45%, #EA580C 100%)",
        "badge": "PLATINUM",
    },
]


def _load_catalog():
    if _DATA_FILE.exists():
        try:
            data = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list) and data:
                return data
        except Exception:
            pass
    return _DEMO_CATALOG


FANCHI_CATALOG = _load_catalog()


# Finish interpretation for the Gemini prompt builder
FINISH_INTERPRETATION = {
    "GLOSSY": "Realistic high glossy reflection with sharp specular highlights and a wet, polished mirror-like sheen on the painted body panels.",
    "MATTE": "Low-reflection matte surface with soft diffuse light, no shine, flat velvety appearance and no specular highlights.",
    "SATIN": "Soft semi-gloss satin reflection, a smooth silky sheen that sits between matte and glossy.",
    "METALLIC": "Visible metallic flake characteristics with a liquid-metal shimmer that sparkles and shifts subtly with light.",
    "CANDY": "Deep, translucent candy-like color with rich dimensional depth and realistic layered gloss reflections.",
    "CHROME": "Highly reflective mirror-chrome surface that clearly reflects the surrounding environment like polished metal.",
    "COLOR SHIFT": "Realistic color-shifting (chameleon flip) appearance where the color changes between the two tones depending on light and viewing angle, with a pearlescent metallic shimmer.",
}
