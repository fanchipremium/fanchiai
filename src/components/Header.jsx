import { RotateCcw } from "lucide-react";

const LOGO = "https://customer-assets-eiarnc6j.emergentagent.net/job_car-wrap-studio-5/artifacts/qkg4r0xj_Logo%20FanFAN%202023.webp";

export default function Header({ onReset }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3" data-testid="fanchi-text-logo">
          <img src={LOGO} alt="FANCHI" className="h-9 w-auto sm:h-11" />
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] sm:inline">
            AI Wrap Studio
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            data-testid="reset-studio-button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-[var(--accent)] hover:text-white"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
