import { useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, signInWithAuurio } from './lib/firebase';
import { getAI } from './lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  LogIn, 
  Database, 
  User as UserIcon, 
  Coins, 
  Loader2, 
  Newspaper, 
  Zap, 
  Globe, 
  TrendingUp, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileText,
  Languages,
  PenTool,
  CheckCircle2,
  Share2,
  Anchor,
  Instagram,
  Mail,
  Mic2,
  BookOpen,
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Bell,
  Video,
  Search,
  Settings,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
import { NewsTool, NewsToolId } from './types';
import { ToolRenderer } from './components/ToolRenderer';
import { DailyNewsDashboard } from './components/DailyNewsDashboard';

const TOOLS: NewsTool[] = [
  { id: 'audio', name: 'Audio News Generator', description: 'Instantly turn any text into a professional radio-style audio briefing with realistic AI voices.', icon: 'Mic2', category: 'core', status: 'live' },
  { id: 'dashboard', name: 'Intelligence Hub', description: 'Your command center for real-time global news pulses and ecosystem performance tracking.', icon: 'LayoutDashboard', category: 'core', status: 'live' },
  { id: 'summarizer', name: 'Smart Summarizer', description: 'Saves you hours of reading by condensing long articles into quick, easy-to-read bullet points.', icon: 'FileText', category: 'core', status: 'live' },
  { id: 'factchecker', name: 'Fact Checker', description: 'Automatically verifies claims and identifies hidden biases to ensure you stay informed with the truth.', icon: 'ShieldCheck', category: 'core', status: 'live' },
  { id: 'breakdown', name: 'Topic Breakdown', description: 'Explains complex technical news using simple real-world analogies that anyone can understand.', icon: 'BookOpen', category: 'core', status: 'live' },
  { id: 'translator', name: 'Global Translator', description: 'Perfectly translates news into multiple languages while keeping the same professional tone.', icon: 'Languages', category: 'audience', status: 'live' },
  { id: 'writer', name: 'AI News Writer', description: 'Write polished news articles, blog posts, or reports from raw data in just a few clicks.', icon: 'PenTool', category: 'audience', status: 'live' },
  { id: 'threads', name: 'Social Thread Gen', description: 'Turns long reports into engaging 10-part social media threads that people actually want to read.', icon: 'Share2', category: 'audience', status: 'live' },
  { id: 'hooks', name: 'Headline & Hook', description: 'Get 5 magnetic headlines and attention-grabbing hooks to make your content go viral.', icon: 'Anchor', category: 'growth', status: 'live' },
  { id: 'captions', name: 'Smart Captions', description: 'Ready-to-post captions and hashtags for Instagram, YouTube, and Facebook in seconds.', icon: 'Instagram', category: 'growth', status: 'live' },
  { id: 'analyzer', name: 'Trend Analyzer', description: 'Predicts which news topics are about to go viral so you can stay ahead of the curve.', icon: 'TrendingUp', category: 'growth', status: 'live' },
  { id: 'newsletter', name: 'Newsletter Pro', description: 'Crafts beautiful, curated email newsletters from multiple news topics automatically.', icon: 'Mail', category: 'growth', status: 'live' },
  { id: 'calendar', name: 'Content Planner', description: 'Builds a 7-day posting schedule based on trending news to keep your audience engaged.', icon: 'Calendar', category: 'growth', status: 'live' },
  { id: 'opinion', name: 'Perspective Matrix', description: 'Generates balanced "Pro vs Con" arguments for any story to help you see the full picture.', icon: 'MessageSquare', category: 'internal', status: 'live' },
  { id: 'alerts', name: 'Breaking Alerts', description: 'Stay updated with urgent real-time alerts on critical global developments as they happen.', icon: 'Bell', category: 'internal', status: 'live' },
  { id: 'video', name: 'Video Generator', description: 'Coming Soon: Transform your news scripts into high-impact social media video assets.', icon: 'Video', category: 'internal', status: 'under-construction' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<NewsToolId>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState('');

  const [isSyncingKey, setIsSyncingKey] = useState(false);
  const isEnvKeyMissing = !process.env.GEMINI_API_KEY && !(import.meta as any).env?.VITE_GEMINI_API_KEY;
  const isCustomDomain = typeof window !== 'undefined' && !window.location.hostname.includes('run.app') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  const isApiKeyMissing = isEnvKeyMissing && !localStorage.getItem('auurio_gemini_key');

  useEffect(() => {
    const syncHubKey = async () => {
      // Re-sync if env key is missing AND we don't have a cached key OR user just logged in
      if (isEnvKeyMissing) {
        setIsSyncingKey(true);
        try {
          // Reset internal state in gemini.ts if needed (though it caches in memory)
          await getAI();
        } catch (e) {
          console.error("Hub Sync Background Error:", e);
        } finally {
          setIsSyncingKey(false);
        }
      }
    };
    syncHubKey();
  }, [isEnvKeyMissing, user]);
  const launchToolWithInput = useCallback((toolId: NewsToolId, input: string) => {
    setPrefilledInput(input);
    setActiveTool(toolId);
  }, []);

  const syncUserCredits = useCallback(async (currentUser: User) => {
    const userRef = doc(db, 'users', currentUser.uid);
    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setCredits(userDoc.data().credits);
      } else {
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          credits: 100,
          updatedAt: serverTimestamp()
        });
        setCredits(100);
      }
    } catch (error: any) {
      console.error("Credit sync failed:", error);
      if (error.message?.includes('permission') || error.code === 'permission-denied') {
        // We can show a toast or a non-blocking message
        console.warn("AUR-SEC: Hub sync restricted. Please verify domain authorization in Console.");
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await syncUserCredits(u);
      else {
        const params = new URLSearchParams(window.location.search);
        if (params.get('sso') === 'true' && params.get('email')) {
          signInWithAuurio(params.get('email')!).catch(() => {});
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [syncUserCredits]);

  const filteredTools = useMemo(() => {
    return TOOLS.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const renderIcon = (name: string, active: boolean) => {
    const props = { className: `w-5 h-5 ${active ? 'text-auurio-accent' : 'text-white/40'}` };
    switch (name) {
      case 'LayoutDashboard': return <LayoutDashboard {...props} />;
      case 'FileText': return <FileText {...props} />;
      case 'ShieldCheck': return <ShieldCheck {...props} />;
      case 'BookOpen': return <BookOpen {...props} />;
      case 'Languages': return <Languages {...props} />;
      case 'PenTool': return <PenTool {...props} />;
      case 'Share2': return <Share2 {...props} />;
      case 'Anchor': return <Anchor {...props} />;
      case 'Instagram': return <Instagram {...props} />;
      case 'TrendingUp': return <TrendingUp {...props} />;
      case 'Mail': return <Mail {...props} />;
      case 'Calendar': return <Calendar {...props} />;
      case 'MessageSquare': return <MessageSquare {...props} />;
      case 'Mic2': return <Mic2 {...props} />;
      case 'Bell': return <Bell {...props} />;
      case 'Video': return <Video {...props} />;
      default: return <Zap {...props} />;
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-black/80 backdrop-blur-3xl lg:bg-black/40">
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-auurio-accent to-auurio-yellow rounded-xl flex items-center justify-center shadow-lg transform -rotate-3">
              <Newspaper className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter">NEWSLITE</h1>
              <span className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-black">Ecosystem v1.0</span>
            </div>
          </div>
          <button className="lg:hidden p-2 hover:bg-white/5 rounded-lg" onClick={() => setIsMenuOpen(false)}>
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text" 
            placeholder="Search tools..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:outline-none focus:border-auurio-accent/50 transition-colors" 
          />
        </div>

        <div className="space-y-8 h-[calc(100vh-340px)] overflow-y-auto no-scrollbar">
          {(['core', 'audience', 'growth', 'internal'] as const).map(cat => {
            const catTools = filteredTools.filter(t => t.category === cat);
            if (catTools.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-black px-4">{cat} MODULES</h3>
                <div className="space-y-1">
                  {catTools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setActiveTool(tool.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${activeTool === tool.id ? 'bg-auurio-accent/10 border border-auurio-accent/20' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      {renderIcon(tool.icon, activeTool === tool.id)}
                      <span className={`text-[11px] font-black uppercase tracking-widest ${activeTool === tool.id ? 'text-auurio-accent' : 'text-white/50 group-hover:text-white'}`}>
                        {tool.name}
                      </span>
                      {tool.status === 'under-construction' && (
                        <div className="ml-auto w-1.5 h-1.5 bg-auurio-yellow rounded-full animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto p-6 lg:p-8 border-t border-white/5 space-y-4">
         {user ? (
           <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="w-10 h-10 rounded-full border border-white/10 p-0.5">
                {user.photoURL ? <img src={user.photoURL} className="rounded-full w-full h-full object-cover" alt="pfp" /> : <UserIcon className="p-2 opacity-40" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black uppercase tracking-tighter truncate">{user.displayName || user.email}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Coins className="w-3 h-3 text-auurio-yellow" />
                  <span className="text-[10px] font-black text-auurio-yellow">{credits ?? '...'}</span>
                </div>
              </div>
           </div>
         ) : (
           <button onClick={() => signInWithAuurio()} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-auurio-accent hover:text-white transition-all flex items-center justify-center gap-3">
             <LogIn className="w-4 h-4" />
             Sync Hub
           </button>
         )}
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-auurio-black flex items-center justify-center">
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}>
        <Zap className="text-auurio-accent w-16 h-16 shadow-[0_0_50px_rgba(249,115,22,0.3)]" />
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-auurio-black flex text-white font-sans selection:bg-auurio-accent selection:text-white overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-80 border-r border-white/5 flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-80 shadow-2xl"
            >
              <SidebarContent />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Panel */}
      <main className="flex-grow min-h-screen flex flex-col relative bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.05)_0%,transparent_50%)]">
        <header className="px-6 lg:px-10 py-4 lg:py-6 border-b border-white/5 flex justify-between items-center backdrop-blur-xl sticky top-0 z-50">
          {isApiKeyMissing && isCustomDomain && (
            <div className="absolute top-full left-0 right-0 bg-auurio-accent text-white py-2 px-4 text-[9px] font-black uppercase tracking-widest text-center animate-pulse z-50 flex items-center justify-center gap-2">
              <Zap className="w-3 h-3 animate-bounce" />
              Intelligence Protocols Offline: Keys missing from Hub. Please ensure Admin Config is Set.
            </div>
          )}
          <div className="flex items-center gap-4">
             <button className="lg:hidden p-2 hover:bg-white/5 rounded-lg" onClick={() => setIsMenuOpen(true)}>
               <Menu className="w-5 h-5 text-white/50" />
             </button>
             <div className="flex items-center gap-4">
               <div className="p-2 bg-auurio-accent/10 rounded-lg hidden sm:block">
                  {renderIcon(TOOLS.find(t => t.id === activeTool)?.icon || 'Zap', true)}
               </div>
               <div>
                  <h2 className="text-sm lg:text-lg font-black tracking-tight uppercase">{TOOLS.find(t => t.id === activeTool)?.name}</h2>
                  <p className="text-[8px] lg:text-[9px] font-bold text-white/30 uppercase tracking-widest">{TOOLS.find(t => t.id === activeTool)?.category} Unit</p>
               </div>
             </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 group cursor-help transition-all hover:bg-white/10">
               <Zap className="w-3.5 h-3.5 text-auurio-accent" />
               <span className="text-[10px] font-black tracking-widest uppercase">Zap protocol</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-white/10" />
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-white/40" />
            </button>
            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors hidden sm:block"
            >
              <HelpCircle className="w-4 h-4 text-white/40" />
            </button>
          </div>
        </header>

        <section className="p-6 lg:p-10 flex-grow">
           <AnimatePresence mode="wait">
              {!user ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[60vh] py-10 lg:py-20 text-center max-w-xl mx-auto">
                   <ShieldCheck className="w-16 h-16 lg:w-20 lg:h-20 text-auurio-accent mb-10 opacity-20" />
                   <h2 className="text-3xl lg:text-4xl font-black mb-6 leading-tight uppercase tracking-tighter">Centralized Authentication Required</h2>
                   <p className="text-sm lg:text-base text-white/40 mb-12 font-medium leading-relaxed">
                     NewsLite is a professional unit within the Auurio Ecosystem. Proximity to your Hub is required to access AI processing tokens.
                   </p>
                   <button onClick={() => signInWithAuurio()} className="bg-auurio-accent text-white px-10 lg:px-12 py-4 lg:py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_15px_40px_rgba(249,115,22,0.3)] hover:scale-105 transition-all active:scale-95 flex items-center gap-4">
                      Connect Auurio Hub
                      <ChevronRight className="w-5 h-5" />
                   </button>
                </motion.div>
              ) : (
                <motion.div key={activeTool} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-full">
                  {activeTool === 'dashboard' ? (
                     <DailyNewsDashboard onLaunchTool={launchToolWithInput} />
                  ) : activeTool === 'video' || TOOLS.find(t => t.id === activeTool)?.status === 'under-construction' ? (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] border-2 border-dashed border-white/5 rounded-[2rem] lg:rounded-[3rem] p-8 lg:p-12 text-center opacity-40">
                       <div className="p-6 lg:p-8 bg-white/5 rounded-full mb-8">
                         {renderIcon(TOOLS.find(t => t.id === activeTool)?.icon || 'Zap', true)}
                       </div>
                       <h3 className="text-xl lg:text-2xl font-black uppercase mb-4 tracking-tighter">{activeTool.replace(/-/g, ' ')} Module CALIBRATING</h3>
                       <p className="max-w-md font-medium text-xs lg:text-sm italic">This specific unit is being optimized for mobile sovereignty. Estimated delta synchronization: Next Update Cycle.</p>
                    </div>
                  ) : (
                    <ToolRenderer 
                      toolId={activeTool} 
                      toolName={TOOLS.find(t => t.id === activeTool)?.name || ''}
                      toolDescription={TOOLS.find(t => t.id === activeTool)?.description || ''}
                      user={user} 
                      credits={credits} 
                      setCredits={setCredits} 
                      initialInput={prefilledInput}
                      onClearInitialInput={() => setPrefilledInput('')}
                    />
                  )}
                </motion.div>
              )}
           </AnimatePresence>
        </section>

        <footer className="px-6 lg:px-10 py-6 lg:py-8 border-t border-white/5 bg-black/20 flex flex-col md:flex-row justify-between items-center gap-6 mt-auto">
           <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-auurio-accent" />
              <span className="text-[10px] lg:text-xs font-black tracking-tight italic opacity-60 uppercase text-center md:text-left">Abdul Barek (DIsat) // Part of the Auurio Ecosystem</span>
           </div>
           <div className="flex items-center gap-6 lg:gap-8 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] text-white/20">
              <a href="https://auurio.com" target="_blank" rel="noreferrer" className="hover:text-auurio-accent transition-colors flex items-center gap-1.5">
                Central Hub <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <button onClick={() => setShowHelp(true)} className="hover:text-white transition-colors">Terms</button>
              <button onClick={() => setShowHelp(true)} className="hover:text-white transition-colors">Privacy</button>
           </div>
        </footer>
      </main>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card rounded-3xl p-8 border-white/10"
            >
              <h3 className="text-xl font-black italic tracking-tighter uppercase mb-6">Unit Configuration</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-white/30 tracking-widest">Protocol Version</label>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs font-bold text-white/60">v1.2.4-stable (Neural Hub Linked)</div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[9px] uppercase font-black text-white/30 tracking-widest">Ecosystem Preferences</h4>
                  <div className="space-y-2">
                    {['Auto-Sync News', 'High-Fidelity Audio', 'Neural Enhancement'].map(pref => (
                      <div key={pref} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[10px] font-bold uppercase">{pref}</span>
                        <div className="w-8 h-4 bg-auurio-accent rounded-full relative">
                          <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="mt-8 w-full bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">Synchronize & Exit</button>
            </motion.div>
          </div>
        )}

        {showHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHelp(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card rounded-3xl p-8 border-white/10"
            >
              <h3 className="text-xl font-black italic tracking-tighter uppercase mb-6">Support Logistics</h3>
              <div className="space-y-6">
                <p className="text-xs text-white/50 leading-relaxed font-medium">Welcome to the NewsLite Unit. If you encounter logic gaps or synchronization failures, initiate a manual pulse by refreshing your session.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-auurio-accent/10 border border-auurio-accent/20 rounded-2xl">
                    <Zap className="w-5 h-5 text-auurio-accent mb-2" />
                    <span className="text-[9px] font-black uppercase block">Instant Sync</span>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <HelpCircle className="w-5 h-5 text-white/20 mb-2" />
                    <span className="text-[9px] font-black uppercase block">Admin Hub</span>
                  </div>
                </div>
                <button onClick={() => setShowHelp(false)} className="w-full bg-auurio-accent text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-auurio-accent/20">Acknowledge</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
