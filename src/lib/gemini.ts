import { GoogleGenAI, Type } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const models = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
  tts: "gemini-3.1-flash-tts-preview"
};

export async function generateText(prompt: string, systemInstruction?: string) {
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
