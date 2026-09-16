import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const catalogDataPath = path.join(_dirname, 'src', 'data', 'catalog_data.json');
  const catalogMetaPath = path.join(_dirname, 'src', 'data', 'catalog_meta.json');

  app.get('/api/', (req, res) => {
    res.json({ message: "FANCHI AI Wrap Studio API" });
  });

  app.get('/api/catalog', async (req, res) => {
    try {
      const data = await fs.readFile(catalogDataPath, 'utf8');
      res.json({ products: JSON.parse(data) });
    } catch (err) {
      res.status(500).json({ error: "Failed to load catalog data" });
    }
  });

  app.get('/api/catalog/meta', async (req, res) => {
    try {
      const data = await fs.readFile(catalogMetaPath, 'utf8');
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: "Failed to load catalog meta" });
    }
  });

  app.post('/api/catalog/sync', async (req, res) => {
    try {
      const data = await fs.readFile(catalogMetaPath, 'utf8');
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: "Failed to load catalog meta" });
    }
  });

  const FINISH_INTERPRETATION = {
    "GLOSSY": "Must have a high-gloss, highly reflective, mirror-like clear coat surface with sharp, distinct reflections and strong specular highlights.",
    "MATTE": "Must have a completely flat, non-reflective surface with soft, diffused lighting and no sharp reflections or gloss.",
    "SATIN": "Must have a semi-gloss, smooth silk-like surface with diffused, blurred reflections and a soft sheen.",
    "METALLIC": "Must have visible metallic flakes embedded in the paint, sparkling under direct light with a rich, deep color flop.",
    "COLOR SHIFT": "Must show a chameleon color-shifting effect where the color changes distinctly depending on the viewing angle and lighting.",
    "CHROME": "Must look like liquid metal with extreme mirror-like reflectivity, showing clear, undistorted reflections of the surrounding environment.",
    "CANDY": "Must have an incredibly deep, wet-look glossy finish with intense, vibrant, translucent color over a metallic base."
  };

  function buildPrompt(p) {
    const finishNote = FINISH_INTERPRETATION[p.finish?.toUpperCase()] || "Visual surface characteristics must follow the selected FANCHI material and finish.";
    
    return `Edit the uploaded vehicle photo to visualize the exact vehicle wrapped with the selected FANCHI automotive wrapping material and color.

SELECTED FANCHI PRODUCT
- Product: ${p.name}
- Color name: ${p.color_name}
- Color code: ${p.color_code}
- Material: ${p.material}
- Finish: ${p.finish}

MATERIAL / FINISH INTERPRETATION
${finishNote}

A second reference image (the FANCHI product swatch) may be provided. If present, use it ONLY as a reference for the exact color, material texture, finish and surface behaviour to apply — do not copy its shape or composition; apply that material onto the vehicle in the first image.

Preserve the exact vehicle identity, model, body shape, proportions, body lines, panels, bumpers, hood, fenders, doors, headlights, taillights, grille, wheels, tires, windows, mirrors, interior visibility, camera angle, perspective, position, environment, background, shadows, lighting and composition.

Only modify the exterior painted body surfaces to represent the selected FANCHI wrapping material and finish. Apply the selected FANCHI color and material realistically across the vehicle body, including realistic reflections, highlights, texture and surface characteristics appropriate to the selected material.

Do not redesign the vehicle. Do not change the wheels. Do not change the body kit. Do not change the background. Do not change the camera angle. Do not add objects. Do not remove objects. Do not alter the vehicle proportions. Do not apply a flat color overlay.

The final image must look like the exact same vehicle in the uploaded photograph after professional FANCHI sticker wrapping installation.`;
  }

  async function fetchImageB64(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } catch (e) {
      return null;
    }
  }

  app.post('/api/generate-wrap', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ code: "config", message: "AI engine is not configured." });
    }

    try {
      const { image_base64, product } = req.body;
      let imgB64 = image_base64;
      if (imgB64.includes(',') && imgB64.trim().startsWith('data:')) {
        imgB64 = imgB64.split(',')[1];
      }

      const prompt = buildPrompt(product);
      const parts = [];
      
      parts.push({ inlineData: { data: imgB64, mimeType: "image/jpeg" } });

      if (product.swatch_image) {
        const swatchB64 = await fetchImageB64(product.swatch_image);
        if (swatchB64) {
          parts.push({ inlineData: { data: swatchB64, mimeType: "image/jpeg" } });
        }
      }

      parts.push({ text: prompt });

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts },
      });

      let generatedImage = null;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            generatedImage = `data:${mimeType};base64,${base64EncodeString}`;
            break;
          }
        }
      }

      if (!generatedImage) {
        return res.status(502).json({ code: "no_image", message: "Unable to generate your FANCHI wrap visual right now. Please try again." });
      }

      res.json({
        image: generatedImage,
        product: product
      });

    } catch (e: any) {
      console.error(e);
      const emsg = String(e).toLowerCase();
      if (['429', 'rate', 'overload', 'quota', 'unavailable', '503', 'busy', 'capacity', 'budget'].some(k => emsg.includes(k))) {
        return res.status(503).json({ code: "busy", message: "FANCHI AI is currently busy. Please try again in a moment." });
      }
      res.status(500).json({ code: "general", message: "Unable to generate your FANCHI wrap visual right now. Please try again." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
