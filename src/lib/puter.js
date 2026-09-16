/**
 * Puter.js v2 Synchronization & AI Helper for FANCHI Wrap Studio
 */

export async function ensurePuterLoaded() {
  if (typeof window === "undefined") return null;
  if (window.puter) return window.puter;

  return new Promise((resolve) => {
    // Check if script already exists
    const existing = document.querySelector('script[src*="js.puter.com"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.onload = () => resolve(window.puter || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.puter || attempts > 20) {
          clearInterval(interval);
          resolve(window.puter || null);
        }
      }, 100);
    }
  });
}

export async function generateWrapWithPuter(prompt, imageBase64, swatchUrl = null) {
  const puter = await ensurePuterLoaded();
  if (!puter || !puter.ai || !puter.ai.txt2img) {
    return null;
  }

  // If puter auth is available and user is not signed in, do not trigger interactive popup modal
  if (typeof puter.auth?.isSignedIn === "function") {
    try {
      const signedIn = puter.auth.isSignedIn();
      if (!signedIn) {
        console.log("[Puter AI] User not logged in to Puter, skipping client modal to keep generation automatic");
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  // Clean base64 string
  let cleanB64 = imageBase64;
  if (cleanB64.includes(",") && cleanB64.trim().startsWith("data:")) {
    cleanB64 = cleanB64.split(",")[1];
  }

  const modelsToTry = [
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview",
    "black-forest-labs/flux.1-kontext-max"
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`[Puter AI] Generating wrap using model: ${model}`);
      const options = {
        model,
        input_image: cleanB64,
        input_image_mime_type: "image/jpeg"
      };

      const result = await puter.ai.txt2img(prompt, options);
      if (result) {
        if (typeof result === "string") return result;
        if (result.src) return result.src;
        if (result instanceof HTMLImageElement) return result.src;
      }
    } catch (err) {
      console.warn(`[Puter AI] Model ${model} failed:`, err);
    }
  }

  return null;
}
