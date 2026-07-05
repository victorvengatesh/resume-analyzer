import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ArrowUpDown, Users, GitCompare, X, Eye } from 'lucide-react';
import { fetchCandidates, Candidate, getScoreColor, getLevelColor } from '../api';
import { pageVariants, staggerContainer, listItem, spring } from '../lib/motion';
import { Button } from '../components/ui/Button';

const PAGE_SIZE = 12;

export default function Candidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [jobRole, setJobRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterExperience, setFilterExperience] = useState<number | ''>('');
  const [filterSkills, setFilterSkills] = useState('');
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'score' | 'name'>('score');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    fetchCandidates({
      q: q || undefined,
      min_score: minScore !== '' ? Number(minScore) : undefined,
      job_role: jobRole || undefined,
      status: filterStatus || undefined,
      location: filterLocation || undefined,
      min_experience: filterExperience !== '' ? Number(filterExperience) : undefined,
      skills: filterSkills || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then(data => {
        const sorted = [...data].sort((a, b) => {
          if (sortKey === 'score') return b.score - a.score;
          return (a.name || '').localeCompare(b.name || '');
        });
        setCandidates(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q, minScore, jobRole, filterStatus, filterLocation, filterExperience, filterSkills, offset, sortKey]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCompare = () => {
    const ids = Array.from(selected).join(',');
    navigate(`/compare?ids=${ids}`);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white font-display tracking-tight font-display">Talent Directory</h2>
          <p className="text-slate-500 text-xs mt-1">Browse, filter, and screen candidate scorecards.</p>
        </div>
        {selected.size >= 2 && (
          <Button
            onClick={handleCompare}
            icon={<GitCompare className="w-4 h-4 text-accent-cyan" />}
            className="shadow-neon-accent"
          >
            Compare {selected.size} Candidates
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <motion.div 
        variants={listItem}
        className="glass-panel border border-glass-border rounded-2xl p-4 space-y-3"
      >
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setOffset(0); }}
              placeholder="Search by name, skills or keywords..."
              className="w-full bg-slate-950/80 border border-glass-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              showFilters ? 'bg-violet-600/15 border-violet-500/30 text-violet-300' : 'border-glass-border text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
          <button
            onClick={() => setSortKey(prev => prev === 'score' ? 'name' : 'score')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-glass-border text-slate-400 hover:text-slate-200 bg-slate-900/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortKey === 'score' ? 'ATS Rank' : 'A-Z'}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-4 pt-4 border-t border-glass-border"
            >
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Min Score</label>
                <input
                  type="number"
                  min={0} max={100}
                  value={minScore}
                  onChange={e => { setMinScore(e.target.value === '' ? '' : Number(e.target.value)); setOffset(0); }}
                  className="w-16 bg-slate-950/80 border border-glass-border rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Role</label>
                <input
                  type="text"
                  value={jobRole}
                  onChange={e => { setJobRole(e.target.value); setOffset(0); }}
                  className="w-28 bg-slate-950/80 border border-glass-border rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="e.g. Frontend"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Location</label>
                <input
                  type="text"
                  value={filterLocation}
                  onChange={e => { setFilterLocation(e.target.value); setOffset(0); }}
                  className="w-28 bg-slate-950/80 border border-glass-border rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="e.g. Remote"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Min Exp</label>
                <input
                  type="number"
                  min={0}
                  value={filterExperience}
                  onChange={e => { setFilterExperience(e.target.value === '' ? '' : Number(e.target.value)); setOffset(0); }}
                  className="w-14 bg-slate-950/80 border border-glass-border rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Skills</label>
                <input
                  type="text"
                  value={filterSkills}
                  onChange={e => { setFilterSkills(e.target.value); setOffset(0); }}
                  className="w-32 bg-slate-950/80 border border-glass-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="e.g. Python, Docker"
                />
              </div>
              {(q || minScore !== '' || jobRole || filterStatus || filterLocation || filterExperience !== '' || filterSkills) && (
                <button
                  onClick={() => {
                    setQ('');
                    setMinScore('');
                    setJobRole('');
                    setFilterStatus('');
                    setFilterLocation('');
                    setFilterExperience('');
                    setFilterSkills('');
                    setOffset(0);
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Selected Banner */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2.5 shadow-sm"
          >
            <span className="text-xs font-semibold text-violet-300">{selected.size} profile(s) selected</span>
            <div className="flex gap-2">
              {selected.size >= 2 && (
                <button 
                  onClick={handleCompare} 
                  className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Run Comparison Matrix
                </button>
              )}
              <button 
                onClick={() => setSelected(new Set())} 
                className="text-xs text-slate-400 hover:text-white"
              >
                Reset Selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel border border-glass-border rounded-2xl p-5 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-lg" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-slate-800 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-2 bg-slate-800 rounded" />
              <div className="h-2 bg-slate-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-2xl border border-glass-border">
          <Users className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-350">No cataloged candidate records</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">Adjust search inputs or import new files into the parser.</p>
        </div>
      ) : (
        <motion.div 
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {candidates.map(c => {
            const isSelected = selected.has(c.id);
            return (
              <motion.div
                key={c.id}
                variants={listItem}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`glass-panel border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 cursor-pointer group hover:border-violet-500/25 relative overflow-hidden shadow-md
                  ${isSelected ? 'border-violet-500/60 bg-violet-600/5 shadow-neon-primary' : 'border-glass-border'}`}
                onClick={() => navigate(`/candidates/${c.id}`)}
              >
                {/* Card header */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-650 flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0">
                    {(c.name || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-200 truncate group-hover:text-white leading-tight">{c.name || 'Unknown'}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">{c.email || '—'}</div>
                    <div className="text-[9px] text-slate-550 mt-1.5 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <span>Exp: {c.exp_years || 0} yrs</span>
                      {c.location && <span className="truncate max-w-[80px]">• {c.location}</span>}
                    </div>
                  </div>
                  {/* Select checkbox */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}
                    className={`w-5 h-5 rounded border transition-all flex-shrink-0 flex items-center justify-center text-xs font-bold cursor-pointer
                      ${isSelected ? 'bg-violet-600 border-violet-500 text-white' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'}`}
                  >
                    {isSelected && '✓'}
                  </button>
                </div>

                {/* Score slider */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ATS Score</span>
                      <span className={`text-xs font-extrabold font-mono ${getScoreColor(c.score)}`}>{Math.round(c.score)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-glass-border">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 relative z-10">
                  {(c.skills || []).slice(0, 3).map(s => (
                    <span key={s} className="text-[9px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-glass-border font-mono capitalize">{s}</span>
                  ))}
                  {(c.skills || []).length > 3 && (
                    <span className="text-[9px] px-2 py-0.5 rounded bg-slate-950 text-slate-600 font-mono">+{c.skills.length - 3}</span>
                  )}
                </div>

                {/* Upload date footer */}
                <div className="text-[10px] text-slate-500 border-t border-glass-border pt-3 flex items-center justify-between relative z-10">
                  <span>Imported {c.uploaded_at ? new Date(c.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                    c.score >= 75 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                    c.score >= 50 ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' :
                    'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  }`}>
                    {c.score >= 75 ? 'Shortlist' : c.score >= 50 ? 'Review' : 'Misfit'}
                  </span>
                </div>

                {/* Ambient glow accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full filter blur-xl group-hover:bg-violet-600/10 transition-colors" />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {!loading && candidates.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-glass-border text-xs font-bold text-slate-400 disabled:opacity-40 hover:border-slate-700 hover:text-slate-200 transition-all cursor-pointer bg-slate-950/40"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-xs text-slate-500 font-mono">Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={candidates.length < PAGE_SIZE}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-glass-border text-xs font-bold text-slate-400 disabled:opacity-40 hover:border-slate-700 hover:text-slate-200 transition-all cursor-pointer bg-slate-950/40"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
