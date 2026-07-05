import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, GitCompare, Upload, Menu, X, Layers, Brain, LogOut, ShieldAlert
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { setAuthToken } from '../api';
import { useToast } from '../components/ui/Toast';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/bulk', label: 'Bulk Ranking', icon: Layers },
  { to: '/interview', label: 'Interview Copilot', icon: Brain },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/upload', label: 'Upload', icon: Upload },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { info } = useToast();

  const currentPage = nav.find(n => n.to === location.pathname)?.label || 'Dashboard';

  const handleLogout = () => {
    setAuthToken(null);
    info('Logged Out', 'Your sandbox session has been cleared.');
    navigate('/landing');
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-slate-100 flex relative overflow-hidden">
      {/* Visual background meshes */}
      <div className="ambient-glow ambient-glow-1 opacity-10" />
      <div className="ambient-glow ambient-glow-2 opacity-10" />
      <div className="grid-overlay" />

      {/* Sidebar */}
      <motion.aside
        animate={{ width: isCollapsed ? 76 : 260 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className={`fixed inset-y-0 left-0 z-50 bg-[#0e0e15]/90 backdrop-blur-xl border-r border-glass-border flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-glass-border h-[73px]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-900/40 cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }}
              className="flex-1"
            >
              <div className="text-sm font-bold text-white tracking-tight font-display">TalentAI</div>
              <div className="text-[9px] text-accent-cyan tracking-widest uppercase">Recruitment OS</div>
            </motion.div>
          )}
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                ${isActive
                  ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-violet-400" />
              {!isCollapsed && <span>{label}</span>}
              {!isCollapsed && location.pathname === to && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute right-3 w-1.5 h-1.5 rounded-full bg-violet-400"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-glass-border space-y-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900/60 border border-glass-border">
              <div className="w-7.5 h-7.5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                R
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">Sandbox Recruiter</div>
                <div className="text-[10px] text-slate-500">Enterprise AI</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition-all`}
            title="Sign Out Session"
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#07070a]/70 backdrop-blur-xl border-b border-glass-border px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-900 border border-glass-border"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white font-display tracking-tight">{currentPage}</h1>
            <p className="text-xs text-slate-500 hidden sm:block">Realtime candidate evaluation and matching framework</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-accent-cyan bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse pulse-glow-cyan" />
              Demo Engine Online
            </span>
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 text-xs text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="font-semibold">Local Fallback</span>
            </div>
          </div>
        </header>

        {/* Page content container */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
