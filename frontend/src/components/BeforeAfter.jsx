import { useRef, useState, useCallback } from "react";

export default function BeforeAfter({ before, after }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const dragging = useRef(false);

  const move = useCallback((clientX) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const start = () => (dragging.current = true);
  const stop = () => (dragging.current = false);

  return (
    <div
      ref={ref}
      data-testid="wrap-before-after-slider"
      className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl border border-[var(--border-subtle)]"
      onMouseMove={(e) => dragging.current && move(e.clientX)}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      <img src={after} alt="Wrapped" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt="Original"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: ref.current ? ref.current.offsetWidth : "100%", maxWidth: "none" }}
          draggable={false}
        />
      </div>

      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur">Original</span>
      <span className="absolute right-3 top-3 rounded-full bg-[var(--accent)]/90 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur">Wrapped</span>

      <div className="absolute inset-y-0" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
        <div className="h-full w-0.5 bg-white/90" />
        <button
          onMouseDown={start}
          onTouchStart={start}
          className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] text-white shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 6l-4 6 4 6M15 6l4 6-4 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
