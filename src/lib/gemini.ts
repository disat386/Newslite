import { GoogleGenAI } from "@google/genai";
import { geminiKeyService } from '../services/geminiKeyService';

export const models = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
  tts: "gemini-3.1-flash-tts-preview",
  flash15: "gemini-1.5-flash"
};

export async function generateText(prompt: string, systemInstruction?: string) {
  return geminiKeyService.executeWithRotation(async (ai: any) => {
    const response = await ai.models.generateContent({
      model: models.flash,
      contents: prompt,
      config: {
        systemInstruction
      }
    });
    return response.text;
  });
}

export async function generateJSON(prompt: string, schema: any, systemInstruction?: string) {
  return geminiKeyService.executeWithRotation(async (ai: any) => {
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
  });
}

export async function generateAudio(prompt: string, voiceName: string, tone: string, speed: number, language: string) {
  return geminiKeyService.executeWithRotation(async (ai: any) => {
    // Step 1: Generate Script
    const scriptResponse = await ai.models.generateContent({
      model: models.flash,
      contents: `Generate a high-quality news report script in ${language} based on this: ${prompt}. Make it professional. Tone: ${tone}.`,
    });
    const script = scriptResponse.text;

    // Step 2: Generate Audio
    const audioResponse = await ai.models.generateContent({
      model: models.tts,
      contents: `Tone: ${tone}. Speed: ${speed}x. Script in ${language}: ${script}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });
    return audioResponse; // Return the whole response because it contains the audio data
  });
}

export async function getAI() {
  const key = await geminiKeyService.getNextKey();
  return new GoogleGenAI({ apiKey: key });
}

