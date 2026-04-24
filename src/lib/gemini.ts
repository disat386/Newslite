import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  if (!key) {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isDevPreview = typeof window !== 'undefined' && window.location.hostname.includes('run.app');
    
    if (!isLocal && !isDevPreview) {
      throw new Error("NewsLite Error: GEMINI_API_KEY missing. If you've deployed this to your own domain, ensure VITE_GEMINI_API_KEY is set in your environment variables.");
    }
  }
  return key;
};

let genAI: GoogleGenAI | null = null;

export function getAI() {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return genAI;
}

export const models = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
  tts: "gemini-3.1-flash-tts-preview"
};

export async function generateText(prompt: string, systemInstruction?: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: models.flash,
    contents: prompt,
    config: {
      systemInstruction
    }
  });
  return response.text;
}

export async function generateJSON(prompt: string, schema: any, systemInstruction?: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: models.flash,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });
  return JSON.parse(response.text || "{}");
}
