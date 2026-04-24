import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Newspaper, 
  Clock, 
  Zap, 
  Globe, 
  User, 
  ArrowUpRight,
  ExternalLink,
  Loader2,
  X,
  ShieldCheck,
  ChevronRight,
  FileText,
  Mic2,
  Languages,
  Share2
} from 'lucide-react';
import { generateJSON } from '../lib/gemini';
import { Type } from '@google/genai';
import { NewsToolId } from '../types';

interface DailyNewsDashboardProps {
  onLaunchTool?: (toolId: NewsToolId, input: string) => void;
}

export const DailyNewsDashboard: React.FC<DailyNewsDashboardProps> = ({ onLaunchTool }) => {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('Global');

  const regions = ['Global', 'Bangladesh', 'India', 'USA', 'Iran', 'Israel', 'UK', 'China', 'Europe', 'Middle East', 'Japan', 'Russia', 'Australia', 'Brazil', 'Canada'];

  const getRegionLanguage = (region: string) => {
    switch (region) {
      case 'Bangladesh': return 'Bengali';
      case 'India': return 'Hindi/English';
      case 'USA': return 'English';
      case 'Iran': return 'Persian';
      case 'Israel': return 'Hebrew/English';
      case 'China': return 'Chinese';
      case 'Japan': return 'Japanese';
      case 'Russia': return 'Russian';
      case 'Brazil': return 'Portuguese';
      case 'UK':
      case 'Australia': 
      case 'Canada':
        return 'English';
      default: return 'English';
    }
  };

  useEffect(() => {
    async function fetchNews() {
      setRefreshing(true);
      try {
        const regionQuery = selectedRegion === 'Global' ? 'global' : `specific to ${selectedRegion}`;
        const targetLang = getRegionLanguage(selectedRegion);
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Fetching list without full details for speed
        const result = await generateJSON(`Current top ${regionQuery} news topics for today, ${today}. 
          Provide a list of 12 items with sharp, punchy summaries. 
          STRICT: Only news from the last 24h. No placeholders.
          Format titles as "Title in Language | English Title" for non-US regions.`, {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              time: { type: Type.STRING },
              impact: { type: Type.STRING }
            }
          }
        }, `NewsLite High-Speed Curate. Region: ${selectedRegion}. Lang: ${targetLang}.`);
        setNews(result);
        setLoading(false);
      } catch (e) {
        console.error(e);
      } finally {
        setRefreshing(false);
      }
    }
    fetchNews();
  }, [selectedRegion]);

  const [detailLoading, setDetailLoading] = useState(false);

  const handleSelectNews = async (item: any) => {
    setSelectedNews(item);
    if (!item.details) {
      setDetailLoading(true);
      try {
        const result = await generateJSON(`Provide a very detailed, comprehensive analysis (at least 300 words) for this news item: "${item.title}".
          Include context, potential future implications, and diverse perspectives.
          User requested maximum detail.`, {
          type: Type.OBJECT,
          properties: {
            details: { type: Type.STRING }
          }
        }, "Expert Investigative Journalist. Depth and nuance are mandatory.");
        
        const updatedNews = news.map(n => n.title === item.title ? { ...n, details: result.details } : n);
        setNews(updatedNews);
        setSelectedNews({ ...item, details: result.details });
      } catch (e) {
        console.error("Failed to fetch details:", e);
      } finally {
        setDetailLoading(false);
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white/20 gap-6">
      <div className="relative">
        <Loader2 className="w-12 h-12 animate-spin text-auurio-accent" />
        <div className="absolute inset-0 blur-xl bg-auurio-accent/20 animate-pulse rounded-full" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase font-black tracking-[0.3em] animate-pulse">Initializing Neural Link</span>
        <span className="text-[8px] uppercase font-bold text-white/10 tracking-[0.1em]">Syncing regional protocols...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 lg:space-y-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { label: 'Ecosystem', value: 'Nominal', icon: Zap, color: 'text-auurio-accent' },
          { label: 'News Load', value: 'High', icon: Globe, color: 'text-blue-400' },
          { label: 'Curations', value: '12.4k', icon: Newspaper, color: 'text-green-400' },
          { label: 'Velocity', value: '+24%', icon: TrendingUp, color: 'text-auurio-yellow' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-card rounded-2xl lg:rounded-3xl p-4 lg:p-6 border-white/10 flex flex-col justify-between aspect-square lg:aspect-video cursor-default hover:border-white/20 transition-all"
          >
             <div className="flex justify-between items-start">
               <stat.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${stat.color}`} />
               <ArrowUpRight className="w-3 h-3 text-white/10" />
             </div>
             <div>
                <p className="text-[7px] lg:text-[9px] uppercase font-black tracking-widest text-white/30 mb-0.5 lg:mb-1">{stat.label}</p>
                <h4 className="text-lg lg:text-2xl font-black italic tracking-tighter">{stat.value}</h4>
             </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
              <h3 className="text-[9px] lg:text-[10px] uppercase font-black tracking-[0.3em] text-white/30 flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-auurio-accent animate-ping' : 'bg-green-500 animate-pulse'}`} />
                Live Pulse Feed
                {refreshing && <span className="text-auurio-accent/50 animate-pulse lowercase font-medium tracking-normal text-[8px]">Syncing...</span>}
              </h3>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-3 -mb-3 scroll-smooth">
                 <div className="flex items-center gap-2 flex-nowrap pr-12">
                   {regions.map(region => (
                     <button
                       key={region}
                       onClick={() => setSelectedRegion(region)}
                       className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all border shrink-0 ${
                         selectedRegion === region 
                         ? 'bg-auurio-accent border-auurio-accent text-white shadow-lg shadow-auurio-accent/20' 
                         : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                       }`}
                     >
                       {region}
                     </button>
                   ))}
                 </div>
              </div>
           </div>
           <div className="relative">
             <div className={`space-y-3 lg:space-y-4 transition-all duration-500 ${refreshing ? 'opacity-30 blur-[2px] grayscale pointer-events-none' : 'opacity-100 blur-0 grayscale-0'}`}>
                {news.map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleSelectNews(item)}
                    className="glass-card rounded-2xl lg:rounded-[2rem] p-5 lg:p-6 border-white/10 hover:bg-white/5 transition-all group cursor-pointer hover:border-auurio-accent/30"
                  >
                     <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] lg:text-[9px] font-black uppercase px-2 py-0.5 bg-white/5 group-hover:bg-auurio-accent/20 group-hover:text-auurio-accent text-white/40 rounded-full border border-white/10 transition-all">{item.category}</span>
                           <div className="flex items-center gap-1 text-[8px] lg:text-[9px] font-bold text-white/20 uppercase">
                             <Clock className="w-3 h-3" /> {item.time}
                           </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-white/10 group-hover:text-auurio-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                     </div>
                     <h4 className="text-sm lg:text-xl font-black italic tracking-tight mb-2 group-hover:text-white transition-colors leading-tight">{item.title}</h4>
                     <p className="text-[10px] lg:text-xs text-white/40 line-clamp-2 leading-relaxed group-hover:text-white/60 transition-colors font-medium">"{item.impact}"</p>
                  </motion.div>
                ))}
             </div>

             <AnimatePresence>
                {refreshing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 rounded-[2rem] lg:rounded-[3rem]"
                  >
                    <div className="flex flex-col items-center gap-4 p-8 glass-card border-white/5 rounded-3xl shadow-2xl">
                      <div className="relative">
                        <Loader2 className="w-10 h-10 animate-spin text-auurio-accent" />
                        <div className="absolute inset-0 blur-lg bg-auurio-accent/40 animate-pulse rounded-full" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80">Updating Pulse</span>
                        <div className="flex gap-1.5 mt-2">
                           {[0, 1, 2].map((_, i) => (
                             <motion.div 
                               key={i}
                               animate={{ opacity: [0.2, 1, 0.2] }}
                               transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                               className="w-1 h-1 bg-auurio-accent rounded-full"
                             />
                           ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>
           </div>
        </div>

        <div className="space-y-6 lg:space-y-10">
           <div className="glass-card rounded-3xl lg:rounded-[2.5rem] p-8 lg:p-10 border-auurio-accent/20 relative overflow-hidden bg-gradient-to-br from-auurio-accent/5 to-transparent">
              <Zap className="absolute -top-10 -right-10 w-40 h-40 text-auurio-accent/5" />
              <h3 className="text-lg lg:text-xl font-black uppercase tracking-tighter mb-4 pr-10">Ecosystem Upgrade</h3>
              <p className="text-[10px] lg:text-xs text-white/50 leading-relaxed font-medium mb-8">
                 Unlock scene-by-scene video generation and high-fidelity audio by upgrading your unit level.
              </p>
              <button 
                onClick={() => alert("Upgrade system initializing. Contact ecosystem admin for token acquisition.")}
                className="w-full bg-auurio-accent text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] lg:text-[10px] shadow-lg shadow-auurio-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Unlock Full Power
              </button>
           </div>

           <div className="glass-card rounded-3xl p-6 lg:p-8 border-white/5">
              <h3 className="text-[9px] lg:text-[10px] uppercase font-black tracking-[0.3em] text-white/20 mb-6">Recent Pulses</h3>
              <div className="space-y-5 lg:space-y-6">
                {[
                  { tool: 'Summarizer', time: '14m ago', status: 'Success' },
                  { tool: 'Fact Checker', time: '1h ago', status: 'Flagged' },
                  { tool: 'Translator', time: '3h ago', status: 'Success' },
                ].map((log, i) => (
                  <div key={i} className="flex justify-between items-center text-[9px] lg:text-[10px] font-black uppercase hover:bg-white/5 p-2 rounded-lg cursor-default transition-all">
                     <div className="flex flex-col">
                        <span className="text-white/60">{log.tool}</span>
                        <span className="text-white/20 italic font-medium">{log.time}</span>
                     </div>
                     <span className={log.status === 'Success' ? 'text-green-500' : 'text-auurio-yellow'}>{log.status}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedNews && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedNews(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-[2.5rem] lg:rounded-[3.5rem] p-8 lg:p-12 border-white/10 custom-scrollbar"
            >
              <div className="absolute top-8 right-8 z-20">
                <button 
                  onClick={() => setSelectedNews(null)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all"
                >
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              <div className="relative z-10 space-y-6 lg:space-y-8">
                 <div className="flex items-center gap-3">
                   <span className="text-[9px] font-black uppercase px-3 py-1 bg-auurio-accent/10 text-auurio-accent border border-auurio-accent/20 rounded-full">{selectedNews.category}</span>
                   <span className="text-[9px] font-black uppercase text-white/20 italic">{selectedNews.time}</span>
                 </div>

                 <h2 className="text-2xl lg:text-4xl font-black italic tracking-tighter uppercase leading-none">
                   {selectedNews.title}
                 </h2>

                 <div className="p-6 lg:p-8 bg-white/5 rounded-3xl border border-white/5 max-h-60 overflow-y-auto custom-scrollbar relative min-h-[120px]">
                   {detailLoading ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/20 backdrop-blur-sm rounded-3xl">
                        <Loader2 className="w-6 h-6 animate-spin text-auurio-accent" />
                        <span className="text-[9px] font-black uppercase text-white/40 tracking-widest animate-pulse">Deep-Linking Analysis...</span>
                     </div>
                   ) : (
                     <p className="text-xs lg:text-sm text-white/60 leading-relaxed font-medium whitespace-pre-wrap">
                       {selectedNews.details || selectedNews.impact}
                     </p>
                   )}
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[9px] uppercase font-black tracking-widest text-white/30 px-1">Available Processing Protocols</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                       {[
                         { id: 'summarizer', label: 'Summarize', icon: FileText, color: 'text-blue-400' },
                         { id: 'factchecker', label: 'Fact Check', icon: ShieldCheck, color: 'text-red-400' },
                         { id: 'audio', label: 'Audio Brief', icon: Mic2, color: 'text-purple-400' },
                         { id: 'translator', label: 'Translate', icon: Languages, color: 'text-green-400' },
                         { id: 'threads', label: 'Social Thread', icon: Share2, color: 'text-auurio-accent' },
                       ].map((tool) => (
                         <button 
                           key={tool.id}
                           onClick={() => onLaunchTool?.(tool.id as NewsToolId, selectedNews.details || selectedNews.impact)}
                           className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                         >
                            <tool.icon className={`w-4 h-4 ${tool.color}`} />
                            <span className="text-[9px] font-black uppercase text-white/40 group-hover:text-white transition-colors">{tool.label}</span>
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button 
                      onClick={() => onLaunchTool?.('summarizer', selectedNews.details || selectedNews.impact)}
                      className="flex-grow bg-white text-black py-4 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-[9px] lg:text-[10px] flex items-center justify-center gap-3 hover:bg-auurio-accent hover:text-white transition-all shadow-xl shadow-white/5"
                    >
                      Quick Analysis <ChevronRight className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setSelectedNews(null)}
                      className="px-8 bg-white/5 border border-white/10 text-white/40 py-4 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-[9px] lg:text-[10px] hover:text-white hover:bg-white/10 transition-all"
                    >
                      Dismiss
                    </button>
                 </div>
              </div>

              <Zap className="absolute -bottom-20 -left-20 w-80 h-80 text-auurio-accent/5 pointer-events-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

