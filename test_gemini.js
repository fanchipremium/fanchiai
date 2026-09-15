import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-lite-image',
      input: [{ type: "text", text: "hello" }],
      response_modalities: ['image', 'text'],
    });
    console.log("Success");
  } catch (e) {
    console.error("ERROR:");
    console.error(e);
  }
}
test();
