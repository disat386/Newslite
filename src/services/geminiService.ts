import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleGenAI } from "@google/genai";

interface GeminiKey {
  id: string;
  key: string;
  status: 'active' | 'exhausted';
}

class GeminiService {
  private keys: GeminiKey[] = [];
  private exhaustedKeys: Set<string> = new Set();
  private initialized = false;
  private initPromise: Promise<void>;
  private resolveInit!: () => void;

  constructor() {
    this.initPromise = new Promise((resolve) => {
      this.resolveInit = resolve;
    });
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') {
      this.resolveInit();
      return;
    }

    const keysRef = collection(db, 'gemini_keys');
    const q = query(keysRef, where('status', '==', 'active'));

    onSnapshot(q, (snapshot) => {
      const newKeys = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GeminiKey));

      // Randomize initial pool if first fetch
      if (!this.initialized && newKeys.length > 0) {
        this.keys = this.shuffle(newKeys);
        console.log(`Auurio Hub: Protocol Synchronization SUCCESS. ${this.keys.length} nodes active.`);
        this.initialized = true;
        this.resolveInit();
      } else {
        this.keys = newKeys;
      }
    }, (error) => {
      console.warn("Auurio Hub: Connection interrupted. Local protocols only.", error);
      this.resolveInit();
    });
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  public async getBestAvailableKey(): Promise<string> {
    // 5-second timeout for Firestore initialization
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );

    try {
      if (!this.initialized) {
        await Promise.race([this.initPromise, timeoutPromise]);
      }
    } catch (e) {
      console.warn("Auurio Hub: Initialization timed out. Falling back to primary gateway.");
    }

    const availableKeys = this.keys.filter(k => !this.exhaustedKeys.has(k.key));
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;

    // Prioritize Firestore keys
    if (availableKeys.length > 0) {
      const key = availableKeys[0];
      // Rotate pool for next call
      this.keys.push(this.keys.shift()!);
      return key.key;
    }

    // Fallback to environment variable if not already exhausted
    if (envKey && !this.exhaustedKeys.has(envKey)) {
      return envKey;
    }

    // If nothing left, reset exhaustion state of pooled keys as a last resort
    if (this.exhaustedKeys.size > 0 && this.keys.length > 0) {
      console.log("ROTATION RESTART: All protocols busy. Resetting session nodes.");
      this.exhaustedKeys.clear();
      return this.keys[0].key;
    }

    throw new Error("PROTOCOL_CRITICAL: All available Gemini API keys have exceeded quota. Please refill Hub credits.");
  }

  public async executeWithRotation<T>(
    operation: (ai: any) => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    const key = await this.getBestAvailableKey();
    const ai = new GoogleGenAI({ apiKey: key });

    try {
      return await operation(ai);
    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || '';
      const isQuotaError = 
        errorMsg.includes('429') || 
        errorMsg.includes('quota') || 
        errorMsg.includes('exhausted') || 
        errorMsg.includes('resource_exhausted');
      
      // Dual-retry mechanism: 2 retries (3 attempts total)
      if (isQuotaError && retryCount < 2) {
        console.warn(`DUAL-RETRY TRIGGERED [Attempt ${retryCount + 1}]: Node ${key.substring(0, 8)}... exhausted. Shifting to next node.`);
        this.exhaustedKeys.add(key);
        return this.executeWithRotation(operation, retryCount + 1);
      }
      
      if (isQuotaError) {
        throw new Error("AUR-429: Critical Quota Exhaustion across all Hub nodes. Please wait or refill key pool.");
      }
      
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
