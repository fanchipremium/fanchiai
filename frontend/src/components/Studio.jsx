import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import UploadPanel from "@/components/UploadPanel";
import CatalogPanel from "@/components/CatalogPanel";
import ResultPanel from "@/components/ResultPanel";
import { fmtDate, FANCHI_WA, MATERIAL_FULL } from "@/lib/constants";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Studio() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [resultProduct, setResultProduct] = useState(null);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(() => {
    axios.get(`${API}/catalog`).then((r) => setProducts(r.data.products)).catch(() => toast.error("Gagal memuat katalog FANCHI"));
    axios.get(`${API}/catalog/meta`).then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const syncCatalog = async () => {
    setSyncing(true);
    toast.info("Menyinkronkan katalog FANCHI dari fanchi.id…");
    try {
      const r = await axios.post(`${API}/catalog/sync`, {}, { timeout: 180000 });
      setMeta(r.data);
      await axios.get(`${API}/catalog`).then((res) => setProducts(res.data.products));
      toast.success(`Katalog tersinkron · ${r.data.total} produk`);
    } catch {
      toast.error("Gagal sinkron katalog. Coba lagi.");
    } finally {
      setSyncing(false);
    }
  };

  const canGenerate = preview && consent && selected && status !== "loading";

  const generate = useCallback(async () => {
    if (!preview || !consent || !selected) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await axios.post(`${API}/generate-wrap`, { image_base64: preview, product: selected });
      setResult(res.data.image);
      setResultProduct(selected);
      setStatus("done");
    } catch (e) {
      const detail = e?.response?.data?.detail;
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
              {status === "loading" ? (<><Loader2 size={20} className="spin" /> Generating…</>) : (<><Sparkles size={20} /> Generate Visual</>)}
            </button>
            {!canGenerate && status !== "loading" && (
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">
                {!preview ? "Upload foto mobil" : !consent ? "Setujui penggunaan foto" : !selected ? "Pilih produk FANCHI" : ""}
              </p>
            )}
          </div>
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
