import { useRef } from "react";
import { Upload, Camera, X, ImageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function UploadPanel({ preview, onFile, onRemove, consent, setConsent }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onFile(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-xs font-bold">1</span>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Upload Car Photo</h2>
      </div>

      {!preview ? (
        <div className="flex flex-col gap-3">
          <div
            data-testid="car-photo-upload-dropzone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-highlight)] bg-[var(--bg-surface)] px-6 py-10 text-center transition-colors hover:border-[var(--accent)]"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-slate-400 transition-colors group-hover:text-[var(--accent)]">
              <Upload size={22} />
            </div>
            <p className="font-semibold text-white">photo, drag & drop your car</p>
            <p className="mt-1 text-sm text-slate-400">or click to browse from gallery — JPG / PNG</p>
            <input
              ref={inputRef}
              data-testid="car-photo-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="camera-upload-button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-highlight)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-white transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-surface)] active:scale-[0.99]"
            >
              <Camera size={16} className="text-[var(--accent)]" />
              <span>Gunakan Kamera HP / Take Photo</span>
            </button>
            <input
              ref={cameraInputRef}
              data-testid="car-camera-file-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <img src={preview} alt="Uploaded car" className="h-52 w-full object-cover" />
          <button
            data-testid="remove-photo-button"
            onClick={onRemove}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-[var(--accent)]"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <ImageIcon size={12} /> Original photo ready
          </div>
        </div>
      )}

      <label
        htmlFor="consent"
        className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 transition-colors hover:border-[var(--border-highlight)]"
      >
        <Checkbox
          id="consent"
          data-testid="photo-consent-checkbox"
          checked={consent}
          onCheckedChange={(v) => setConsent(!!v)}
          className="mt-0.5 border-[var(--border-highlight)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]"
        />
        <span className="text-sm text-slate-300">
          I consent to my uploaded photo being processed by FANCHI AI to generate a wrap visualization.
        </span>
      </label>
    </div>
  );
}
