import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import UploadPanel from "@/components/UploadPanel";
import CatalogPanel from "@/components/CatalogPanel";
import ResultPanel from "@/components/ResultPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Studio() {
  const [products, setProducts] = useState([]);
  const [preview, setPreview] = useState(null);      // data-uri of original
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle");       // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [resultProduct, setResultProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/catalog`)
      .then((r) => setProducts(r.data.products))
      .catch(() => toast.error("Could not load FANCHI catalog"));
  }, []);

  const canGenerate = preview && consent && selected && status !== "loading";

  const generate = useCallback(async () => {
    if (!preview || !consent || !selected) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await axios.post(`${API}/generate-wrap`, {
        image_base64: preview,
        product: selected,
      });
      setResult(res.data.image);
      setResultProduct(selected);
      setStatus("done");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = detail?.message || "Unable to generate your FANCHI wrap visual right now. Please try again.";
      const code = detail?.code === "busy" ? "busy" : "general";
      setError({ code, message: msg });
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

  return (
    <div className="relative z-10 min-h-screen">
      <Header onReset={reset} />

      <div className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-wider sm:text-4xl lg:text-5xl">
            See your car in a <span className="text-[var(--accent)]">FANCHI wrap</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
            Upload your car, pick a FANCHI vinyl and let Google Gemini render a realistic before / after of the exact same vehicle — professionally wrapped.
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

          <div id="catalog-anchor">
            <CatalogPanel products={products} selected={selected} onSelect={setSelected} />
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
              {status === "loading" ? (
                <><Loader2 size={20} className="spin" /> Generating…</>
              ) : (
                <><Sparkles size={20} /> Generate Visual</>
              )}
            </button>
            {!canGenerate && status !== "loading" && (
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">
                {!preview ? "Upload a photo" : !consent ? "Give photo consent" : !selected ? "Select a FANCHI product" : ""}
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
        </div>
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-6 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
        FANCHI AI Wrap Studio · Powered by Google Gemini
      </footer>
    </div>
  );
}
