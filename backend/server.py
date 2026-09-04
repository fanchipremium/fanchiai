from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import requests
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from catalog import FANCHI_CATALOG, FINISH_INTERPRETATION
import fanchi_sync

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')  # user's own OpenAI key (server-side only)
OPENAI_IMAGE_MODEL = os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-6-astra')

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


def _openai_edit(prompt: str, img_b64: str):
    """Edit car photo via OpenAI Responses API + image_generation tool."""
    body = {
        "model": OPENAI_IMAGE_MODEL,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"data:image/jpeg;base64,{img_b64}"},
            ],
        }],
        "tools": [{"type": "image_generation", "input_fidelity": "high"}],
    }
    r = requests.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json=body,
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"{r.status_code} {r.text[:300]}")
    d = r.json()
    for out in d.get("output", []):
        if out.get("type") == "image_generation_call" and out.get("result"):
            return "image/png", out["result"]
    return None, None


@api_router.get("/")
async def root():
    return {"message": "FANCHI AI Wrap Studio API"}


@api_router.get("/catalog")
async def get_catalog():
    return {"products": FANCHI_CATALOG}


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
    import catalog as _cat
    _cat.FANCHI_CATALOG = _cat._load_catalog()
    global FANCHI_CATALOG
    FANCHI_CATALOG = _cat.FANCHI_CATALOG
    return meta


@api_router.post("/generate-wrap")
async def generate_wrap(req: GenerateWrapRequest):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail={"code": "config", "message": "AI engine is not configured."})

    img_b64 = req.image_base64
    if "," in img_b64 and img_b64.strip().startswith("data:"):
        img_b64 = img_b64.split(",", 1)[1]

    prompt = build_prompt(req.product)

    try:
        mime, data = await asyncio.to_thread(_openai_edit, prompt, img_b64)

        if not data:
            logger.warning("OpenAI returned no image.")
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
        logger.error("Generation error (openai): %s", str(e)[:300])
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
