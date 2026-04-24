import { GoogleGenAI, Type } from "@google/genai";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

let dynamicApiKey: string | null = null;

const getApiKey = async (force: boolean = false) => {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isDevPreview = typeof window !== 'undefined' && window.location.hostname.includes('run.app');

  // 1. Check Memory Cache (unless forced)
  if (dynamicApiKey && !force) return dynamicApiKey;

  // 2. Check LocalStorage Cache (unless forced)
  if (typeof window !== 'undefined' && !force) {
    const cached = localStorage.getItem('auurio_gemini_key');
    if (cached) {
      dynamicApiKey = cached;
      return cached;
    }
  }

  // 3. Fetch from Hub (Firestore config) - High Priority
  try {
    const configRef = doc(db, 'config', 'settings');
    let configSnap = await getDoc(configRef);
    
    // If not found and custom domain, auth might still be initializing, wait briefly and retry once
    if (!configSnap.exists() && !isLocal && !isDevPreview) {
      console.log("Intelligence Protocol: Hub Sync pending... waiting 1s.");
      await new Promise(r => setTimeout(r, 1000));
      configSnap = await getDoc(configRef);
    }

    if (configSnap.exists()) {
      const data = configSnap.data();
      // Handle both single key and possible array/rotation field if hub provides it differently
      const hubKey = data.geminiApiKey || data.apiKey;
      
      if (hubKey) {
        if (force) {
          console.log("Intelligence Protocol: Hub Rotation Detected. Synchronizing fresh key...");
        } else {
          console.log("Intelligence Protocol: Hub Key Synchronized.");
        }
        
        dynamicApiKey = hubKey;
        if (typeof window !== 'undefined') {
          localStorage.setItem('auurio_gemini_key', hubKey);
        }
        return hubKey;
      }
    }
  } catch (error) {
    console.warn("Hub Key Sync Offline (Permission/Network):", error);
  }

  // 4. Fallback to Environment Keys (Build-time)
  const envKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey) {
    console.log("Intelligence Protocol: Using Environment Fallback.");
    return envKey;
  }

  // 5. Fallback/Error for Custom Domains
  if (!isLocal && !isDevPreview) {
    throw new Error("NewsLite Error: Protocol Offline. GEMINI_API_KEY missing in Hub and environment. Ensure your Admin Panel has set the API key in config/settings.");
  }
  
  return '';
};

let genAI: GoogleGenAI | null = null;
let currentKey: string | null = null;

export async function getAI(force: boolean = false) {
  const key = await getApiKey(force);
  
  if (!genAI || key !== currentKey || force) {
    if (!key) throw new Error("GEMINI_API_KEY is not available protocol-wide.");
    genAI = new GoogleGenAI({ apiKey: key });
    currentKey = key;
    console.log("Intelligence Protocol: Neural Network re-calibrated.");
  }
  
  return genAI;
}

export const models = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
  tts: "gemini-3.1-flash-tts-preview"
};

export async function generateText(prompt: string, systemInstruction?: string, retryCount = 0) {
  try {
    const ai = await getAI(retryCount > 0);
    const response = await ai.models.generateContent({
      model: models.flash,
      contents: prompt,
      config: {
        systemInstruction
      }
    });
    return response.text;
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || error.message?.includes('quota') || error.status === 429;
    
    if (isQuotaError && retryCount < 1) {
      console.warn("Intelligence Protocol: Quota detected. Requesting Hub Rotation...");
      // Invalidate the key and retry immediately
      dynamicApiKey = null;
      if (typeof window !== 'undefined') localStorage.removeItem('auurio_gemini_key');
      return generateText(prompt, systemInstruction, retryCount + 1);
    }

    if (isQuotaError) {
      throw new Error("QUOTA_EXCEEDED: Key Rotation limit reached. Please wait 60s or check rotation status in Hub.");
    }
    throw error;
  }
}

export async function generateJSON(prompt: string, schema: any, systemInstruction?: string, retryCount = 0) {
  try {
    const ai = await getAI(retryCount > 0);
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
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || error.message?.includes('quota') || error.status === 429;
    
    if (isQuotaError && retryCount < 1) {
      console.warn("Intelligence Protocol: Quota detected. Requesting Hub Rotation...");
      // Invalidate the key and retry immediately
      dynamicApiKey = null;
      if (typeof window !== 'undefined') localStorage.removeItem('auurio_gemini_key');
      return generateJSON(prompt, schema, systemInstruction, retryCount + 1);
    }

    if (isQuotaError) {
      throw new Error("QUOTA_EXCEEDED: Key Rotation limit reached. Please wait 60s or check rotation status in Hub.");
    }
    throw error;
  }
}
