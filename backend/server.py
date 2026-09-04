from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import base64
import asyncio
import logging
import requests
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from catalog import FANCHI_CATALOG, FINISH_INTERPRETATION
import fanchi_sync

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')  # user's own Google Gemini key (server-side only)
GEMINI_IMAGE_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-3.1-flash-image')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')  # user's own OpenAI key (server-side only)
OPENAI_IMAGE_MODEL = os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-image-1')
AI_ENGINE = os.environ.get('AI_ENGINE', 'openai').lower()  # openai | gemini | emergent

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class WrapProduct(BaseModel):
    id: str
    name: str
    color_name: str
    color_code: str
    material: str
    finish: str
    gradient_css: Optional[str] = None


class GenerateWrapRequest(BaseModel):
    image_base64: str
    product: WrapProduct


def build_prompt(p: WrapProduct) -> str:
    finish_note = FINISH_INTERPRETATION.get(
        p.finish.upper(),
        "Visual surface characteristics must follow the selected FANCHI material and finish.",
    )
    return f"""Edit the uploaded vehicle photo to visualize the exact vehicle wrapped with the selected FANCHI automotive wrapping material and color.

SELECTED FANCHI PRODUCT
- Product: {p.name}
- Color name: {p.color_name}
- Color code: {p.color_code}
- Material: {p.material}
- Finish: {p.finish}

MATERIAL / FINISH INTERPRETATION
{finish_note}

Preserve the exact vehicle identity, model, body shape, proportions, body lines, panels, bumpers, hood, fenders, doors, headlights, taillights, grille, wheels, tires, windows, mirrors, interior visibility, camera angle, perspective, position, environment, background, shadows, lighting and composition.

Only modify the exterior painted body surfaces to represent the selected FANCHI wrapping material and finish. Apply the selected FANCHI color and material realistically across the vehicle body, including realistic reflections, highlights, texture and surface characteristics appropriate to the selected material.

Do not redesign the vehicle. Do not change the wheels. Do not change the body kit. Do not change the background. Do not change the camera angle. Do not add objects. Do not remove objects. Do not alter the vehicle proportions. Do not apply a flat color overlay.

The final image must look like the exact same vehicle in the uploaded photograph after professional FANCHI sticker wrapping installation."""


@api_router.get("/")
async def root():
    return {"message": "FANCHI AI Wrap Studio API"}


@api_router.get("/catalog")
async def get_catalog():
    return {"products": FANCHI_CATALOG}


def _openai_edit(prompt: str, img_bytes: bytes):
    """Call OpenAI gpt-image-1 image edit with the user's own key (server-side)."""
    r = requests.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        data={"model": OPENAI_IMAGE_MODEL, "size": "1024x1024", "n": "1"},
        files={"image": ("car.png", img_bytes, "image/png"), "prompt": (None, prompt)},
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"{r.status_code} {r.text[:300]}")
    d = r.json()
    item = (d.get("data") or [{}])[0]
    b64 = item.get("b64_json")
    if b64:
        return "image/png", b64
    return None, None


def _gemini_direct(prompt: str, img_b64: str):
    """Call Google Gemini image API directly with the user's own key (server-side)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_IMAGE_MODEL}:generateContent"
    body = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
        ]}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }
    r = requests.post(
        url,
        headers={"Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY},
        json=body,
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"{r.status_code} {r.text[:300]}")
    d = r.json()
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    for p in parts:
        inl = p.get("inlineData") or p.get("inline_data")
        if inl and inl.get("data"):
            mime = inl.get("mimeType") or inl.get("mime_type") or "image/png"
            return mime, inl["data"]
    return None, None


@api_router.get("/catalog/meta")
async def catalog_meta():
    return fanchi_sync.get_meta()


@api_router.post("/catalog/sync")
async def catalog_sync():
    try:
        meta = await asyncio.to_thread(fanchi_sync.sync_catalog)
    except Exception as e:
        logger.error("Catalog sync failed: %s", str(e)[:200])
        raise HTTPException(status_code=502, detail={"code": "sync_failed", "message": "Gagal sinkron katalog FANCHI. Coba lagi."})
    # reload in-memory catalog
    import catalog as _cat
    _cat.FANCHI_CATALOG = _cat._load_catalog()
    global FANCHI_CATALOG
    FANCHI_CATALOG = _cat.FANCHI_CATALOG
    return meta


@api_router.post("/generate-wrap")
async def generate_wrap(req: GenerateWrapRequest):
    if not (OPENAI_API_KEY or GEMINI_API_KEY or EMERGENT_LLM_KEY):
        raise HTTPException(status_code=500, detail={"code": "config", "message": "AI engine is not configured."})

    img_b64 = req.image_base64
    if "," in img_b64 and img_b64.strip().startswith("data:"):
        img_b64 = img_b64.split(",", 1)[1]

    prompt = build_prompt(req.product)

    # Engine priority: explicit AI_ENGINE, else first available key.
    engine = AI_ENGINE
    if engine == "openai" and not OPENAI_API_KEY:
        engine = "gemini" if GEMINI_API_KEY else "emergent"
    if engine == "gemini" and not GEMINI_API_KEY:
        engine = "openai" if OPENAI_API_KEY else "emergent"

    try:
        if engine == "openai":
            img_bytes = base64.b64decode(img_b64)
            mime, data = await asyncio.to_thread(_openai_edit, prompt, img_bytes)
        elif engine == "gemini":
            mime, data = await asyncio.to_thread(_gemini_direct, prompt, img_b64)
        else:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"fanchi-{uuid.uuid4()}",
                system_message="You are a professional automotive vinyl wrap visualizer.",
            )
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
            msg = UserMessage(text=prompt, file_contents=[ImageContent(img_b64)])
            _text, images = await chat.send_message_multimodal_response(msg)
            if images:
                mime, data = images[0]["mime_type"], images[0]["data"]
            else:
                mime, data = None, None

        if not data:
            logger.warning("AI engine returned no image (engine=%s).", engine)
            raise HTTPException(
                status_code=502,
                detail={"code": "no_image", "message": "Unable to generate your FANCHI wrap visual right now. Please try again."},
            )

        return {
            "image": f"data:{mime};base64,{data}",
            "product": req.product.model_dump(),
        }

    except HTTPException:
        raise
    except Exception as e:
        emsg = str(e).lower()
        logger.error("Generation error (engine=%s): %s", engine, str(e)[:300])
        if any(k in emsg for k in ["429", "rate", "overload", "quota", "unavailable", "503", "busy", "capacity", "no credits", "billing"]):
            raise HTTPException(
                status_code=503,
                detail={"code": "busy", "message": "FANCHI AI is currently busy. Please try again in a moment."},
            )
        raise HTTPException(
            status_code=500,
            detail={"code": "general", "message": "Unable to generate your FANCHI wrap visual right now. Please try again."},
        )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_catalog():
    try:
        fanchi_sync.ensure_meta()
    except Exception as e:
        logger.warning("ensure_meta failed: %s", str(e)[:120])

    async def _auto_sync_loop():
        while True:
            await asyncio.sleep(fanchi_sync.SYNC_INTERVAL_HOURS * 3600)
            try:
                await asyncio.to_thread(fanchi_sync.sync_catalog)
                import catalog as _cat
                _cat.FANCHI_CATALOG = _cat._load_catalog()
                global FANCHI_CATALOG
                FANCHI_CATALOG = _cat.FANCHI_CATALOG
                logger.info("Auto catalog sync complete.")
            except Exception as e:
                logger.warning("Auto sync failed: %s", str(e)[:120])

    asyncio.create_task(_auto_sync_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
