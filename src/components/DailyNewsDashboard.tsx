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
  ChevronRight
} from 'lucide-react';
import { generateJSON } from '../lib/gemini';
import { Type } from '@google/genai';

export const DailyNewsDashboard: React.FC = () => {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        const result = await generateJSON("Current top global news topics for today. Provide a list of 5 items with detailed descriptions.", {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              time: { type: Type.STRING },
              impact: { type: Type.STRING },
              details: { type: Type.STRING }
            }
          }
        }, "You are the NewsLite Daily Dashboard. Curate technical and global news.");
        setNews(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-white/20">
      <Loader2 className="w-8 h-8 animate-spin mb-4" />
      <span className="text-[10px] uppercase font-black tracking-widest leading-none">Accessing Daily Pulse...</span>
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
           <h3 className="text-[9px] lg:text-[10px] uppercase font-black tracking-[0.3em] text-white/30 px-2 flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-auurio-accent animate-pulse" />
             Live Pulse Feed
           </h3>
           <div className="space-y-3 lg:space-y-4">
              {news.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.1 }}
                  onClick={() => setSelectedNews(item)}
                  className="glass-card rounded-2xl lg:rounded-[2rem] p-5 lg:p-6 border-white/10 hover:bg-white/5 transition-all group cursor-pointer hover:border-auurio-accent/30"
                >
                   <div className="flex justify-between items-start mb-3 lg:mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] lg:text-[9px] font-black uppercase px-2 py-0.5 bg-auurio-accent/10 text-auurio-accent border border-auurio-accent/20 rounded-full">{item.category}</span>
                        <div className="flex items-center gap-1 text-[8px] lg:text-[9px] font-black uppercase text-white/20">
                          <Clock className="w-2.5 h-2.5" />
                          {item.time}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-white/0 group-hover:text-white/20 transition-all hidden lg:block" />
                   </div>
                   <h4 className="text-base lg:text-lg font-black tracking-tight mb-2 group-hover:text-auurio-accent transition-colors leading-tight">{item.title}</h4>
                   <p className="text-[10px] lg:text-xs font-medium text-white/40 italic">"{item.impact}"</p>
                </motion.div>
              ))}
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

                 <div className="p-6 lg:p-8 bg-white/5 rounded-3xl border border-white/5">
                   <p className="text-xs lg:text-sm text-white/60 leading-relaxed font-medium">
                     {selectedNews.details || selectedNews.impact}
                   </p>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button 
                      onClick={() => alert("Redirecting to analysis unit...")}
                      className="flex-grow bg-white text-black py-4 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-[9px] lg:text-[10px] flex items-center justify-center gap-3 hover:bg-auurio-accent hover:text-white transition-all shadow-xl shadow-white/5"
                    >
                      Process with AI <ChevronRight className="w-4 h-4" />
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

