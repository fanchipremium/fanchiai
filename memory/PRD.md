# FANCHI AI Car Wrap Visualizer — PRD

## Original Problem Statement
Build a web app where a user uploads a photo of their car, gives photo consent, selects a FANCHI vinyl wrapping product from a catalog (name, color, color code, material PET/TPU/PVC, finish), and generates a realistic visualization of the SAME car wrapped in that FANCHI material using GOOGLE GEMINI as the image-editing engine. Show ORIGINAL vs WRAPPED (Before/After), allow TRY ANOTHER COLOR (reuse same photo, no re-upload), and DOWNLOAD. Gemini API key must be server-side only. Exact error messages required. No dummy images as substitute for Gemini output.

## Architecture
- Frontend: React (CRA + Tailwind + shadcn/ui, framer-motion, lucide, sonner). Single-page studio.
- Backend: FastAPI, all routes under /api.
- AI engine: Google Gemini image editing via Emergent Universal Key (emergentintegrations LlmChat), model `gemini-3.1-flash-image-preview`. Key stored server-side in backend/.env (EMERGENT_LLM_KEY).
- DB: MongoDB (currently only used minimally; catalog is static in backend/catalog.py).

## User Choices
- Google Gemini via Emergent Universal Key.
- Catalog: built realistic demo catalog based on fanchi.id product families (URL wasn't crawlable).
- No login (auth was added then removed per user request "tidak usah pakai login").
- Branding: FANCHI bunny logo (user-provided) + dark automotive studio theme, red accent.

## Implemented (2026-06)
- GET /api/catalog — 12 FANCHI products with material/finish/color code + swatch gradients.
- POST /api/generate-wrap — builds material-aware Gemini prompt from problem statement, sends user car photo + prompt to Gemini, returns wrapped image data-uri. Structured error codes: busy (503) / general (500) with exact user-facing messages.
- Frontend studio: drag&drop upload + preview + remove, photo consent checkbox (gates Generate), catalog with search + material/finish filters + swatch cards, Generate Visual button, Before/After slider + side-by-side toggle, Try Another Color (reuses photo), Download, exact error states with retry.
- FANCHI logo in header, "Powered by Google Gemini" indicator.

## Verified
- /api/catalog 200 with products.
- /api/generate-wrap returned a real Gemini-edited wrapped car image (manual test, 200).
- Frontend renders; upload/consent/select gating works; error state renders exact message.

## Known Issues / Notes
- Catalog imported LIVE from fanchi.id/katalog-produk: 454 real products across 29 series with real product/swatch photos, color codes, material (PET/TPU/PVC) and finish. Stored in /app/backend/catalog_data.json (loaded by catalog.py; demo list kept only as fallback).
- Emergent Universal Key balance was exhausted during automated testing (max budget 0.4 reached). Generation will return the "busy" error until balance is topped up (Profile → Manage plan → Universal Key → Add Balance).
- Catalog is static demo data (fanchi.id was not reachable to import real catalog).

## Backlog (P1/P2)
- Import real FANCHI catalog (API/CSV) with official swatch images.
- Optional: save/share generated wraps; multi-angle inputs; distinct quota vs busy error message; base64 input validation for fast 400s.
