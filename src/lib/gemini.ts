import { GoogleGenAI, Type } from "@google/genai";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

let keyPool: string[] = [];
let exhaustedKeys: Set<string> = new Set();
let dynamicApiKey: string | null = null;

const getApiKey = async (force: boolean = false) => {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isDevPreview = typeof window !== 'undefined' && window.location.hostname.includes('run.app');

  // 1. Check Memory Cache (unless forced or current key is exhausted)
  if (dynamicApiKey && !force && !exhaustedKeys.has(dynamicApiKey)) return dynamicApiKey;

  // 2. Fetch from Hub (Firestore Rotation Pool) - Higher Priority
  try {
    // Specifically targeting the shared path requested: settings/api_keys
    const keysRef = doc(db, 'settings', 'api_keys');
    let keysSnap = await getDoc(keysRef);
    
    // Auth initialization buffer for custom domains
    if (!keysSnap.exists() && !isLocal && !isDevPreview) {
      console.log("Intelligence Protocol: Key Pool Sync pending...");
      await new Promise(r => setTimeout(r, 1000));
      keysSnap = await getDoc(keysRef);
    }

    if (keysSnap.exists()) {
      const data = keysSnap.data();
      // Handle both array of keys or a single key field
      const pool = data.keys || data.apiKeys || (data.apiKey ? [data.apiKey] : []);
      
      if (Array.isArray(pool) && pool.length > 0) {
        keyPool = pool.filter(k => !exhaustedKeys.has(k));
        
        // If all pooled keys are exhausted in this session, reset the exhausted set to try again
        if (keyPool.length === 0 && exhaustedKeys.size > 0) {
          console.warn("Intelligence Protocol: All pooled keys exhausted. Resetting session rotation.");
          exhaustedKeys.clear();
          keyPool = pool;
        }

        if (keyPool.length > 0) {
          // Pick a random key from the available pool for distribution
          const randomIndex = Math.floor(Math.random() * keyPool.length);
          dynamicApiKey = keyPool[randomIndex];
          console.log(`Intelligence Protocol: Hub Key Synchronized (Pool Size: ${pool.length}).`);
          return dynamicApiKey;
        }
      }
    }
  } catch (error) {
    console.warn("Hub Key Pool Offline:", error);
  }

  // 3. Fallback to Legacy Hub Path (config/settings)
  try {
    const legacyRef = doc(db, 'config', 'settings');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      const data = legacySnap.data();
      const legacyKey = data.geminiApiKey || data.apiKey;
      if (legacyKey && !exhaustedKeys.has(legacyKey)) {
        dynamicApiKey = legacyKey;
        return legacyKey;
      }
    }
  } catch (e) {
    // Silent fail for legacy
  }

  // 4. Final Fallback to Environment Keys (Production Build)
  const envKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && !exhaustedKeys.has(envKey)) {
    console.log("Intelligence Protocol: Using Environment Fallback.");
    return envKey;
  }

  // 5. Critical Failure Handling
  if (!isLocal && !isDevPreview) {
    if (exhaustedKeys.size > 0) {
      throw new Error("NewsLite Error: All available API protocols have reached quota limits. Please try again in 60s.");
    }
    throw new Error("NewsLite Error: Protocol Offline. No API keys found in Hub or Environment.");
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
    console.log("Intelligence Protocol: Neural Network re-calibrated with fresh key.");
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
    
    if (isQuotaError && retryCount < 2) { // Allow up to 2 retries if we have a pool
      console.warn(`Intelligence Protocol: Key Quota limit [${currentKey?.slice(-4)}]. Requesting Hub Rotation...`);
      if (currentKey) exhaustedKeys.add(currentKey);
      dynamicApiKey = null;
      return generateText(prompt, systemInstruction, retryCount + 1);
    }

    if (isQuotaError) {
      throw new Error("QUOTA_EXCEEDED: Key Rotation limit reached. All pooled protocols are busy.");
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
    
    if (isQuotaError && retryCount < 2) {
      console.warn(`Intelligence Protocol: Key Quota limit [${currentKey?.slice(-4)}]. Requesting Hub Rotation...`);
      if (currentKey) exhaustedKeys.add(currentKey);
      dynamicApiKey = null;
      return generateJSON(prompt, schema, systemInstruction, retryCount + 1);
    }

    if (isQuotaError) {
      throw new Error("QUOTA_EXCEEDED: Key Rotation limit reached. All pooled protocols are busy.");
    }
    throw error;
  }
}

