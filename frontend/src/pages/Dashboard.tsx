import { useEffect, useState, ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, TrendingUp, Award, Zap, ArrowRight, Upload, BarChart3, 
  CheckCircle2, AlertTriangle, Briefcase, Clock, XCircle, Trophy, 
  ArrowDown, Brain, RefreshCw 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchDashboardStats, fetchCandidates, fetchAiInsights, DashboardStats, Candidate, getScoreColor } from '../api';
import { pageVariants, staggerContainer, listItem, spring } from '../lib/motion';
import { Button } from '../components/ui/Button';

const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#f43f5e'];

function StatCard({ icon: Icon, label, value, sub, color = 'violet' }: {
  icon: ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-600 to-indigo-650 shadow-violet-950/20 border-violet-500/20',
    emerald: 'from-emerald-600 to-teal-650 shadow-emerald-950/20 border-emerald-500/20',
    sky: 'from-sky-600 to-blue-650 shadow-blue-950/20 border-blue-500/20',
    amber: 'from-amber-500 to-orange-600 shadow-amber-950/20 border-amber-500/20',
    rose: 'from-rose-600 to-red-650 shadow-rose-950/20 border-rose-500/20',
  };

  return (
    <motion.div 
      variants={listItem}
      whileHover={{ y: -4, scale: 1.01 }}
      className="glass-panel rounded-2xl p-5 flex items-center gap-4 border border-glass-border hover:border-slate-700/60 transition-all duration-300 relative overflow-hidden group shadow-md"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center flex-shrink-0 shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-white font-display tracking-tight">{value}</div>
        <div className="text-xs text-slate-400 font-medium truncate uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</div>}
      </div>
      {/* Decorative neon linear line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </motion.div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [s, c] = await Promise.all([fetchDashboardStats(), fetchCandidates({ limit: 5 })]);
      setStats(s);
      setCandidates(c);
      
      // Load AI Insights
      setInsightsLoading(true);
      const aiData = await fetchAiInsights();
      setInsights(aiData.insights);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-semibold">Syncing Recruiter Cockpit...</p>
        </div>
      </div>
    );
  }

  const topSkillsChart = (stats?.top_skills || []).map(s => ({ name: s.name, count: s.count }));
  const matchDist = stats?.match_level_distribution || [];

  return (
    <motion.div 
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white font-display tracking-tight">Talent Telemetry</h2>
          <p className="text-slate-500 text-xs">Realtime parsing statistics and pipeline overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw className="w-4 h-4" />}
            title="Refresh metrics"
          />
          <Button
            onClick={() => navigate('/upload')}
            icon={<Upload className="w-4 h-4" />}
            className="shadow-neon-primary"
          >
            Upload Resumes
          </Button>
        </div>
      </div>

      {/* Stat Cards Pipeline */}
      <motion.div 
        variants={staggerContainer} 
        className="grid grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <StatCard icon={Users} label="Total Resumes" value={stats?.total_candidates ?? 0} sub="Evaluated profiles" color="violet" />
        <StatCard icon={Briefcase} label="Scheduled" value={stats?.total_interviews ?? 0} sub="Simulated screens" color="sky" />
        <StatCard icon={CheckCircle2} label="Shortlisted" value={stats?.shortlisted_candidates ?? 0} sub="Ready to screen" color="emerald" />
        <StatCard icon={Clock} label="Pending" value={stats?.pending_candidates ?? 0} sub="Requires confirmation" color="amber" />
        <StatCard icon={XCircle} label="Gaps Flagged" value={stats?.rejected_candidates ?? 0} sub="Skill mismatch" color="rose" />
      </motion.div>

      {/* Analytics Score Row */}
      <motion.div 
        variants={staggerContainer} 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard icon={Award} label="Avg Score" value={`${stats?.average_score ?? 0}%`} sub="General average" color="emerald" />
        <StatCard icon={TrendingUp} label="Avg Interview" value={`${stats?.average_interview_score ?? 0}/100`} sub="Copilot evaluation" color="violet" />
        <StatCard icon={Trophy} label="Highest Match" value={`${stats?.highest_match_score ?? 0}%`} sub="Leader candidate" color="sky" />
        <StatCard icon={ArrowDown} label="Lowest Match" value={`${stats?.lowest_match_score ?? 0}%`} sub="Below baseline" color="amber" />
      </motion.div>

      {/* AI Insights Card */}
      <motion.div 
        variants={listItem}
        className="glass-panel rounded-2xl p-6 border border-violet-500/20 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Brain className="w-24 h-24 text-violet-400" />
        </div>
        <div className="flex items-center gap-2 text-violet-300 font-semibold mb-3">
          <Brain className="w-5 h-5 text-accent-cyan pulse-glow-cyan rounded-full p-0.5" />
          <span className="font-display">TalentAI Autonomous Recruiter Insights</span>
        </div>
        {insightsLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-slate-800 rounded animate-pulse w-5/6" />
          </div>
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed font-sans">
            {insights}
          </p>
        )}
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Skills Bar */}
        <motion.div 
          variants={listItem}
          className="xl:col-span-2 glass-panel rounded-2xl p-6 border border-glass-border"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Talent Pool Skill Density</h3>
            <BarChart3 className="w-4 h-4 text-slate-500" />
          </div>
          {topSkillsChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-650">
              <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">No resume data compiled. Upload files to generate graph.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topSkillsChart} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0e0e15', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f8fafc' }}
                  cursor={{ fill: 'rgba(139,92,246,0.05)' }}
                />
                <Bar dataKey="count" fill="url(#violetCyanGrad)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="violetCyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Match Level Pie */}
        <motion.div 
          variants={listItem}
          className="glass-panel rounded-2xl p-6 border border-glass-border"
        >
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display mb-4">Match Thresholds</h3>
          {matchDist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-600">
              <CheckCircle2 className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">Upload resumes to analyze distributions</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={matchDist} dataKey="count" nameKey="level" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3}>
                  {matchDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} verticalAlign="bottom" height={36} />
                <Tooltip contentStyle={{ background: '#0e0e15', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f8fafc' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Missing Skills + Recent Candidates */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Missing Skills */}
        <motion.div 
          variants={listItem}
          className="glass-panel rounded-2xl p-6 border border-glass-border"
        >
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Recruiter Gap Analysis
          </h3>
          <div className="space-y-4">
            {(stats?.missing_skills_analytics || []).slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-300 w-24 truncate font-medium capitalize">{s.name}</span>
                <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden border border-glass-border">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((s.count / (stats?.total_candidates || 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-8 text-right font-mono">{s.count}</span>
              </div>
            ))}
            {(stats?.missing_skills_analytics || []).length === 0 && (
              <p className="text-slate-655 text-xs">No skill deficiencies calculated.</p>
            )}
          </div>
        </motion.div>

        {/* Recent Candidates */}
        <motion.div 
          variants={listItem}
          className="glass-panel rounded-2xl p-6 border border-glass-border"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Evaluation Stream</h3>
            <button onClick={() => navigate('/candidates')} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Cockpit Ledger <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <p className="text-slate-550 text-xs">Awaiting first resume submission.</p>
            ) : (
              candidates.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/candidates/${c.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/90 border border-glass-border hover:border-violet-500/20 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {(c.name || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{c.name || 'Unknown'}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{c.email || '—'}</div>
                  </div>
                  <div className={`text-xs font-extrabold font-mono ${getScoreColor(c.score)}`}>{Math.round(c.score)}%</div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
