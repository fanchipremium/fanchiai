import { useState } from "react";
import { Download, RefreshCw, AlertTriangle, Loader2, SlidersHorizontal, Columns2, Wand2 } from "lucide-react";
import BeforeAfter from "@/components/BeforeAfter";

export default function ResultPanel({ status, original, result, product, error, onGenerate, onTryAnother }) {
  const [mode, setMode] = useState("slider");

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Visualizer</h2>
        {status === "done" && (
          <div className="flex gap-1.5">
            <ViewBtn active={mode === "slider"} onClick={() => setMode("slider")} testid="view-mode-slider-button" icon={<SlidersHorizontal size={14} />} label="Slider" />
            <ViewBtn active={mode === "side"} onClick={() => setMode("side")} testid="view-mode-side-by-side-button" icon={<Columns2 size={14} />} label="Side" />
          </div>
        )}
      </div>

      {status === "idle" && (
        <Placeholder original={original} />
      )}

      {status === "loading" && (
        <div className="relative flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] laser-scan">
          {original && <img src={original} alt="processing" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
          <div className="relative z-10 flex flex-col items-center">
            <Loader2 size={34} className="spin text-[var(--accent-cyan)]" />
            <p className="mt-4 font-display text-lg font-bold uppercase tracking-wide">Applying FANCHI Wrap</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-400">Google Gemini is rendering…</p>
          </div>
        </div>
      )}

      {status === "error" && (
        <ErrorBox error={error} onRetry={onGenerate} />
      )}

      {status === "done" && (
        <div className="space-y-4">
          {mode === "slider" ? (
            <BeforeAfter before={original} after={result} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Frame src={original} label="Original" accent={false} />
              <Frame src={result} label="Wrapped" accent />
            </div>
          )}

          {product && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
                {product.swatch_image ? (
                  <img src={product.swatch_image} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: product.gradient_css }} />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{product.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{product.color_code ? `${product.color_code} · ` : ""}{product.material} · {product.finish}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              data-testid="try-another-color-button"
              onClick={onTryAnother}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-highlight)] bg-[var(--bg-elevated)] px-4 py-3 font-display text-sm font-bold uppercase tracking-widest text-white transition-colors hover:border-[var(--accent)]"
            >
              <RefreshCw size={16} /> Try Another Color
            </button>
            <a
              data-testid="download-wrap-result-button"
              href={result}
              download={`fanchi-wrap-${product?.color_code || "visual"}.png`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-display text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-[1.02]"
            >
              <Download size={16} /> Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Placeholder({ original }) {
  return (
    <div className="flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-base)] text-center">
      {original ? (
        <img src={original} alt="original preview" className="h-full w-full object-cover opacity-60" />
      ) : (
        <>
          <Wand2 size={30} className="text-slate-600" />
          <p className="mt-3 font-display text-lg font-bold uppercase tracking-wide text-slate-400">Your wrap preview appears here</p>
          <p className="mt-1 max-w-xs text-sm text-slate-600">Upload a car photo, give consent and pick a FANCHI product to generate.</p>
        </>
      )}
    </div>
  );
}

function ErrorBox({ error, onRetry }) {
  const busy = error?.code === "busy";
  return (
    <div
      data-testid={busy ? "error-state-busy-container" : "error-state-general-container"}
      className="flex aspect-[16/10] w-full flex-col items-center justify-center rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-6 text-center"
    >
      <AlertTriangle size={34} className="text-[var(--accent)]" />
      <p className="mt-4 max-w-sm font-semibold text-white">{error?.message}</p>
      <button
        data-testid={busy ? "error-busy-retry-button" : "error-general-try-again-button"}
        onClick={onRetry}
        className="mt-5 rounded-xl bg-[var(--accent)] px-6 py-2.5 font-display text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-[1.03]"
      >
        {busy ? "Retry Now" : "Try Again"}
      </button>
    </div>
  );
}

function Frame({ src, label, accent }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)]">
      <img src={src} alt={label} className="aspect-[4/3] w-full object-cover" />
      <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white backdrop-blur ${accent ? "bg-[var(--accent)]/90" : "bg-black/70"}`}>{label}</span>
    </div>
  );
}

function ViewBtn({ active, onClick, testid, icon, label }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
        active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-subtle)] text-slate-400 hover:text-white"
      }`}
    >
      {icon} {label}
    </button>
  );
}
