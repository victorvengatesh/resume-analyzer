import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, FileText, BarChart3, Users, ChevronRight, Play, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-bg-base overflow-hidden flex flex-col justify-between">
      {/* Background Gradients */}
      <div className="ambient-glow ambient-glow-1" />
      <div className="ambient-glow ambient-glow-2" />
      <div className="ambient-glow ambient-glow-3" />
      <div className="grid-overlay" />

      {/* Navbar */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight font-display">TalentAI</span>
            <span className="text-[10px] text-accent-cyan block tracking-widest uppercase">AI Recruitment OS</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/auth')} 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <Button 
            variant="primary" 
            size="sm" 
            iconRight={<ChevronRight className="w-4 h-4" />}
            onClick={() => navigate('/auth?demo=true')}
          >
            Launch Demo Sandbox
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 py-12 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left column: Text */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse pulse-glow-cyan" />
            <span>Next-Generation ATS Operating System</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight font-display text-white leading-tight">
            Analyze Resumes with <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300">Intelligence.</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl">
            Evaluate thousands of candidates in seconds. Extract clean skills, calculate precise confidence ratings, generate tailored interview scripts, and short-circuit recruitment latency.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth?demo=true')}
              className="shadow-neon-primary"
            >
              Start Free Demo
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              icon={<Play className="w-4 h-4" />}
              onClick={() => navigate('/auth')}
            >
              Sign In Account
            </Button>
          </div>

          {/* Quick Metrics */}
          <div className="pt-8 border-t border-glass-border grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold text-white font-display">99.8%</div>
              <div className="text-xs text-slate-500">Extraction Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-display">&lt; 1.5s</div>
              <div className="text-xs text-slate-500">Parsing Speed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-display">12,000+</div>
              <div className="text-xs text-slate-500">Resumes Evaluated</div>
            </div>
          </div>
        </motion.div>

        {/* Right column: Glass Interactive Scorecard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.15 }}
          className="relative lg:h-[550px] flex items-center justify-center"
        >
          {/* Animated Glowing Ring */}
          <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-400 filter blur-3xl opacity-20 animate-pulse" />

          {/* Floating UI Elements */}
          <motion.div 
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-full max-w-md glass-panel rounded-2xl p-6 relative z-10 border border-white/10"
          >
            {/* Top candidate header */}
            <div className="flex items-center gap-4 justify-between border-b border-glass-border pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white">VV</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Victor Vengatesh</h3>
                  <p className="text-[11px] text-slate-500">Applied: Senior Frontend Engineer</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-violet-400 font-display">91<span className="text-xs text-slate-400">/100</span></div>
                <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Strong Match</span>
              </div>
            </div>

            {/* ATS Score Details */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Frontend Architecture Analysis</span>
                  <span className="text-violet-400 font-bold">92%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "92%" }}
                    transition={{ duration: 1.2, delay: 0.5 }}
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Confidence Level</span>
                  <span className="text-cyan-400 font-bold">95%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "95%" }}
                    transition={{ duration: 1.2, delay: 0.7 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" 
                  />
                </div>
              </div>

              {/* Skills badges */}
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Primary Match Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {["React", "TypeScript", "TailwindCSS", "Framer Motion", "Vite"].map((s, idx) => (
                    <span key={idx} className="text-[11px] px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Reasoning Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold mb-1">
                  <Brain className="w-3.5 h-3.5" />
                  <span>AI Insight</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  "Demonstrates advanced knowledge of state synchronization mechanisms and optimized 60fps animations. Recommending immediate screen."
                </p>
              </div>
            </div>
          </motion.div>

          {/* Secondary mini floating tag */}
          <motion.div
            animate={{ y: [0, 10, 0], x: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute top-12 right-4 glass-panel border border-white/10 rounded-xl p-3.5 flex items-center gap-3 z-20 shadow-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Candidate Saved</div>
              <div className="text-xs font-semibold text-white">Shortlist Ready</div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-glass-border py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <div>© 2026 TalentAI Corporation. All rights reserved.</div>
          <div className="flex gap-4 mt-2 sm:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
