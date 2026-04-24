import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  RefreshCw, 
  AlertTriangle, 
  ChevronRight,
  ShieldAlert,
  FileSearch,
  Zap,
  Mic2,
  Bell,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { NewsToolId } from '../types';
import { generateJSON, generateText, getAI } from '../lib/gemini';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Type } from '@google/genai';
import { Play, Pause } from 'lucide-react';

interface ToolRendererProps {
  toolId: NewsToolId;
  toolName: string;
  toolDescription: string;
  user: any;
  credits: number | null;
  setCredits: (c: number) => void;
  initialInput?: string;
  onClearInitialInput?: () => void;
}

export const ToolRenderer: React.FC<ToolRendererProps> = ({ 
  toolId, 
  toolName, 
  toolDescription, 
  user, 
  credits, 
  setCredits,
  initialInput,
  onClearInitialInput
}) => {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
      onClearInitialInput?.();
    }
  }, [initialInput, onClearInitialInput]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const deductCredit = async () => {
    if (!user || !credits || credits <= 0) return false;
    const newCredits = credits - 1;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      credits: newCredits,
      updatedAt: serverTimestamp()
    });
    setCredits(newCredits);
    return true;
  };

  const [language, setLanguage] = useState<'English' | 'Bangla' | 'Hindi'>('English');
  const [writerStyle, setWriterStyle] = useState<'Journalistic' | 'Blog Post' | 'Formal Report' | 'Casual'>('Journalistic');
  
  const LANGUAGE_VOICES: Record<'English' | 'Bangla' | 'Hindi', { label: string; value: string }[]> = {
    English: [
      { label: 'Sophia (US)', value: 'Kore' },
      { label: 'Marcus (US)', value: 'Fenrir' },
      { label: 'Luna (US)', value: 'Aoede' },
      { label: 'Charlie (US)', value: 'Puck' },
      { label: 'David (US)', value: 'Charon' }
    ],
    Bangla: [
      { label: 'Aditi (BD)', value: 'Kore' },
      { label: 'Tanvia (BD)', value: 'Aoede' },
      { label: 'Shuvo (BD)', value: 'Puck' }
    ],
    Hindi: [
      { label: 'Ishita (IN)', value: 'Kore' },
      { label: 'Aarav (IN)', value: 'Fenrir' },
      { label: 'Ananya (IN)', value: 'Aoede' },
      { label: 'Kabir (IN)', value: 'Charon' }
    ]
  };

  const [audioSettings, setAudioSettings] = useState({
    voice: 'Kore',
    tone: 'Professional',
    speed: 1.0,
    enhanceFirst: false
  });

  React.useEffect(() => {
    if (!LANGUAGE_VOICES[language].some(v => v.value === audioSettings.voice)) {
      setAudioSettings(prev => ({ ...prev, voice: LANGUAGE_VOICES[language][0].value }));
    }
  }, [language]);

  const [showDocs, setShowDocs] = useState(false);

  const EXAMPLES: Record<NewsToolId, string> = {
    audio: "SpaceX successfully lands Starship in the Indian Ocean, marking a massive milestone for Mars colonization efforts. Elon Musk confirms testing for orbital refueling will begin next quarter.",
    summarizer: "The global semiconductor industry is facing an unprecedented shift as localized manufacturing facilities in Europe and the US begin production. Rising energy costs in Asia and logistical bottlenecks have forced companies like Intel and TSMC to rethink their global supply chains. TSMC recently announced a $40 billion investment in Arizona, while Intel is pouring billions into its German 'Mega-Fab'. This decentralization is expected to stabilize prices but may lead to higher initial production costs.",
    factchecker: "A recent viral report claims that a new species of bioluminescent trees has been discovered in the Amazon rainforest that can replace streetlights. The report suggests these trees were genetically modified by a startup and can glow for 12 hours straight without sunlight.",
    breakdown: "Quantum entanglement is a physical phenomenon that occurs when a pair or group of particles is generated, interact, or share spatial proximity in a way such that the quantum state of each particle of the pair or group cannot be described independently of the state of the others.",
    translator: "Technology is the core engine of modern economic growth. Without rapid innovation in software and hardware, global productivity would stagnate, leading to long-term social challenges.",
    writer: "NVIDIA has released its latest AI processing chip, the Blackwell series, which promises 30x faster inference speeds than its predecessor. Stock prices surged 5% following the announcement.",
    threads: "Apple has just announced the Vision Pro 2, featuring a lighter chassis and improved micro-OLED displays. It's aiming to make spatial computing mainstream by lowering the entry price point.",
    hooks: "The future of remote work is being debated as major tech companies mandate return-to-office policies across their global headquarters.",
    captions: "I just spent the day testing the new Tesla Cybercab in Las Vegas. The self-driving experience feels surreal but remarkably smooth. #Tesla #AI #FutureTech",
    analyzer: "Electric vertical take-off and landing (eVTOL) aircraft are seeing a surge in venture capital funding as urban air mobility starts to look viable for 2030.",
    newsletter: "This week in tech: GPT-5 rumors heat up, major cyber security breach at a global bank, and a breakthrough in solid-state battery technology.",
    calendar: "Generative AI is changing how we create art and music. Here is why every creator needs to pay attention to these new tools.",
    opinion: "Should governments have the power to regulate AI algorithms to prevent social media bias, or does this infringe on free speech and innovation?",
    alerts: "Mars Colonization",
    video: "N/A",
    dashboard: "N/A"
  };

  const getToolAction = (id: NewsToolId) => {
    switch(id) {
      case 'summarizer': return "Condensing logic packets...";
      case 'factchecker': return "Running forensic audits...";
      case 'audio': return "Synthesizing neural audio...";
      case 'writer': return "Drafting journalistic script...";
      case 'threads': return "Architecting narrative flow...";
      default: return "Initializing protocol pulse...";
    }
  };

  const handleProcess = async () => {
    if (!input.trim()) return;
    if ((credits ?? 0) <= 0) {
      setError("Insufficient Auurio Credits. Please refill in the Hub.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const ai = getAI();

    try {
      const ok = await deductCredit();
      if (!ok) throw new Error("Credit deduction failed.");

      let currentInput = input;
      let aiResult: any;

      // Cross-tool connectivity: Enhance input if requested or for specific tools
      if (toolId === 'audio' && audioSettings.enhanceFirst) {
        currentInput = await generateText(`Transform the following news into a ${audioSettings.tone.toLowerCase()} scripted news report optimized for audio delivery in ${language} language: ${input}`);
      }

      const languageInstruction = `CRITICAL: All output MUST be in ${language} language.`;

      switch (toolId) {
        case 'summarizer':
          aiResult = await generateJSON(currentInput, {
             type: Type.OBJECT,
             properties: {
               headline: { type: Type.STRING },
               oneLine: { type: Type.STRING },
               highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
               eli10: { type: Type.STRING },
               breakdown: { type: Type.STRING }
             }
          }, `You are the NewsLite Smart Summarizer. Extract key info into multiple formats. ${languageInstruction}`);
          break;
        
        case 'factchecker':
          aiResult = await generateJSON(currentInput, {
            type: Type.OBJECT,
            properties: {
              overallCredibility: { type: Type.STRING },
              biases: { type: Type.ARRAY, items: { type: Type.STRING } },
              claims: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    claim: { type: Type.STRING },
                    status: { type: Type.STRING, enum: ['verified', 'questionable', 'likely-false'] },
                    explanation: { type: Type.STRING }
                  }
                } 
              }
            }
          }, `You are the NewsLite Fact Checker. Verify claims within the provided news text and identify potential biases. ${languageInstruction}`);
          break;

        case 'writer':
          aiResult = await generateText(`Rewrite the following news content into a ${writerStyle.toLowerCase()} style with a focus on uniqueness and flow in ${language} language: ${currentInput}`);
          break;

        case 'threads':
          aiResult = await generateText(`Transform this news into a 5-10 part social media thread with engaging hooks, emojis, and a clear story arc in ${language} language: ${currentInput}`);
          break;

        case 'hooks':
          aiResult = await generateJSON(currentInput, {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['clickbait', 'seo', 'emotional', 'question'] },
                hook: { type: Type.STRING }
              }
            }
          }, `Generate 5 high-converting headlines and hooks for this topic. ${languageInstruction}`);
          break;

        case 'captions':
          aiResult = await generateJSON(currentInput, {
            type: Type.OBJECT,
            properties: {
              platforms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    caption: { type: Type.STRING },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          }, `Generate optimized captions and hashtags for FB, IG, and YT for this news story. ${languageInstruction}`);
          break;

        case 'analyzer':
          aiResult = await generateJSON(currentInput, {
            type: Type.OBJECT,
            properties: {
              trendingScore: { type: Type.NUMBER },
              relatedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              velocity: { type: Type.STRING },
              opportunities: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }, `Analyze the trend potential of this news topic. ${languageInstruction}`);
          break;

        case 'translator':
          aiResult = await generateJSON(currentInput, {
            type: Type.OBJECT,
            properties: {
              translatedText: { type: Type.STRING },
              culturalContext: { type: Type.STRING }
            }
          }, `Translate this news text naturally while maintaining its journalistic tone to ${language}. ${languageInstruction}`);
          break;

        case 'newsletter':
          aiResult = await generateText(`Create a professional email newsletter digest based on this content, including a catchy subject line and structured sections in ${language} language: ${currentInput}`);
          break;

        case 'breakdown':
          aiResult = await generateJSON(currentInput, {
            type: Type.OBJECT,
            properties: {
               simpleDefinition: { type: Type.STRING },
               realLifeExample: { type: Type.STRING },
               stepByStep: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }, `Explain this complex news topic in very simple terms for a general audience. ${languageInstruction}`);
          break;

        case 'opinion':
          aiResult = await generateJSON(currentInput, {
            type: Type.OBJECT,
            properties: {
              neutralSummary: { type: Type.STRING },
              proArguments: { type: Type.ARRAY, items: { type: Type.STRING } },
              conArguments: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }, `Generate balanced perspectives on this news topic. ${languageInstruction}`);
          break;

        case 'calendar':
          aiResult = await generateJSON(currentInput, {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                postType: { type: Type.STRING },
                focus: { type: Type.STRING }
              }
            }
          }, `Create a 7-day content calendar based on this trending news. ${languageInstruction}`);
          break;

        case 'audio':
          aiResult = await ai.models.generateContent({
            model: "gemini-1.5-flash", // Use 1.5 flash for prompt processing
            contents: [{ parts: [{ text: `Generate a high-quality news report script in ${language} based on this: ${currentInput}. Make it professional. Tone: ${audioSettings.tone}.` }] }]
          });
          const reportScript = aiResult.response.text();
          
          aiResult = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: `Tone: ${audioSettings.tone}. Speed: ${audioSettings.speed}x. Script in ${language}: ${reportScript}` }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: audioSettings.voice }
                }
              }
            }
          });
          break;

        case 'alerts':
          aiResult = await generateJSON(currentInput || "Current high-urgency breaking news", {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                urgency: { type: Type.STRING, enum: ['critical', 'high', 'moderate'] },
                title: { type: Type.STRING },
                timestamp: { type: Type.STRING },
                isReal: { type: Type.BOOLEAN }
              }
            }
          }, "Generate 3 simulated or real-time high-urgency breaking news alerts based on the topic.");
          break;
      }

      setResult(aiResult);
    } catch (err: any) {
      setError(err.message || "An error occurred during AI processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 px-0 sm:px-4">
      <div className="flex flex-col gap-2 mb-2 px-1 relative">
        <div className="flex justify-between items-start">
           <div className="space-y-1">
              <h2 className="text-xl lg:text-3xl font-black italic tracking-tighter uppercase text-white leading-none">
                {toolName} Unit
              </h2>
              <p className="text-[10px] lg:text-xs font-medium text-white/40 italic tracking-tight">
                Protocol Detail: {toolDescription}
              </p>
           </div>
           <button 
             onClick={() => setShowDocs(!showDocs)}
             className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all"
           >
             <HelpCircle className="w-3 h-3" />
             {showDocs ? 'Hide Logic' : 'How it works'}
           </button>
        </div>

        <AnimatePresence>
          {showDocs && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 p-5 lg:p-6 bg-auurio-accent/5 border border-auurio-accent/20 rounded-2xl space-y-3">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-auurio-accent">Operation Protocol</h4>
                 <p className="text-xs lg:text-sm text-white/60 leading-relaxed font-medium">
                    This unit utilizes the Auurio Neural Core to process your input. 
                    1. Input your {toolId === 'audio' ? 'script or news topic' : 'article text'}. 
                    2. Select your preferred Language and Tone. 
                    3. Initialize the protocol to generate your high-fidelity output.
                 </p>
                 <div className="flex gap-4 text-[9px] font-black uppercase text-auurio-accent/40">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Real-time Sync</span>
                    <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Neural Validated</span>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass-card rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 border-white/10 relative overflow-hidden">
        <div className="flex flex-col gap-4 lg:gap-6 relative z-10">
          <div className="px-1 text-[10px] font-bold text-white/30 italic mb-2">
            Tip: Select your target language and refine settings before initializing the protocol pulsator.
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-2">
            <div className="space-y-2 flex-grow">
               <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Target Language Control</label>
               <div className="flex gap-2">
                 {(['English', 'Bangla', 'Hindi'] as const).map(lang => (
                   <button 
                     key={lang}
                     onClick={() => setLanguage(lang)}
                     className={`flex-grow py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${language === lang ? 'bg-auurio-accent/20 border-auurio-accent text-auurio-accent shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                   >
                     {lang}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          {toolId === 'writer' && (
            <div className="space-y-2 mb-2">
              <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Writing Style Architecture</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Journalistic', 'Blog Post', 'Formal Report', 'Casual'] as const).map(style => (
                  <button 
                    key={style}
                    onClick={() => setWriterStyle(style)}
                    className={`py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${writerStyle === style ? 'bg-auurio-accent/20 border-auurio-accent text-auurio-accent shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          )}

          {toolId === 'audio' && (
            <div className="space-y-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Voice Protocol (Neural Sync)</label>
                  <select 
                    value={audioSettings.voice}
                    onChange={(e) => setAudioSettings(prev => ({ ...prev, voice: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-auurio-accent/50 transition-colors"
                  >
                    {LANGUAGE_VOICES[language].map(v => (
                      <option key={v.value} value={v.value} className="bg-auurio-black">{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Acoustic Tone</label>
                  <select 
                    value={audioSettings.tone}
                    onChange={(e) => setAudioSettings(prev => ({ ...prev, tone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-auurio-accent/50 transition-colors"
                  >
                    <option value="Professional" className="bg-auurio-black">Professional</option>
                    <option value="Energetic" className="bg-auurio-black">Energetic</option>
                    <option value="Calm" className="bg-auurio-black">Calm</option>
                    <option value="Urgent" className="bg-auurio-black">Urgent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Playback Velocity</label>
                  <select 
                    value={audioSettings.speed}
                    onChange={(e) => setAudioSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-auurio-accent/50 transition-colors"
                  >
                    <option value="0.8" className="bg-auurio-black">0.8x Slo-Sync</option>
                    <option value="1.0" className="bg-auurio-black">1.0x Normal</option>
                    <option value="1.2" className="bg-auurio-black">1.2x High-Vel</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Neural Enhance</label>
                  <button 
                    onClick={() => setAudioSettings(prev => ({ ...prev, enhanceFirst: !prev.enhanceFirst }))}
                    className={`w-full h-[46px] flex items-center justify-between px-4 rounded-xl border text-[9px] font-black uppercase transition-all ${audioSettings.enhanceFirst ? 'bg-auurio-accent/20 border-auurio-accent text-auurio-accent shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    Auto-Script
                    <Zap className={`w-3.5 h-3.5 ${audioSettings.enhanceFirst ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[9px] uppercase font-black text-white/30 tracking-widest pl-1">Ecosystem Connectivity: Latests Pulses</label>
                 <div className="flex flex-wrap gap-2">
                    {[
                      "Global AI Regulations 2026",
                      "SpaceX Mars Colony Sync",
                      "Neuralink OS Update 4.0",
                      "Quantum Ledger Protocol"
                    ].map((topic, i) => (
                      <button 
                         key={i}
                         onClick={() => setInput(topic)}
                         className="text-[8px] lg:text-[9px] font-black uppercase px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-auurio-accent/40 hover:text-auurio-accent transition-all"
                      >
                        {topic}
                      </button>
                    ))}
                 </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center mb-2 px-1">
             <label className="text-[9px] uppercase font-black text-white/30 tracking-widest">Input Data Stream</label>
             {EXAMPLES[toolId] && (
               <button 
                 onClick={() => setInput(EXAMPLES[toolId])}
                 className="text-[9px] font-black uppercase text-auurio-accent hover:text-white transition-colors flex items-center gap-1"
               >
                 <Sparkles className="w-3 h-3" /> Auto-Fill Example
               </button>
             )}
          </div>
          <textarea
            placeholder={getPlaceholder(toolId)}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl p-4 lg:p-8 min-h-[160px] lg:min-h-[200px] text-base lg:text-lg font-medium focus:outline-none focus:border-auurio-accent/50 transition-all placeholder:text-white/10 resize-none"
          />
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-white/20">
               <Zap className="w-4 h-4" />
               <span className="text-[9px] lg:text-[10px] uppercase font-black tracking-widest leading-none">1 Token per Unit Pulse</span>
            </div>
            <button 
              onClick={handleProcess}
              disabled={isProcessing || !input.trim()}
              className="w-full sm:w-auto bg-auurio-accent text-white px-8 lg:px-10 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_15px_40px_rgba(249,115,22,0.3)] hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:scale-100 text-xs lg:text-sm group"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {getToolAction(toolId)}
                </>
              ) : (
                <>
                  {toolId === 'audio' && audioSettings.enhanceFirst ? 'Enhance & Generate' : 'Initialize Protocol'}
                  <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 lg:p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500">
           <AlertTriangle className="w-5 h-5 lg:w-6 lg:h-6 flex-shrink-0" />
           <p className="text-xs lg:text-sm font-black uppercase tracking-tight">{error}</p>
        </motion.div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8">
             {toolId === 'summarizer' && (
               <div className="grid grid-cols-1 gap-4 lg:gap-6">
                  <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10">
                     <h3 className="text-white/30 text-[9px] lg:text-[10px] uppercase font-black tracking-widest mb-3 lg:mb-4">Pulse Headline</h3>
                     <p className="text-xl lg:text-2xl font-black italic tracking-tighter leading-tight">{result.headline}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                    <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10">
                       <h3 className="text-auurio-accent text-[9px] lg:text-[10px] uppercase font-black tracking-widest mb-3 lg:mb-4">One-Line Sync</h3>
                       <p className="font-medium text-base lg:text-lg leading-relaxed">{result.oneLine}</p>
                    </div>
                    <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10 relative group">
                       <div className="flex justify-between items-center mb-3 lg:mb-4">
                          <h3 className="text-auurio-yellow text-[9px] lg:text-[10px] uppercase font-black tracking-widest leading-none">Simplified Logic</h3>
                          <button onClick={() => copyToClipboard(result.eli10)} className="text-white/20 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                             <Copy className="w-3 h-3" />
                          </button>
                       </div>
                       <p className="font-medium opacity-60 leading-relaxed italic text-sm lg:text-base">"{result.eli10}"</p>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 border-white/10">
                     <h3 className="text-white/30 text-[9px] lg:text-[10px] uppercase font-black tracking-widest mb-6 lg:mb-8 flex justify-between">
                        Key Data Points
                        <button onClick={() => copyToClipboard(result.highlights.join('\n'))} className="hover:text-white transition-colors"><Copy className="w-4 h-4" /></button>
                     </h3>
                     <ul className="space-y-4 lg:space-y-6">
                        {result.highlights.map((h: string, i: number) => (
                          <li key={i} className="flex gap-4 group">
                             <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-auurio-accent/10 border border-auurio-accent/20 flex-shrink-0 flex items-center justify-center text-[9px] lg:text-[10px] font-black group-hover:bg-auurio-accent group-hover:text-white transition-all">{i+1}</div>
                             <p className="font-medium leading-relaxed text-sm lg:text-base">{h}</p>
                          </li>
                        ))}
                     </ul>
                  </div>
               </div>
             )}

             {toolId === 'factchecker' && (
                <div className="space-y-6 lg:space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                      <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10 flex items-center justify-between">
                         <div>
                            <h3 className="text-white/30 text-[9px] lg:text-[10px] uppercase font-black tracking-widest mb-1">Ecosystem Credibility Index</h3>
                            <p className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-auurio-accent">{result.overallCredibility}</p>
                         </div>
                         <ShieldAlert className="w-8 h-8 lg:w-10 lg:h-10 text-auurio-accent opacity-20" />
                      </div>

                      {result.biases && result.biases.length > 0 && (
                        <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-yellow-500/10 bg-yellow-500/5 relative">
                           <div className="flex justify-between items-center mb-3">
                              <h3 className="text-yellow-500/40 text-[9px] lg:text-[10px] uppercase font-black tracking-widest">Detected Biases</h3>
                              <button onClick={() => copyToClipboard(result.biases.join(', '))} className="text-white/20 hover:text-white transition-colors">
                                 <Copy className="w-3 h-3" />
                              </button>
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {result.biases.map((bias: string, i: number) => (
                                <span key={i} className="text-[8px] lg:text-[9px] font-black uppercase px-2 py-1 bg-yellow-500/20 text-yellow-600 rounded border border-yellow-500/20">
                                  {bias}
                                </span>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>

                   <div className="space-y-3 lg:space-y-4">
                      <h4 className="text-[9px] uppercase font-black text-white/20 tracking-[0.2em] px-1">Detailed Claim Forensic Report</h4>
                      {result.claims.map((claim: any, i: number) => (
                        <div key={i} className="glass-card rounded-2xl p-5 lg:p-6 border-white/10 flex flex-col gap-2 lg:gap-3 group hover:border-white/20 transition-all">
                           <div className="flex justify-between items-start">
                              <span className={`text-[8px] lg:text-[9px] font-black uppercase px-2 lg:px-3 py-0.5 lg:py-1 rounded-full border ${
                                claim.status === 'verified' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                claim.status === 'questionable' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                {claim.status} Sync Status
                              </span>
                           </div>
                           <p className="font-black italic text-base lg:text-lg tracking-tight">{claim.claim}</p>
                           <p className="text-[11px] lg:text-sm text-white/50 leading-relaxed font-medium">{claim.explanation}</p>
                        </div>
                      ))}
                   </div>
                </div>
             )}

             {(toolId === 'writer' || toolId === 'threads' || toolId === 'newsletter' || typeof result === 'string') && (
                <div className="glass-card rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 border-white/10">
                   <div className="flex justify-between items-center mb-6 lg:mb-10">
                      <h3 className="text-white/30 text-[9px] lg:text-[10px] uppercase font-black tracking-widest">Zap Sync Output</h3>
                      <button onClick={() => copyToClipboard(typeof result === 'string' ? result : JSON.stringify(result, null, 2))} className="text-white/20 hover:text-auurio-accent transition-colors flex items-center gap-2 text-[9px] lg:text-[10px] font-black uppercase">
                        <Copy className="w-4 h-4" />
                        Copy Result
                      </button>
                   </div>
                   <div className="prose prose-invert max-w-none">
                      <p className="whitespace-pre-wrap leading-relaxed lg:leading-loose font-medium text-base lg:text-lg text-white/80">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</p>
                   </div>
                </div>
             )}

             {toolId === 'hooks' && Array.isArray(result) && (
                <div className="space-y-3 lg:space-y-4">
                   {result.map((h: any, i: number) => (
                      <div key={i} className="glass-card rounded-2xl p-5 lg:p-6 border-white/10 flex flex-col gap-2">
                         <div className="flex justify-between">
                            <span className="text-[8px] lg:text-[9px] font-black uppercase text-auurio-accent px-2 py-0.5 bg-auurio-accent/10 border border-auurio-accent/20 rounded-full">{h.type}</span>
                            <button onClick={() => copyToClipboard(h.title)} className="text-white/10 hover:text-white"><Copy className="w-3.5 h-3.5" /></button>
                         </div>
                         <p className="text-base lg:text-lg font-black tracking-tight">{h.title}</p>
                         <p className="text-[9px] lg:text-[10px] uppercase font-bold text-white/30 italic">{h.hook}</p>
                      </div>
                   ))}
                </div>
             )}

             {toolId === 'captions' && result.platforms && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                   {result.platforms.map((p: any, i: number) => (
                      <div key={i} className="glass-card rounded-2xl lg:rounded-3xl p-5 lg:p-6 border-white/10 flex flex-col gap-3 lg:gap-4">
                         <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-auurio-yellow">{p.name}</h4>
                         <p className="text-[10px] lg:text-[11px] font-medium leading-relaxed opacity-60 line-clamp-6">{p.caption}</p>
                         <div className="flex flex-wrap gap-1">
                            {p.hashtags.map((tag: string, j: number) => (
                               <span key={j} className="text-[8px] font-bold text-white/20">#{tag}</span>
                            ))}
                         </div>
                         <button onClick={() => copyToClipboard(p.caption)} className="mt-auto w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-colors">Copy Caption</button>
                      </div>
                   ))}
                </div>
             )}

             {toolId === 'analyzer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                   <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10 flex flex-col justify-center gap-2">
                      <span className="text-[9px] lg:text-[10px] font-black uppercase text-white/20">Velocity Score</span>
                      <span className="text-4xl lg:text-5xl font-black text-auurio-accent">{result.trendingScore}%</span>
                   </div>
                   <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10 flex flex-col justify-center gap-2">
                      <span className="text-[9px] lg:text-[10px] font-black uppercase text-white/20">Market Pull</span>
                      <span className="text-lg lg:text-xl font-black text-white">{result.velocity}</span>
                   </div>
                   <div className="md:col-span-2 glass-card rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-8 border-white/10">
                      <h4 className="text-[9px] lg:text-[10px] font-black uppercase text-white/20 mb-4 lg:mb-6">Opportunity Delta</h4>
                      <div className="space-y-3 lg:space-y-4">
                         {result.opportunities.map((o: string, i: number) => (
                            <div key={i} className="flex gap-4 items-center">
                               <div className="w-1.5 h-1.5 rounded-full bg-auurio-accent" />
                               <p className="font-bold text-xs lg:text-sm tracking-tight">{o}</p>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {toolId === 'breakdown' && (
                <div className="space-y-4 lg:space-y-6">
                   <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10">
                      <h4 className="text-[9px] lg:text-[10px] font-black uppercase text-white/20 mb-3 lg:mb-4">Definition</h4>
                      <p className="text-lg lg:text-xl font-medium italic opacity-80 leading-relaxed">"{result.simpleDefinition}"</p>
                   </div>
                   <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10">
                      <h4 className="text-[9px] lg:text-[10px] font-black uppercase text-white/20 mb-3 lg:mb-4">Analogy Sync</h4>
                      <p className="text-base lg:text-lg font-bold leading-relaxed">{result.realLifeExample}</p>
                   </div>
                   <div className="glass-card rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 border-white/10">
                      <h1 className="text-[9px] lg:text-[10px] font-black uppercase text-white/20 mb-6 lg:mb-8">Logic Flow</h1>
                      <div className="space-y-4 lg:space-y-6">
                        {result.stepByStep.map((step: string, i: number) => (
                           <div key={i} className="flex gap-4 lg:gap-6 items-start">
                              <span className="text-auurio-accent font-black text-xl lg:text-2xl tracking-tighter opacity-20">0{i+1}</span>
                              <p className="font-medium pt-1 leading-relaxed text-sm lg:text-base">{step}</p>
                           </div>
                        ))}
                      </div>
                   </div>
                </div>
             )}

             {toolId === 'opinion' && (
                <div className="space-y-4 lg:space-y-6">
                   <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-white/10">
                      <h4 className="text-[9px] lg:text-[10px] font-black uppercase text-white/20 mb-2">Neutral Core Pulse</h4>
                      <p className="font-medium text-sm lg:text-base">{result.neutralSummary}</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                      <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-green-500/10 bg-green-500/5">
                        <div className="flex justify-between items-center mb-4 lg:mb-6">
                           <h4 className="text-[9px] lg:text-[10px] font-black uppercase text-green-500/40">Pro Alignment</h4>
                           <button onClick={() => copyToClipboard(result.proArguments.join('\n'))} className="text-green-500/30 hover:text-green-500 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        <ul className="space-y-3 lg:space-y-4">
                           {result.proArguments.map((arg: string, i: number) => (
                             <li key={i} className="text-[11px] lg:text-xs font-bold leading-relaxed flex gap-2">
                                <span className="text-green-500">+</span>
                                {arg}
                             </li>
                           ))}
                        </ul>
                      </div>
                      <div className="glass-card rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-red-500/10 bg-red-500/5">
                        <div className="flex justify-between items-center mb-4 lg:mb-6">
                           <h4 className="text-[9px] lg:text-[10px] font-black uppercase text-red-500/40">Con Alignment</h4>
                           <button onClick={() => copyToClipboard(result.conArguments.join('\n'))} className="text-red-500/30 hover:text-red-500 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        <ul className="space-y-3 lg:space-y-4">
                           {result.conArguments.map((arg: string, i: number) => (
                             <li key={i} className="text-[11px] lg:text-xs font-bold leading-relaxed flex gap-2">
                                <span className="text-red-500">-</span>
                                {arg}
                             </li>
                           ))}
                        </ul>
                      </div>
                   </div>
                </div>
             )}

             {toolId === 'calendar' && (
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 lg:gap-4">
                  {result.map((c: any, i: number) => (
                    <div key={i} className="glass-card rounded-xl lg:rounded-2xl p-3 lg:p-4 border-white/10 flex flex-col gap-1 lg:gap-2 relative overflow-hidden">
                       <span className="text-[7px] lg:text-[8px] font-black uppercase text-white/20">{c.day}</span>
                       <h5 className="font-black text-[9px] lg:text-[10px] uppercase tracking-tighter text-auurio-accent">{c.postType}</h5>
                       <p className="text-[8px] lg:text-[9px] font-medium leading-tight opacity-50">{c.focus}</p>
                    </div>
                  ))}
               </div>
             )}

              {toolId === 'audio' && (
                <div className="glass-card rounded-[2.5rem] p-8 lg:p-12 border-auurio-accent/30 relative overflow-hidden bg-gradient-to-br from-auurio-accent/10 to-transparent">
                  <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="w-32 h-32 lg:w-40 lg:h-40 bg-black/40 rounded-[2rem] border border-white/10 flex items-center justify-center relative group">
                       <Mic2 className="w-12 h-12 lg:w-16 lg:h-16 text-auurio-accent animate-pulse" />
                       <div className="absolute inset-2 border-2 border-dashed border-auurio-accent/20 rounded-2xl animate-[spin_10s_linear_infinite]" />
                    </div>
                    
                    <div className="flex-grow space-y-4 text-center md:text-left">
                       <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                          <span className="text-[9px] font-black uppercase px-3 py-1 bg-auurio-accent text-white rounded-full tracking-widest">Protocol Sync: Ready</span>
                          <span className="text-[9px] font-black uppercase px-3 py-1 bg-white/5 text-white/50 border border-white/10 rounded-full tracking-widest">{audioSettings.voice} Voice</span>
                          <span className="text-[9px] font-black uppercase px-3 py-1 bg-white/5 text-white/50 border border-white/10 rounded-full tracking-widest">{audioSettings.tone} Tone</span>
                       </div>
                       <h3 className="text-2xl lg:text-3xl font-black italic tracking-tighter uppercase leading-none">Neural News Briefing Unit</h3>
                       <p className="text-[10px] lg:text-xs font-medium text-white/40 italic max-w-md">Audio stream generated via high-fidelity synthetic neural protocols. Frequency synchronized for ecosystem standards.</p>
                       
                       <div className="pt-4">
                          {result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ? (
                            <audio 
                              autoPlay 
                              controls 
                              className="w-full h-12 lg:h-14 opacity-90 brightness-110 filter hue-rotate-30" 
                              src={`data:audio/mp3;base64,${result.candidates[0].content.parts[0].inlineData.data}`}
                            />
                          ) : result?.response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ? (
                            <audio 
                              autoPlay 
                              controls 
                              className="w-full h-12 lg:h-14 opacity-90 brightness-110 filter hue-rotate-30" 
                              src={`data:audio/mp3;base64,${result.response.candidates[0].content.parts[0].inlineData.data}`}
                            />
                          ) : (
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-[10px] uppercase font-black text-white/30 text-center tracking-[0.2em]">
                               Audio Stream Handshake Failure
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 p-8 flex gap-1 opacity-20 pointer-events-none">
                     {[1,2,3,4,5].map(i => <div key={i} className={`w-1 bg-auurio-accent animate-[bounce_1s_infinite]`} style={{ height: `${i*10}px`, animationDelay: `${i*0.1}s` }} />)}
                  </div>
                </div>
              )}

             {toolId === 'alerts' && Array.isArray(result) && (
                <div className="space-y-3 lg:space-y-4">
                   {result.map((alert: any, i: number) => (
                      <div key={i} className="glass-card rounded-xl lg:rounded-2xl p-4 lg:p-6 border-white/10 flex items-center gap-4 lg:gap-6 relative overflow-hidden group">
                         <div className={`w-1.5 h-full absolute left-0 top-0 ${
                            alert.urgency === 'critical' ? 'bg-red-500' :
                            alert.urgency === 'high' ? 'bg-auurio-accent' :
                            'bg-auurio-yellow'
                         }`} />
                         <div className="flex-grow">
                            <div className="flex items-center gap-2 lg:gap-3 mb-1.5 lg:mb-2 text-[10px]">
                               <span className={`text-[7px] lg:text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                                  alert.urgency === 'critical' ? 'border-red-500/20 text-red-500 bg-red-500/10' :
                                  'border-white/10 text-white/40 bg-white/5'
                               }`}>{alert.urgency} Sync</span>
                               <span className="text-[7px] lg:text-[8px] font-black text-white/20 uppercase tracking-tighter">{alert.timestamp}</span>
                            </div>
                            <h4 className="text-base lg:text-lg font-black tracking-tight group-hover:text-auurio-accent transition-colors">{alert.title}</h4>
                         </div>
                         <Bell className="w-5 h-5 lg:w-6 lg:h-6 text-white/10 group-hover:text-auurio-accent/40 transition-all group-hover:scale-110 flex-shrink-0" />
                      </div>
                   ))}
                </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function getPlaceholder(id: NewsToolId): string {
  switch (id) {
    case 'summarizer': return 'Paste a news URL, article text, or a trending topic...';
    case 'factchecker': return 'Paste a news claim or text to verify its credibility...';
    case 'translator': return 'Enter text and specify target language...';
    case 'writer': return 'Enter original news content to rewrite...';
    case 'threads': return 'Paste a story to convert into a social media thread...';
    default: return 'Enter news content here...';
  }
}
