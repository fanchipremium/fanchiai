import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import UploadPanel from "@/components/UploadPanel";
import CatalogPanel from "@/components/CatalogPanel";
import ResultPanel from "@/components/ResultPanel";
import { fmtDate, FANCHI_WA, MATERIAL_FULL } from "@/lib/constants";
import defaultCatalog from "@/data/catalog_data.json";
import defaultMeta from "@/data/catalog_meta.json";
import { ensurePuterLoaded, generateWrapWithPuter } from "@/lib/puter";

const API = '/api';

export default function Studio() {
  const [products, setProducts] = useState(defaultCatalog || []);
  const [meta, setMeta] = useState(defaultMeta || null);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [resultProduct, setResultProduct] = useState(null);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(() => {
    axios.get(`${API}/catalog`)
      .then((r) => {
        if (r.data?.products && Array.isArray(r.data.products) && r.data.products.length > 0) {
          setProducts(r.data.products);
        }
      })
      .catch((err) => {
        console.warn("Using bundled catalog data", err);
      });

    axios.get(`${API}/catalog/meta`)
      .then((r) => {
        if (r.data) setMeta(r.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { 
    loadCatalog();
    ensurePuterLoaded().then((p) => {
      if (p) console.log("Puter.js v2 successfully synchronized");
    });
  }, [loadCatalog]);

  const syncCatalog = async () => {
    setSyncing(true);
    toast.info("Menyinkronkan katalog FANCHI dari fanchi.id…");
    try {
      const r = await axios.post(`${API}/catalog/sync`, {}, { timeout: 180000 });
      if (r.data) {
        setMeta(r.data);
      }
      const res = await axios.get(`${API}/catalog`);
      if (res.data?.products) {
        setProducts(res.data.products);
      }
      toast.success(`Katalog tersinkron · ${r.data?.total || products.length} produk`);
    } catch {
      toast.error("Gagal sinkron katalog. Coba lagi.");
    } finally {
      setSyncing(false);
    }
  };

  const canGenerate = preview && consent && selected && status !== "loading";

  const FINISH_INTERPRETATION = {
    "GLOSSY": "Must have a high-gloss, highly reflective, mirror-like clear coat surface with sharp, distinct reflections and strong specular highlights.",
    "MATTE": "Must have a completely flat, non-reflective surface with soft, diffused lighting and no sharp reflections or gloss.",
    "SATIN": "Must have a semi-gloss, smooth silk-like surface with diffused, blurred reflections and a soft sheen.",
    "METALLIC": "Must have visible metallic flakes embedded in the paint, sparkling under direct light with a rich, deep color flop.",
    "COLOR SHIFT": "Must show a chameleon color-shifting effect where the color changes distinctly depending on the viewing angle and lighting.",
    "CHROME": "Must look like liquid metal with extreme mirror-like reflectivity, showing clear, undistorted reflections of the surrounding environment.",
    "CANDY": "Must have an incredibly deep, wet-look glossy finish with intense, vibrant, translucent color over a metallic base."
  };

  const generate = useCallback(async () => {
    if (!preview || !consent || !selected) return;
    setStatus("loading");
    setError(null);
    try {
      const finishNote = FINISH_INTERPRETATION[selected.finish?.toUpperCase()] || "Visual surface characteristics must follow the selected FANCHI material and finish.";
      const prompt = `Edit the uploaded vehicle photo to visualize the exact vehicle wrapped with the selected FANCHI automotive wrapping material and color.

SELECTED FANCHI PRODUCT
- Product: ${selected.name}
- Color name: ${selected.color_name}
- Color code: ${selected.color_code}
- Material: ${selected.material}
- Finish: ${selected.finish}

MATERIAL / FINISH INTERPRETATION
${finishNote}

Preserve the exact vehicle identity, model, body shape, proportions, body lines, panels, bumpers, hood, fenders, doors, headlights, taillights, grille, wheels, tires, windows, mirrors, interior visibility, camera angle, perspective, position, environment, background, shadows, lighting and composition.

Only modify the exterior painted body surfaces to represent the selected FANCHI wrapping material and finish. Apply the selected FANCHI color and material realistically across the vehicle body, including realistic reflections, highlights, texture and surface characteristics appropriate to the selected material.

Do not redesign the vehicle. Do not change the wheels. Do not change the body kit. Do not change the background. Do not change the camera angle. Do not add objects. Do not remove objects. Do not alter the vehicle proportions. Do not apply a flat color overlay.

The final image must look like the exact same vehicle in the uploaded photograph after professional FANCHI sticker wrapping installation.`;

      let imgB64 = preview;
      if (imgB64.includes(',') && imgB64.trim().startsWith('data:')) {
        imgB64 = imgB64.split(',')[1];
      }

      // 1. Try Puter.js v2 visualization engine first
      try {
        const puterResult = await generateWrapWithPuter(prompt, imgB64, selected.swatch_image);
        if (puterResult) {
          setResult(puterResult);
          setResultProduct(selected);
          setStatus("done");
          return;
        }
      } catch (puterErr) {
        console.warn("Puter engine attempt failed or not available, falling back to server API:", puterErr);
      }

      // 2. Fallback to Server API engine
      try {
        const res = await axios.post(`${API}/generate-wrap`, {
          image_base64: imgB64,
          product: selected
        }, { timeout: 120000 });

        if (res.data?.image) {
          setResult(res.data.image);
          setResultProduct(selected);
          setStatus("done");
          return;
        }
      } catch (apiErr) {
        console.warn("Server API engine error:", apiErr);
        throw apiErr;
      }

      setResultProduct(selected);
      setStatus("done");
    } catch (e) {
      console.error(e);
      const detail = e?.response?.data?.detail || e;
      const msg = detail?.message || "Unable to generate your FANCHI wrap visual right now. Please try again.";
      setError({ code: detail?.code === "busy" ? "busy" : "general", message: msg });
      setStatus("error");
    }
  }, [preview, consent, selected]);

  const reset = () => {
    setPreview(null); setConsent(false); setSelected(null);
    setResult(null); setResultProduct(null); setError(null); setStatus("idle");
  };

  const tryAnother = () => {
    setResult(null); setResultProduct(null); setError(null); setStatus("idle");
    setSelected(null);
    document.getElementById("catalog-anchor")?.scrollIntoView({ behavior: "smooth" });
  };

  const sendWhatsApp = () => {
    const p = resultProduct || selected;
    const lines = ["Halo FANCHI! Saya tertarik wrap mobil dengan produk berikut:"];
    if (p) {
      lines.push(`• Produk: ${p.name}`);
      if (p.color_code) lines.push(`• Kode: ${p.color_code}`);
      lines.push(`• Material: ${p.material} (${MATERIAL_FULL[p.material] || p.material})`);
      lines.push(`• Finish: ${p.finish}`);
    }
    lines.push("Mohon info harga & pemasangan. Terima kasih!");
    const url = `https://wa.me/${FANCHI_WA}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };

  return (
    <div className="relative z-10 min-h-screen">
      <Header onReset={reset} />

      <div className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-wider sm:text-4xl lg:text-5xl">
            See your car in a <span className="text-[var(--accent)]">FANCHI wrap</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
            Upload foto mobil, pilih vinyl FANCHI, dan biarkan AI merender before / after mobil yang sama — terpasang wrapping FANCHI secara realistis.
          </p>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
        <div className="space-y-8">
          <UploadPanel
            preview={preview}
            onFile={setPreview}
            onRemove={() => setPreview(null)}
            consent={consent}
            setConsent={setConsent}
          />

          {/* Stats + Sinkron katalog */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex flex-wrap items-center gap-6">
              <Stat value={meta?.total ?? "—"} label="Produk" />
              <div className="h-10 w-px bg-[var(--border-subtle)]" />
              <Stat value={meta?.categories ?? "—"} label="Kategori" />
              <button
                data-testid="sync-catalog-button"
                onClick={syncCatalog}
                disabled={syncing}
                className="ml-auto flex items-center gap-2 rounded-xl border border-[var(--border-highlight)] bg-[var(--bg-elevated)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-white transition-colors hover:border-[var(--accent)] disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? "spin" : ""} />
                {syncing ? "Menyinkronkan…" : "Sinkron katalog"}
              </button>
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Sinkron otomatis tiap 24 jam · terakhir {fmtDate(meta?.last_sync)} · berikutnya {fmtDate(meta?.next_sync)}
            </p>
          </div>

          <div id="catalog-anchor">
            <CatalogPanel products={products} seriesMeta={meta?.series || []} selected={selected} onSelect={setSelected} />
          </div>

          {consent && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-xs font-bold">3</span>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">Generate</h2>
              </div>
              <button
                data-testid="generate-visual-button"
                disabled={!canGenerate}
                onClick={generate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-4 font-display text-lg font-black uppercase tracking-widest text-white transition-transform enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "loading" ? (<><Loader2 size={20} className="spin" /> Creating your Fanchi wrap visualization...</>) : (<><Sparkles size={20} /> Generate Visual</>)}
              </button>
              {!canGenerate && status !== "loading" && (
                <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {!preview ? "Upload foto mobil" : !selected ? "Pilih produk FANCHI" : ""}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <ResultPanel
            status={status}
            original={preview}
            result={result}
            product={resultProduct}
            error={error}
            onGenerate={generate}
            onTryAnother={tryAnother}
          />
          <button
            data-testid="send-whatsapp-button"
            onClick={sendWhatsApp}
            disabled={!selected && !resultProduct}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-display text-sm font-black uppercase tracking-widest text-black transition-transform enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.05 1.6 5.79L2 22l4.44-1.7a9.9 9.9 0 004.6 1.17h.01c5.46 0 9.91-4.45 9.91-9.91C20.96 6.45 16.5 2 12.04 2m5.8 14.16c-.24.68-1.42 1.3-1.95 1.35-.5.05-1.14.07-1.84-.11-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.23-5-4.43-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.58-.37.78-.37.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2.02.89 2.17.07.15.12.32.02.52-.09.2-.14.32-.28.49-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.27.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.2.69-.8.87-1.08.18-.27.36-.22.61-.14.25.09 1.62.76 1.9.9.28.14.46.21.53.33.07.12.07.68-.17 1.36"/></svg>
            Kirim ke WhatsApp
          </button>
        </div>
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-6 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
        FANCHI AI Wrap Studio · AI Wrap Visualization
      </footer>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="font-display text-3xl font-black leading-none text-white">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}
