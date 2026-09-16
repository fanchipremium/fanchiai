/**
 * Puter.js v2 AI Image Engine
 * Uses puter.ai.chat with Gemini image models and image-to-image workflows.
 */

export const PUTER_AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InYyIn0.eyJ0IjoidCIsInYiOiIyIiwidG9rZW5fdWlkIjoiODUxYjUxODgtNzY0MC00MjU0LTk2YTEtZWM5OTJmMGU3MzE0IiwidXUiOiJrR2p0NGkzalNJMjRpamM2M1R5WnVRPT0iLCJzdSI6IjV1R0kyR21VUVB1bHhkN2dhVWVvTVE9PSIsImFpIjoia0dqdDRpM2pTSTI0aWpjNjNUeVp1UT09IiwiZnVsbF9hY2Nlc3MiOnRydWUsImlhdCI6MTc4OTUyODk2MH0.ulTl_klS-1-Va8qPogHjblwOoNtDVyaNxurJ3sixCmw";

export function isPuterAvailable() {
  return typeof window !== "undefined" && Boolean(window.puter?.ai);
}

export function applyPuterAuth(puter) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("puter.auth.token", PUTER_AUTH_TOKEN);
    localStorage.setItem("puter_auth_token", PUTER_AUTH_TOKEN);
    localStorage.setItem("puter_token", PUTER_AUTH_TOKEN);
    sessionStorage.setItem("puter.auth.token", PUTER_AUTH_TOKEN);
    sessionStorage.setItem("puter_auth_token", PUTER_AUTH_TOKEN);
  } catch {}

  if (puter) {
    try {
      puter.authToken = PUTER_AUTH_TOKEN;
      if (typeof puter.setAuthToken === "function") {
        puter.setAuthToken(PUTER_AUTH_TOKEN);
      }
      if (puter.auth && typeof puter.auth.setToken === "function") {
        puter.auth.setToken(PUTER_AUTH_TOKEN);
      }
    } catch {}
  }
}

export async function ensurePuterLoaded(timeoutMs = 7000) {
  if (typeof window === "undefined") return null;
  applyPuterAuth(window.puter);

  if (window.puter?.ai) {
    applyPuterAuth(window.puter);
    return window.puter;
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.puter?.ai) {
        clearInterval(interval);
        applyPuterAuth(window.puter);
        resolve(window.puter);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        applyPuterAuth(window.puter);
        resolve(window.puter || null);
      }
    }, 100);
  });
}

function extractImageUrl(result) {
  if (!result) return null;

  // 1. Exact Puter.js structure: result.message.images[0].image_url.url
  if (result.message?.images && Array.isArray(result.message.images) && result.message.images.length > 0) {
    const first = result.message.images[0];
    if (first.image_url?.url) return first.image_url.url;
    if (first.url) return first.url;
    if (typeof first === "string") return first;
  }

  // 2. Direct images array on result
  if (result.images && Array.isArray(result.images) && result.images.length > 0) {
    const first = result.images[0];
    if (first.image_url?.url) return first.image_url.url;
    if (first.url) return first.url;
    if (typeof first === "string") return first;
  }

  // 3. Content containing image URL or Markdown or base64
  const content = result.message?.content || result.content;
  if (typeof content === "string") {
    if (content.startsWith("data:image/") || content.startsWith("http://") || content.startsWith("https://")) {
      return content.trim();
    }
    const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/) || content.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp))/i);
    if (mdMatch) return mdMatch[1];

    const b64Match = content.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
    if (b64Match) return b64Match[0];
  }

  // 4. HTML Image Element / src
  if (result.src) return result.src;
  if (result.url) return result.url;

  return null;
}

export async function generateWrapWithPuter(prompt, vehicleBase64, swatchUrl = null) {
  const puter = await ensurePuterLoaded();
  if (!puter || !puter.ai?.chat) {
    throw new Error("Puter AI is not available or not loaded yet.");
  }

  const candidateModels = [
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
    "black-forest-labs/flux.1-kontext-max",
    "flux-kontext",
    "dall-e-3"
  ];

  const fullImgUrl = vehicleBase64.startsWith("data:") 
    ? vehicleBase64 
    : `data:image/jpeg;base64,${vehicleBase64}`;

  let lastError = null;

  for (const model of candidateModels) {
    try {
      console.log(`[Puter AI] Generating wrap with model: ${model}`);

      // 1. Try multimodal messages format
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: fullImgUrl } },
            ...(swatchUrl ? [{ type: "image_url", image_url: { url: swatchUrl } }] : [])
          ]
        }
      ];

      try {
        const result = await puter.ai.chat(messages, { model });
        const img = extractImageUrl(result);
        if (img) {
          console.log(`[Puter AI] Wrap generated successfully via model ${model} (multimodal)`);
          return img;
        }
      } catch (chatArrErr) {
        console.warn(`[Puter AI] Multimodal array format failed on ${model}:`, chatArrErr);
      }

      // 2. Try direct text prompt format as shown in official Puter snippet
      try {
        const result = await puter.ai.chat(prompt, { model });
        const img = extractImageUrl(result);
        if (img) {
          console.log(`[Puter AI] Wrap generated successfully via model ${model} (text prompt)`);
          return img;
        }
      } catch (chatTextErr) {
        console.warn(`[Puter AI] Text format failed on ${model}:`, chatTextErr);
      }

      // 3. Try puter.ai.txt2img if available
      if (puter.ai.txt2img) {
        try {
          const imgResult = await puter.ai.txt2img(prompt, { model });
          const img = extractImageUrl(imgResult);
          if (img) return img;
        } catch (t2iErr) {
          console.warn(`[Puter AI] txt2img failed on ${model}:`, t2iErr);
        }
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Puter AI] Model ${model} failed:`, err);
    }
  }

  throw lastError || new Error("Failed to generate wrap visualization using Puter AI.");
}
