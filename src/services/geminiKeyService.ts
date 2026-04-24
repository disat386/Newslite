import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleGenAI } from "@google/genai";

interface GeminiKey {
  id: string;
  key: string;
  status: 'active' | 'exhausted';
  lastUsed?: any;
}

class GeminiKeyService {
  private keys: GeminiKey[] = [];
  private currentIndex = 0;
  private initialized = false;

  constructor() {
    this.init();
  }

  private exhaustedKeys: Set<string> = new Set();

  private init() {
    if (typeof window === 'undefined') return;

    const keysRef = collection(db, 'gemini_keys');
    const q = query(keysRef, where('status', '==', 'active'));

    onSnapshot(q, (snapshot) => {
      this.keys = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GeminiKey));
      
      if (this.keys.length > 0) {
        console.log(`Auurio Hub Connection: SUCCESS. ${this.keys.length} active nodes synchronized.`);
        this.initialized = true;
      } else {
        console.warn("Auurio Hub: No active protocols found in network pool.");
      }
    }, (error) => {
      console.warn("Auurio Hub Connection: FAILED. Checking permissions or connectivity.", error);
    });
  }

  public async getNextKey(): Promise<string> {
    // Filter out exhausted keys for this session
    const availableKeys = this.keys.filter(k => !this.exhaustedKeys.has(k.key));

    if (availableKeys.length === 0) {
      // If we are initialized but everything is exhausted, reset exhaustion once or throw
      if (this.initialized && this.exhaustedKeys.size > 0) {
        console.warn("ROTATION TRIGGERED: All keys in pool exhausted. Resetting session nodes.");
        this.exhaustedKeys.clear();
        return this.getNextKey();
      }

      // Fallback to environment
      const envKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (envKey && !this.exhaustedKeys.has(envKey)) return envKey;
      
      // If still nothing, wait briefly if not initialized
      if (!this.initialized) {
        await new Promise(r => setTimeout(r, 1000));
        if (this.keys.length > 0) return this.getNextKey();
      }

      throw new Error("QUOTA_EXCEEDED: Key Rotation limit reached. All pooled protocols are busy.");
    }

    const keyObj = availableKeys[this.currentIndex % availableKeys.length];
    this.currentIndex++;
    return keyObj.key;
  }

  async executeWithRotation<T>(
    operation: (ai: any) => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    let key = '';
    try {
      key = await this.getNextKey();
    } catch (e: any) {
      throw e;
    }

    const ai = new GoogleGenAI({ apiKey: key });

    try {
      return await operation(ai);
    } catch (error: any) {
      const isQuotaError = error.message?.includes('429') || error.message?.includes('quota') || error.status === 429;
      
      if (isQuotaError && retryCount < 3) {
        console.log("ROTATION TRIGGERED: Key exhausted, switching to next node in Auurio Pool...");
        this.exhaustedKeys.add(key);
        return this.executeWithRotation(operation, retryCount + 1);
      }
      
      throw error;
    }
  }
}

export const geminiKeyService = new GeminiKeyService();
