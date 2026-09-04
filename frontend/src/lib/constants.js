export const FINISH_HINT = {
  GLOSSY: "Realistic glossy reflection",
  MATTE: "Low-reflection matte surface",
  SATIN: "Soft semi-gloss reflection",
  METALLIC: "Visible metallic characteristics",
  CANDY: "Deep candy-like dimensional color",
  CHROME: "Highly reflective chrome surface",
  "COLOR SHIFT": "Shifts color with light & angle",
};

export const MATERIALS = ["ALL", "PET", "TPU", "PVC"];
export const FINISHES = ["ALL", "GLOSSY", "MATTE", "SATIN", "METALLIC", "CANDY", "CHROME", "COLOR SHIFT"];

export const MATERIAL_FULL = {
  PET: "Polyethylene Terephthalate",
  TPU: "Thermoplastic Polyurethane",
  PVC: "Polyvinyl Chloride",
};

export const titleCase = (s = "") =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric", month: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return "-";
  }
};

// Ganti dengan nomor WhatsApp FANCHI (format internasional tanpa +, mis. 628123456789)
export const FANCHI_WA = "6281200000000";
