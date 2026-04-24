import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleGenAI } from "@google/genai";

interface GeminiKey {
  id: string;
  key: string;
  status: 'active' | 'exhausted';
}

class GeminiKeyService {
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

      if (!this.initialized && newKeys.length > 0) {
        this.keys = this.shuffle(newKeys);
        console.log(`AUR-PROTOCOL: [SYNC COMPLETE] ${this.keys.length} active nodes synchronized from Hub.`);
        this.initialized = true;
        this.resolveInit();
      } else {
        this.keys = newKeys;
        if (newKeys.length === 0) {
          console.warn("AUR-PROTOCOL: [SYNC EMPTY] Hub has no active nodes.");
        }
      }
    }, (error) => {
      console.warn("AUR-PROTOCOL: [SYNC FAILED] Connection refused by Hub.", error.message);
      this.resolveInit(); // Don't block the app if sync fails
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
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );

    try {
      if (!this.initialized) {
        await Promise.race([this.initPromise, timeoutPromise]);
      }
    } catch (e) {
      console.warn("Auurio Hub: Key sync timeout. Using backup gateway.");
    }

    const availableKeys = this.keys.filter(k => !this.exhaustedKeys.has(k.key));
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;

    if (availableKeys.length > 0) {
      const key = availableKeys[0];
      // Rotate pool
      this.keys.push(this.keys.shift()!);
      return key.key;
    }

    if (envKey && !this.exhaustedKeys.has(envKey)) {
      return envKey;
    }

    if (this.exhaustedKeys.size > 0 && this.keys.length > 0) {
      this.exhaustedKeys.clear();
      return this.keys[0].key;
    }

    throw new Error("AUR-429: No available API keys. All Hub nodes are exhausted.");
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
        errorMsg.includes('exhausted');
      
      const isInvalidKey = errorMsg.includes('api_key_invalid') || errorMsg.includes('invalid api key');

      if ((isQuotaError || isInvalidKey) && retryCount < 2) {
        console.warn(`ROTATION TRIGGERED [Attempt ${retryCount + 1}]: Node failure detected. Shifting...`);
        this.exhaustedKeys.add(key);
        return this.executeWithRotation(operation, retryCount + 1);
      }
      
      throw error;
    }
  }
}

export const geminiKeyService = new GeminiKeyService();
