import { GoogleGenAI, Type } from "@google/genai";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

let dynamicApiKey: string | null = null;

const getApiKey = async () => {
  // 1. Check process.env (Server/Vite)
  const envKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey) return envKey;

  // 2. Check Cache
  if (dynamicApiKey) return dynamicApiKey;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('auurio_gemini_key');
    if (cached) {
      dynamicApiKey = cached;
      return cached;
    }
  }

  // 3. Fetch from Hub (Firestore config)
  try {
    const configRef = doc(db, 'config', 'settings');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      const hubKey = data.geminiApiKey || data.apiKey;
      if (hubKey) {
        dynamicApiKey = hubKey;
        if (typeof window !== 'undefined') {
          localStorage.setItem('auurio_gemini_key', hubKey);
        }
        return hubKey;
      }
    }
  } catch (error) {
    console.error("Hub Key Sync Error:", error);
  }

  // 4. Fallback/Error
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isDevPreview = typeof window !== 'undefined' && window.location.hostname.includes('run.app');
  
  if (!isLocal && !isDevPreview) {
    throw new Error("NewsLite Error: Protocol Offline. GEMINI_API_KEY missing in Hub and environment. Ensure your Admin Panel has set the API key in config/settings.");
  }
  
  return '';
};

let genAI: GoogleGenAI | null = null;

export async function getAI() {
  if (!genAI) {
    const key = await getApiKey();
    if (!key) throw new Error("GEMINI_API_KEY is not available.");
    genAI = new GoogleGenAI({ apiKey: key });
  }
  return genAI;
}

export const models = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
  tts: "gemini-3.1-flash-tts-preview"
};

export async function generateText(prompt: string, systemInstruction?: string) {
  const ai = await getAI();
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
  const ai = await getAI();
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
