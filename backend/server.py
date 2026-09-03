from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from catalog import FANCHI_CATALOG, FINISH_INTERPRETATION

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

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


@api_router.post("/generate-wrap")
async def generate_wrap(req: GenerateWrapRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail={"code": "config", "message": "AI engine is not configured."})

    img_b64 = req.image_base64
    if "," in img_b64 and img_b64.strip().startswith("data:"):
        img_b64 = img_b64.split(",", 1)[1]

    prompt = build_prompt(req.product)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"fanchi-{uuid.uuid4()}",
            system_message="You are a professional automotive vinyl wrap visualizer.",
        )
        chat.with_model("gemini", GEMINI_IMAGE_MODEL).with_params(modalities=["image", "text"])

        msg = UserMessage(text=prompt, file_contents=[ImageContent(img_b64)])
        text, images = await chat.send_message_multimodal_response(msg)

        if not images:
            logger.warning("Gemini returned no image. Text: %s", (text or "")[:120])
            raise HTTPException(
                status_code=502,
                detail={"code": "no_image", "message": "Unable to generate your FANCHI wrap visual right now. Please try again."},
            )

        out = images[0]
        return {
            "image": f"data:{out['mime_type']};base64,{out['data']}",
            "product": req.product.model_dump(),
        }

    except HTTPException:
        raise
    except Exception as e:
        emsg = str(e).lower()
        logger.error("Gemini generation error: %s", str(e)[:300])
        if any(k in emsg for k in ["429", "rate", "overload", "quota", "unavailable", "503", "busy", "capacity"]):
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
