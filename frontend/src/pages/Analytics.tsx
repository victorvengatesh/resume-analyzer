import { useEffect, useState } from 'react';
import { BarChart3, Sparkles, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { fetchDashboardStats, fetchAiInsights, DashboardStats, API_BASE } from '../api';

const PIE_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];
const RADAR_COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#38bdf8'];

export default function Analytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, []);

  const loadInsights = () => {
    setLoadingInsights(true);
    setInsightsLoaded(true);
    fetchAiInsights()
      .then(d => setInsights(d.insights))
      .catch(e => setInsights(`Error: ${e.message}`))
      .finally(() => setLoadingInsights(false));
  };

  const handleExport = () => {
    window.open(`${API_BASE}/api/v1/exports/candidates/csv`, '_blank');
  };

  if (loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const topSkills = (stats?.top_skills || []).slice(0, 10);
  const topMissing = (stats?.missing_skills_analytics || []).slice(0, 8);
  const matchDist = stats?.match_level_distribution || [];

  // Build radar data from top skills vs missing
  const topSkillNames = topSkills.slice(0, 6).map(s => s.name);
  const radarData = topSkillNames.map(name => ({
    skill: name,
    found: (topSkills.find(s => s.name === name)?.count || 0),
    missing: (topMissing.find(s => s.name === name)?.count || 0),
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics</h2>
          <p className="text-slate-400 mt-1 text-sm">Deep insights into your talent pool and hiring pipeline</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600 text-sm transition-all"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* No Data */}
      {(stats?.total_resumes ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="w-14 h-14 text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300">No data yet</h3>
          <p className="text-slate-500 mt-2 max-w-sm">Upload some resumes to see analytics here.</p>
        </div>
      )}

      {(stats?.total_resumes ?? 0) > 0 && (
        <>
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top Skills */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                Top Skills
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topSkills} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} cursor={{ fill: 'rgba(139,92,246,0.1)' }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Missing Skills */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Top Missing Skills
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topMissing} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} cursor={{ fill: 'rgba(245,158,11,0.1)' }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Match Level Pie */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4">Match Level Distribution</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={matchDist} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={85} label={({ name }) => name?.split(' ')[0]}>
                    {matchDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Skills Radar */}
            <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4">Skills Found vs Missing (Overlap)</h3>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Radar name="Found" dataKey="found" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                    <Radar name="Missing" dataKey="missing" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-600 text-sm">Not enough data for radar chart.</p>
              )}
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Candidates', value: stats?.total_candidates ?? 0, color: 'violet' },
              { label: 'Avg ATS Score', value: `${stats?.average_score ?? 0}%`, color: 'emerald' },
              { label: 'Avg AI Confidence', value: `${Math.round((stats?.average_confidence ?? 0) * 100)}%`, color: 'sky' },
              { label: 'Unique Skills', value: stats?.top_skills?.length ?? 0, color: 'amber' },
            ].map(card => (
              <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center hover:border-slate-700 transition-colors">
                <div className="text-2xl font-bold text-white">{card.value}</div>
                <div className="text-xs text-slate-500 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI Insights */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            AI Recruiter Insights
          </h3>
          <button
            onClick={loadInsights}
            disabled={loadingInsights}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
            {insightsLoaded ? 'Regenerate' : 'Generate Insights'}
          </button>
        </div>
        {loadingInsights && (
          <div className="flex items-center gap-3 py-4 text-slate-400">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Analyzing your talent pool with AI…</span>
          </div>
        )}
        {!loadingInsights && insights && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{insights}</p>
          </div>
        )}
        {!insightsLoaded && !loadingInsights && (
          <div className="text-sm text-slate-600 py-4">
            Click "Generate Insights" to get AI-powered analysis of your talent pool.
          </div>
        )}
      </div>
    </div>
  );
}
