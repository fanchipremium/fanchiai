import { useState, useMemo } from "react";
import { Search, Check } from "lucide-react";
import { MATERIALS, FINISHES, MATERIAL_FULL, titleCase } from "@/lib/constants";

export default function CatalogPanel({ products, seriesMeta = [], selected, onSelect }) {
  const [search, setSearch] = useState("");
  const [material, setMaterial] = useState("ALL");
  const [finish, setFinish] = useState("ALL");
  const [series, setSeries] = useState("SEMUA");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.color_code.toLowerCase().includes(q) || p.color_name.toLowerCase().includes(q);
      const matchM = material === "ALL" || p.material === material;
      const matchF = finish === "ALL" || p.finish === finish;
      const matchS = series === "SEMUA" || p.series === series;
      return matchQ && matchM && matchF && matchS;
    });
  }, [products, search, material, finish, series]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-xs font-bold">2</span>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Select FANCHI Product</h2>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          data-testid="fanchi-catalog-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, color or code..."
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
        />
      </div>

      <div data-testid="fanchi-material-filter-tabs" className="mb-2 flex flex-wrap gap-1.5">
        {MATERIALS.map((m) => (
          <Chip key={m} active={material === m} onClick={() => setMaterial(m)} label={m} tone="accent" />
        ))}
      </div>
      <div data-testid="fanchi-finish-filter-tabs" className="mb-3 flex flex-wrap gap-1.5">
        {FINISHES.map((f) => (
          <Chip key={f} active={finish === f} onClick={() => setFinish(f)} label={f} tone="accent" />
        ))}
      </div>

      <div data-testid="fanchi-series-filter-tabs" className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
        <Chip active={series === "SEMUA"} onClick={() => setSeries("SEMUA")} label="SEMUA" tone="cyan" />
        {seriesMeta.map((s) => (
          <Chip
            key={s.name}
            active={series === s.name}
            onClick={() => setSeries(s.name)}
            label={<>{s.name.toUpperCase()} <span className="opacity-60">{s.count}</span></>}
            tone="cyan"
          />
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">{series === "SEMUA" ? "Semua Kategori" : series}</h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{filtered.length} produk</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {filtered.slice(0, 120).map((p) => {
          const isSel = selected?.id === p.id;
          return (
            <button
              key={p.id}
              data-testid={`fanchi-product-card-${p.id}`}
              onClick={() => onSelect(p)}
              className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                isSel ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-subtle)] hover:border-[var(--border-highlight)]"
              } bg-[var(--bg-surface)]`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                {p.swatch_image ? (
                  <img src={p.swatch_image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full" style={{ background: p.gradient_css }} />
                )}
                {p.color_code && (
                  <span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
                    {p.color_code}
                  </span>
                )}
                {isSel && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--accent-cyan)]">{p.series}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-white" title={p.name}>{p.name}</p>
                <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {titleCase(p.finish)} {p.material} · {MATERIAL_FULL[p.material] || p.material}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length > 120 && (
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">
          Menampilkan 120 dari {filtered.length} · gunakan filter / pencarian untuk mempersempit
        </p>
      )}
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No products match your filters.</p>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, tone = "accent" }) {
  const activeCls = tone === "cyan"
    ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)] text-black"
    : "border-[var(--accent)] bg-[var(--accent)] text-white";
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
        active ? activeCls : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
