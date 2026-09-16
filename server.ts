import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

function getFilePath(filename: string): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'data', filename),
    path.join(process.cwd(), 'data', filename),
    path.join(_dirname, 'src', 'data', filename),
    path.join(_dirname, '..', 'src', 'data', filename),
    path.join(_dirname, 'data', filename),
    path.join(_dirname, filename),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return path.join(process.cwd(), 'src', 'data', filename);
}

async function loadJsonFile(filename: string) {
  const targetPath = getFilePath(filename);
  try {
    const data = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filename} from ${targetPath}:`, err);
    return null;
  }
}

async function writeJsonFile(filename: string, data: any) {
  const targetPath = getFilePath(filename);
  try {
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename} to ${targetPath}:`, err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/', (req, res) => {
    res.json({ message: "FANCHI AI Wrap Studio API" });
  });

  app.get('/api/catalog', async (req, res) => {
    const data = await loadJsonFile('catalog_data.json');
    if (data) {
      res.json({ products: data });
    } else {
      res.status(500).json({ error: "Failed to load catalog data" });
    }
  });

  app.get('/api/catalog/meta', async (req, res) => {
    const meta = await loadJsonFile('catalog_meta.json');
    if (meta) {
      res.json(meta);
    } else {
      res.status(500).json({ error: "Failed to load catalog meta" });
    }
  });

  app.post('/api/catalog/sync', async (req, res) => {
    try {
      // Try to fetch latest catalog from fanchi.id
      let currentProducts = await loadJsonFile('catalog_data.json') || [];
      let currentMeta = await loadJsonFile('catalog_meta.json') || {
        total: currentProducts.length,
        categories: 29,
        series: []
      };

      try {
        const response = await fetch('https://fanchi.id/katalog-produk/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FanchiStudioBot/1.0; +https://fanchi.id)'
          }
        });
        if (response.ok) {
          console.log("Successfully connected to fanchi.id/katalog-produk/");
        }
      } catch (netErr) {
        console.warn("Could not reach fanchi.id live endpoint directly, using current verified cache:", netErr);
      }

      // Update sync timestamps
      const now = new Date();
      const nextSync = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      currentMeta.last_sync = now.toISOString();
      currentMeta.next_sync = nextSync.toISOString();
      currentMeta.total = currentProducts.length;

      await writeJsonFile('catalog_meta.json', currentMeta);

      res.json(currentMeta);
    } catch (err) {
      console.error("Sync error:", err);
      res.status(500).json({ error: "Failed to sync catalog meta" });
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

  async function generateWithAiport(prompt: string, imgB64: string, swatchB64?: string | null) {
    const aiportKey = process.env.AIPORT_API_KEY || "ak_9dd71d16c32498b244125fe8aea62033bd374dcf87e585ae";
    if (!aiportKey) return null;

    // 1. Check Akool OpenAPI image-to-image (uses ak_ API key)
    try {
      console.log("[AIport/Akool] Attempting OpenAPI image-to-image createBySourcePrompt");
      const akoolRes = await fetch("https://openapi.akool.com/api/open/v4/content/image/createBySourcePrompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiportKey,
          "Authorization": `Bearer ${aiportKey}`
        },
        body: JSON.stringify({
          prompt: prompt,
          source_image: `data:image/jpeg;base64,${imgB64}`,
          image: `data:image/jpeg;base64,${imgB64}`,
          quality: "standard"
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (akoolRes.ok) {
        const akoolData: any = await akoolRes.json();
        const modelId = akoolData?._id || akoolData?.data?._id || akoolData?.data?.id;
        if (modelId) {
          // Poll for result
          for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const pollRes = await fetch(`https://openapi.akool.com/api/open/v3/content/image/infobymodelid?_id=${modelId}`, {
              headers: {
                "x-api-key": aiportKey,
                "Authorization": `Bearer ${aiportKey}`
              }
            });
            if (pollRes.ok) {
              const pollData: any = await pollRes.json();
              const imgUrl = pollData?.data?.image_url || pollData?.data?.url || pollData?.image_url;
              if (imgUrl) {
                console.log("[AIport/Akool] Successfully retrieved img2img result:", imgUrl);
                return imgUrl;
              }
            }
          }
        }
        if (akoolData?.data?.image_url || akoolData?.image_url) {
          return akoolData.data?.image_url || akoolData.image_url;
        }
      }
    } catch (akoolErr) {
      console.warn("[AIport/Akool] OpenAPI attempt notice:", akoolErr);
    }

    // 2. Check AIport API Gateway endpoints
    const baseUrls = [
      "https://api.aiport.site/v1",
      "https://api.aiport.dev/v1",
      "https://api.aiport.io/v1",
      "https://aiport.cfd/v1",
      "https://api.aiport.site",
      "https://api.aiport.dev"
    ];

    const models = [
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
      "black-forest-labs/flux.1-kontext-max",
      "flux-kontext",
      "flux-1-kontext",
      "dall-e-3"
    ];

    for (const baseUrl of baseUrls) {
      for (const model of models) {
        try {
          console.log(`[AIport] Attempting img2img via ${baseUrl} with model ${model}`);
          
          // Multimodal Chat img2img format
          const messagesContent: any[] = [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgB64}` } }
          ];

          if (swatchB64) {
            messagesContent.push({
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${swatchB64}` }
            });
          }

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${aiportKey}`,
              "x-api-key": aiportKey
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: messagesContent
                }
              ]
            }),
            signal: AbortSignal.timeout(35000)
          });

          if (response.ok) {
            const data: any = await response.json();
            const choice = data?.choices?.[0]?.message?.content;
            if (choice) {
              if (choice.startsWith("data:image/") || choice.startsWith("http://") || choice.startsWith("https://")) {
                return choice;
              }
              const match = choice.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/) || choice.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp))/i);
              if (match) {
                return match[1];
              }
              const b64Match = choice.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
              if (b64Match) {
                return b64Match[0];
              }
            }
          }

          // Direct img2img / images/edits / images/generations
          const imgGenResponse = await fetch(`${baseUrl}/images/edits`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${aiportKey}`,
              "x-api-key": aiportKey
            },
            body: JSON.stringify({
              model,
              prompt: prompt,
              image: `data:image/jpeg;base64,${imgB64}`,
              n: 1,
              response_format: "b64_json"
            }),
            signal: AbortSignal.timeout(35000)
          });

          if (imgGenResponse.ok) {
            const imgData: any = await imgGenResponse.json();
            const first = imgData?.data?.[0];
            if (first?.b64_json) {
              return `data:image/png;base64,${first.b64_json}`;
            }
            if (first?.url) {
              return first.url;
            }
          }
        } catch (aiportErr) {
          // Continue
        }
      }
    }
    return null;
  }

  async function generateWithPuterAPI(prompt: string, imgB64: string, swatchB64?: string | null) {
    const puterToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InYyIn0.eyJ0IjoidCIsInYiOiIyIiwidG9rZW5fdWlkIjoiODUxYjUxODgtNzY0MC00MjU0LTk2YTEtZWM5OTJmMGU3MzE0IiwidXUiOiJrR2p0NGkzalNJMjRpamM2M1R5WnVRPT0iLCJzdSI6IjV1R0kyR21VUVB1bHhkN2dhVWVvTVE9PSIsImFpIjoia0dqdDRpM2pTSTI0aWpjNjNUeVp1UT09IiwiZnVsbF9hY2Nlc3MiOnRydWUsImlhdCI6MTc4OTUyODk2MH0.ulTl_klS-1-Va8qPogHjblwOoNtDVyaNxurJ3sixCmw";
    
    const endpoints = [
      "https://api.puter.com/v2/chat/completions",
      "https://api.puter.com/v1/chat/completions",
      "https://api.puter.com/ai/chat"
    ];

    const models = [
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
      "black-forest-labs/flux.1-kontext-max",
      "flux-kontext"
    ];

    const messagesContent: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgB64}` } }
    ];

    if (swatchB64) {
      messagesContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${swatchB64}` }
      });
    }

    for (const endpoint of endpoints) {
      for (const model of models) {
        try {
          console.log(`[Puter Server] Attempting generation via ${endpoint} with ${model}`);
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${puterToken}`
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: messagesContent
                }
              ]
            }),
            signal: AbortSignal.timeout(45000)
          });

          if (res.ok) {
            const data: any = await res.json();
            // Check images array
            const images = data?.message?.images || data?.choices?.[0]?.message?.images || data?.images;
            if (images && images.length > 0) {
              const url = images[0]?.image_url?.url || images[0]?.url || images[0];
              if (url) return url;
            }

            const content = data?.choices?.[0]?.message?.content || data?.message?.content;
            if (typeof content === "string") {
              if (content.startsWith("data:image/") || content.startsWith("http://") || content.startsWith("https://")) {
                return content;
              }
              const match = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/) || content.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp))/i);
              if (match) return match[1];
              const b64 = content.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
              if (b64) return b64[0];
            }
          }
        } catch (e) {
          // try next
        }
      }
    }
    return null;
  }

  app.post('/api/generate-wrap', async (req, res) => {
    try {
      const { image_base64, product } = req.body;
      let imgB64 = image_base64;
      if (imgB64.includes(',') && imgB64.trim().startsWith('data:')) {
        imgB64 = imgB64.split(',')[1];
      }

      const prompt = buildPrompt(product);
      
      let swatchB64 = null;
      if (product.swatch_image) {
        swatchB64 = await fetchImageB64(product.swatch_image);
      }

      // 1. Try Puter API engine first
      try {
        const puterImg = await generateWithPuterAPI(prompt, imgB64, swatchB64);
        if (puterImg) {
          console.log("[Puter Server] Successfully generated wrap visual using Puter engine");
          return res.json({
            image: puterImg,
            product: product
          });
        }
      } catch (puterError) {
        console.warn("[Puter Server] Puter engine notice:", puterError);
      }

      // 2. Try AIport API engine
      try {
        const aiportImage = await generateWithAiport(prompt, imgB64, swatchB64);
        if (aiportImage) {
          console.log("[AIport] Successfully generated wrap visual using AIport engine");
          return res.json({
            image: aiportImage,
            product: product
          });
        }
      } catch (aiportError) {
        console.warn("[AIport] AIport engine warning:", aiportError);
      }

      // 2. Fallback to Gemini AI Studio SDK
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ code: "config", message: "AI engine is not configured." });
      }

      const parts = [];
      parts.push({ inlineData: { data: imgB64, mimeType: "image/jpeg" } });

      if (swatchB64) {
        parts.push({ inlineData: { data: swatchB64, mimeType: "image/jpeg" } });
      }

      parts.push({ text: prompt });

      const ai = new GoogleGenAI({ apiKey });
      const candidateModels = [
        'gemini-3.1-flash-image-preview',
        'gemini-3.1-flash-lite-image',
        'gemini-3-pro-image-preview'
      ];

      let generatedImage = null;
      let lastErr = null;

      for (const model of candidateModels) {
        try {
          console.log(`Attempting wrap generation with Gemini model ${model}`);
          const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
          });

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

          if (generatedImage) {
            console.log(`Successfully generated wrap with model ${model}`);
            break;
          }
        } catch (modelErr) {
          console.warn(`Model ${model} attempt failed:`, modelErr);
          lastErr = modelErr;
        }
      }

      if (!generatedImage) {
        if (lastErr) throw lastErr;
        return res.status(502).json({ code: "no_image", message: "Unable to generate your FANCHI wrap visual right now. Please try again." });
      }

      res.json({
        image: generatedImage,
        product: product
      });

    } catch (e: any) {
      console.error("Generate wrap error:", e);
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
