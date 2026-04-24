import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  if (!key) {
    console.warn("GEMINI_API_KEY is not defined in the environment.");
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
