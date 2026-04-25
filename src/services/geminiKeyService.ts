import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleGenAI } from "@google/genai";

interface GeminiKey {
  id: string;
  key: string;
  status: 'active' | 'exhausted';
  isWorking?: boolean;
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
      const allKeys = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GeminiKey));

      // Filter out explicitly non-working keys
      const newKeys = allKeys.filter(k => k.isWorking !== false);

      if (!this.initialized) {
        if (newKeys.length > 0) {
          this.keys = this.shuffle(newKeys);
          console.log(`AUR-PROTOCOL: [SYNC COMPLETE] ${this.keys.length} active nodes synchronized from Hub.`);
        } else {
          console.warn("AUR-PROTOCOL: [SYNC EMPTY] Hub has no active nodes.");
        }
        this.initialized = true;
        this.resolveInit();
      } else {
        this.keys = newKeys;
      }
    }, (error) => {
      console.warn("AUR-PROTOCOL: [SYNC FAILED] Connection refused by Hub.", error.message);
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

  private async markKeyAsInvalid(keyString: string) {
    const keyDoc = this.keys.find(k => k.key === keyString);
    if (!keyDoc) return;

    try {
      const keyRef = doc(db, 'gemini_keys', keyDoc.id);
      await updateDoc(keyRef, {
        isWorking: false,
        status: 'exhausted',
        updatedAt: serverTimestamp()
      });
      console.warn(`AUR-HUB: Node ${keyDoc.id} marked as INVALID and synchronized.`);
    } catch (e) {
      console.error("AUR-HUB: Failed to synchronize node failure state.", e);
    }
  }

  public async getBestAvailableKey(): Promise<string> {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SYNC_TIMEOUT')), 12000)
    );

    try {
      if (!this.initialized) {
        console.log("AUR-PROTOCOL: Awaiting node synchronization from Hub...");
        await Promise.race([this.initPromise, timeoutPromise]);
      }
    } catch (e) {
      console.warn("AUR-PROTOCOL: Hub sync delayed. Proceeding with current node state...");
    }

    // Filter available keys that aren't exhausted
    const availableKeys = this.keys.filter(k => k.key && !this.exhaustedKeys.has(k.key));
    
    // Environment key fallback (only if not exhausted)
    const rawEnvKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
    const envKey = (rawEnvKey && rawEnvKey !== 'undefined' && rawEnvKey !== 'null') ? rawEnvKey : null;

    if (availableKeys.length > 0) {
      const selectedKeyDoc = availableKeys[0];
      // Rotate local pool order for next request
      const keyIndex = this.keys.findIndex(k => k.id === selectedKeyDoc.id);
      if (keyIndex !== -1) {
        this.keys.push(this.keys.splice(keyIndex, 1)[0]);
      }
      return selectedKeyDoc.key;
    }

    // Fallback to env key if valid and not exhausted
    if (envKey && !this.exhaustedKeys.has(envKey)) {
      return envKey;
    }

    // EMERGENCY RESET: If we reach here, it means ALL available keys (Hub + Env) are exhausted
    if (this.exhaustedKeys.size > 0) {
      console.warn("AUR-PROTOCOL: [SYSTEM EXHAUSTED] All registered nodes (429/403). Attempting soft reset of non-invalidated nodes...");
      
      // We clear exhausted keys but ONLY if we have no other choice.
      // Better yet, we should probably throw and wait for the user to add a new key as requested.
      // But we'll try a clear once if it's the first time we hit this state in a while.
      
      const totalAvailableInHub = this.keys.length;
      if (totalAvailableInHub === 0 && !envKey) {
        throw new Error("AUR-429: Critical Hub Failure. Zero active nodes found in gemini_keys collection. Please add a fresh Gemini API key in Unit Settings -> Hub Node Management.");
      }
      
      // If we have some keys in Hub, let's just clear and try again once
      this.exhaustedKeys.clear();
      if (this.keys.length > 0) return this.keys[0].key;
      if (envKey) return envKey;
    }

    throw new Error("AUR-429: Critical Hub Error - All processing nodes are currently exhausted. Please add a fresh Gemini API key via Unit Settings -> Hub Node Management to restore service immediately.");
  }

  public async executeWithRotation<T>(
    operation: (ai: any) => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    const key = await this.getBestAvailableKey();
    const ai = new GoogleGenAI({ apiKey: key });

    try {
      console.log(`AUR-NODE: Executing with node [${key.slice(0, 8)}...] (Attempt ${retryCount + 1})`);
      return await operation(ai);
    } catch (error: any) {
      // Extensive error string analysis
      const errorString = JSON.stringify(error).toLowerCase();
      const errorFull = (error.message || error.status || '').toString().toLowerCase();
      
      const isQuotaError = 
        errorString.includes('429') || 
        errorString.includes('quota') || 
        errorString.includes('exhausted') ||
        errorFull.includes('429') || 
        errorFull.includes('quota') || 
        errorFull.includes('exhausted');
      
      const isInvalidKey = 
        errorString.includes('api_key_invalid') || 
        errorString.includes('invalid api key') ||
        errorString.includes('403') ||
        errorString.includes('permission_denied') ||
        errorFull.includes('api_key_invalid') || 
        errorFull.includes('invalid api key') ||
        errorFull.includes('403') ||
        errorFull.includes('permission_denied') ||
        errorFull.includes('access_denied');

      // Sync Invalid Key state to Hub
      if (isInvalidKey) {
        this.markKeyAsInvalid(key);
      }

      const totalPoolSize = this.keys.length + (process.env.GEMINI_API_KEY ? 1 : 0);
      const maxRetries = Math.max(totalPoolSize, 3);

      if ((isQuotaError || isInvalidKey) && retryCount < maxRetries) {
        const nodeType = isQuotaError ? 'QUOTA_EXCEEDED' : 'INVALID_NODE';
        console.warn(`AUR-ROTATION: Node failure [${nodeType}] detected on key ${key.slice(0, 6)}... Shifting to next node. (Retry ${retryCount + 1}/${maxRetries})`);
        
        this.exhaustedKeys.add(key);
        
        // Small exponential-ish delay for 429
        const delay = isQuotaError ? 1000 * (retryCount + 1) : 200;
        await new Promise(r => setTimeout(r, delay));
        
        return this.executeWithRotation(operation, retryCount + 1);
      }
      
      // Wrap specific quota error for UI detection
      if (isQuotaError) {
        throw new Error(`AUR-429: [HUB EXHAUSTED] All registered Gemini processing nodes have exceeded their quota. Total nodes tried: ${retryCount + 1}. Please add a fresh API key in Settings -> Hub Node Management.`);
      }
      
      throw error;
    }
  }
}

export const geminiKeyService = new GeminiKeyService();
