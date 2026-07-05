import { useState, useRef, useCallback, useEffect, ElementType, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, Trophy,
  Medal, Award, ChevronDown, ChevronUp, Search, SlidersHorizontal,
  Download, BarChart3, Users, TrendingUp, Zap, Eye, GitCompare,
  RefreshCw, FileSpreadsheet, AlertTriangle, ArrowUpDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { API_BASE, getScoreColor, getLevelColor, batchAnalyzeResumes } from '../api';

// ─── Types ──────────────────────────────────────────────────────

type BatchStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

type RankedCandidate = {
  rank: number;
  resume_id?: string;
  filename: string;
  original_name: string;
  email: string;
  phone?: string;
  skills: string[];
  missing_skills: string[];
  score: number;
  match_level: string;
  confidence: number;
  exp_years: number;
  explanation: string;
  strengths: string[];
  gaps: string[];
  education: string[];
  certifications: string[];
};

type BatchSummary = {
  total_resumes: number;
  successful: number;
  failed: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  top_candidate: string;
};

type ErrorItem = { file: string; error: string };

type PollData = {
  batch_id: string;
  status: string;
  total_files: number;
  completed: number;
  failed: number;
  progress_pct: number;
  results?: RankedCandidate[];
  errors?: ErrorItem[];
  summary?: BatchSummary;
};

// ─── Constants ──────────────────────────────────────────────────

const PIE_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f43f5e'];
const POLL_INTERVAL_MS = 1500;

const RANK_CONFIG = [
  { bg: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/40', icon: Trophy, color: 'text-amber-400', label: '🥇 Gold' },
  { bg: 'from-slate-400/20 to-slate-500/10', border: 'border-slate-400/40', icon: Medal, color: 'text-slate-300', label: '🥈 Silver' },
  { bg: 'from-orange-700/20 to-amber-800/10', border: 'border-orange-700/40', icon: Award, color: 'text-orange-500', label: '🥉 Bronze' },
];

// ─── Helper Components ───────────────────────────────────────────

function StatCard({ label, value, sub, color = 'violet', icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: ElementType;
}) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-600 to-indigo-600',
    emerald: 'from-emerald-600 to-teal-600',
    sky: 'from-sky-600 to-blue-600',
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-600 to-pink-600',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700 transition-colors">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-white truncate">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
        {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#10b981' : score >= 60 ? '#38bdf8' : score >= 40 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className={`text-sm font-bold flex-shrink-0 ${getScoreColor(score)}`}>{Math.round(score)}%</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function BulkAnalyzer() {
  const navigate = useNavigate();

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Batch job state
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results state
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [errors, setErrors] = useState<ErrorItem[]>([]);

  // Filter/sort state
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [filterLevel, setFilterLevel] = useState('');
  const [sortKey, setSortKey] = useState<'rank' | 'score' | 'name' | 'exp'>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── File management ──────────────────────────────────────────

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const valid = Array.from(fl).filter(f =>
      /\.(pdf|docx?|txt)$/i.test(f.name) && f.size <= 10 * 1024 * 1024
    );
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const fmtSize = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  // ── Polling ──────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/batch/${id}/status`);
      if (!res.ok) throw new Error('Poll failed');
      const data: PollData = await res.json();
      setPollData(data);

      if (data.status === 'done') {
        stopPolling();
        setBatchStatus('done');
        setCandidates(data.results || []);
        setSummary(data.summary || null);
        setErrors(data.errors || []);
      } else if (data.status === 'error') {
        stopPolling();
        setBatchStatus('error');
        setErrors(data.errors || []);
        setPollError('Batch processing encountered a critical error.');
      }
    } catch (e: any) {
      setPollError(e.message);
    }
  }, [stopPolling]);

  // ── Submit ───────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (files.length === 0 || !jobDescription.trim()) return;
    setBatchStatus('uploading');
    setPollError(null);
    setCandidates([]);
    setSummary(null);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('job_description', jobDescription);
      files.forEach(f => formData.append('files', f));

      const res = await fetch(`${API_BASE}/api/v1/batch/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || 'Upload failed');
      }

      const data = await res.json();
      setBatchId(data.batch_id);
      setBatchStatus('processing');

      // Start polling
      pollRef.current = setInterval(() => pollStatus(data.batch_id), POLL_INTERVAL_MS);
      pollStatus(data.batch_id); // immediate first poll
    } catch (e: any) {
      console.warn("Real batch analyze failed. Launching Client-Side Sandbox simulation...", e);
      // Client-Side fallback
      setBatchStatus('processing');
      try {
        const results = await batchAnalyzeResumes(files, jobDescription, (pct, completed, total) => {
          setPollData({
            batch_id: 'mock-batch-id',
            status: 'processing',
            total_files: total,
            completed: completed,
            failed: 0,
            progress_pct: pct
          });
        });

        // Map results to ranked candidates
        const sortedResults = [...results].sort((a, b) => b.total_score - a.total_score);
        const mapped: RankedCandidate[] = sortedResults.map((r, idx) => ({
          rank: idx + 1,
          resume_id: r.id,
          filename: r.filename,
          original_name: r.filename,
          email: r.email || 'unknown@example.com',
          phone: r.phone || '',
          skills: r.skills || [],
          missing_skills: r.missing_skills || [],
          score: r.total_score,
          match_level: r.match_level,
          confidence: r.confidence,
          exp_years: r.exp_years,
          explanation: r.explanation,
          strengths: r.strengths || [],
          gaps: r.gaps || [],
          education: r.education || [],
          certifications: r.certifications || []
        }));

        const avgScore = results.length > 0 ? Math.round(results.reduce((a, b) => a + b.total_score, 0) / results.length) : 0;
        const highestScore = results.length > 0 ? Math.max(...results.map(r => r.total_score)) : 0;
        const lowestScore = results.length > 0 ? Math.min(...results.map(r => r.total_score)) : 0;

        setCandidates(mapped);
        setSummary({
          total_resumes: files.length,
          successful: files.length,
          failed: 0,
          average_score: avgScore,
          highest_score: highestScore,
          lowest_score: lowestScore,
          top_candidate: sortedResults[0]?.filename || ''
        });
        setBatchStatus('done');
      } catch (err: any) {
        setBatchStatus('error');
        setPollError(err.message || 'Sandbox batch analysis failed');
      }
    }
  };


  const handleReset = () => {
    stopPolling();
    setBatchStatus('idle');
    setBatchId(null);
    setPollData(null);
    setPollError(null);
    setCandidates([]);
    setSummary(null);
    setErrors([]);
    setFiles([]);
  };

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Filtering/Sorting ─────────────────────────────────────────

  const filtered = candidates
    .filter(c => {
      if (search && !c.original_name?.toLowerCase().includes(search.toLowerCase()) &&
          !c.email?.toLowerCase().includes(search.toLowerCase())) return false;
      if (minScore !== '' && c.score < Number(minScore)) return false;
      if (filterLevel && c.match_level !== filterLevel) return false;
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === 'rank') diff = a.rank - b.rank;
      else if (sortKey === 'score') diff = b.score - a.score;
      else if (sortKey === 'name') diff = (a.original_name || '').localeCompare(b.original_name || '');
      else if (sortKey === 'exp') diff = (b.exp_years || 0) - (a.exp_years || 0);
      return sortAsc ? diff : -diff;
    });

  // ── Charts data ───────────────────────────────────────────────

  const skillCounts: Record<string, number> = {};
  const missingCounts: Record<string, number> = {};
  candidates.forEach(c => {
    (c.skills || []).forEach(s => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
    (c.missing_skills || []).forEach(s => { missingCounts[s] = (missingCounts[s] || 0) + 1; });
  });
  const topSkillsChart = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  const topMissingChart = Object.entries(missingCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
  const matchDistChart = ['Strong Match', 'Good Match', 'Moderate Match', 'Weak Match'].map(level => ({
    level: level.split(' ')[0],
    count: candidates.filter(c => c.match_level === level).length,
  })).filter(d => d.count > 0);

  // Score distribution bucketed
  const scoreBuckets = [
    { label: '90-100', count: candidates.filter(c => c.score >= 90).length },
    { label: '75-89', count: candidates.filter(c => c.score >= 75 && c.score < 90).length },
    { label: '60-74', count: candidates.filter(c => c.score >= 60 && c.score < 75).length },
    { label: '40-59', count: candidates.filter(c => c.score >= 40 && c.score < 60).length },
    { label: '0-39', count: candidates.filter(c => c.score < 40).length },
  ];

  // ── CSV Export ────────────────────────────────────────────────

  const handleExportCSV = () => {
    const rows = [
      ['Rank', 'Name', 'Email', 'Score', 'Match Level', 'Confidence', 'Experience (yrs)', 'Skills', 'Missing Skills'],
      ...candidates.map(c => [
        c.rank,
        c.original_name,
        c.email,
        c.score,
        c.match_level,
        Math.round(c.confidence * 100) + '%',
        c.exp_years || 0,
        (c.skills || []).join('; '),
        (c.missing_skills || []).join('; '),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ranked_candidates.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Sort Toggle ──────────────────────────────────────────────

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  const isIdle = batchStatus === 'idle';
  const isLoading = batchStatus === 'uploading' || batchStatus === 'processing';
  const isDone = batchStatus === 'done';
  const progress = pollData?.progress_pct ?? 0;
  const currentFile = pollData ? `${pollData.completed + pollData.failed} / ${pollData.total_files}` : '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Bulk Resume Ranking</h2>
          <p className="text-slate-400 mt-1 text-sm">Upload multiple resumes and get AI-ranked candidates instantly</p>
        </div>
        {isDone && (
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-sm transition-all">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm transition-all">
              <RefreshCw className="w-4 h-4" /> New Batch
            </button>
          </div>
        )}
      </div>

      {/* ── Upload Panel ── */}
      {(isIdle || isLoading) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          {/* Job Description */}
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">
              Job Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              disabled={isLoading}
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors resize-none disabled:opacity-60"
              placeholder="e.g. Senior Python Developer with 3+ years experience. Required: FastAPI, PostgreSQL, Docker, AWS, REST APIs. Nice to have: Kubernetes, Terraform..."
            />
          </div>

          {/* Drop Zone */}
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">
              Resume Files <span className="text-slate-500">(PDF, DOCX, TXT · Max 10MB each · Up to 50 files)</span>
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => !isLoading && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                isLoading ? 'opacity-50 cursor-not-allowed border-slate-700' :
                isDragging ? 'border-violet-500 bg-violet-500/10 cursor-pointer' :
                'border-slate-700 hover:border-violet-500/50 hover:bg-slate-800/50 cursor-pointer'
              }`}
            >
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-violet-400' : 'text-slate-600'}`} />
              <p className="text-sm text-slate-400">
                Drag & drop multiple files, or <span className="text-violet-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-600 mt-1">All files processed concurrently with AI scoring</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">{files.length} file{files.length > 1 ? 's' : ''} selected</span>
                {!isLoading && <button onClick={() => setFiles([])} className="text-xs text-rose-400 hover:text-rose-300">Clear all</button>}
              </div>
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-2.5 border border-slate-700">
                  <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-slate-300 truncate">{f.name}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0">{fmtSize(f.size)}</span>
                  {!isLoading && (
                    <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-rose-400 transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {pollError && (
            <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-300">{pollError}</p>
            </div>
          )}

          {/* Progress */}
          {isLoading && (
            <div className="space-y-3 bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  {batchStatus === 'uploading' ? 'Uploading files…' : `Analyzing resumes… ${currentFile}`}
                </span>
                <span className="text-violet-400 font-semibold">{progress.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {pollData && (
                <div className="flex gap-4 text-xs text-slate-500">
                  <span className="text-emerald-400">✓ {pollData.completed} done</span>
                  {pollData.failed > 0 && <span className="text-rose-400">✗ {pollData.failed} failed</span>}
                  <span>{pollData.total_files - pollData.completed - pollData.failed} remaining</span>
                </div>
              )}
            </div>
          )}

          {/* Analyze Button */}
          {!isLoading && (
            <button
              onClick={handleAnalyze}
              disabled={files.length === 0 || !jobDescription.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg shadow-violet-900/30"
            >
              <Zap className="w-4 h-4" />
              Rank {files.length > 0 ? `${files.length} Resume${files.length > 1 ? 's' : ''}` : 'Resumes'} with AI
            </button>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {isDone && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Total" value={summary?.total_resumes ?? 0} color="violet" />
            <StatCard icon={CheckCircle2} label="Successful" value={summary?.successful ?? 0} color="emerald" />
            <StatCard icon={AlertCircle} label="Failed" value={summary?.failed ?? 0} color="rose" />
            <StatCard icon={TrendingUp} label="Avg Score" value={`${summary?.average_score ?? 0}%`} color="sky" />
            <StatCard icon={Award} label="Highest" value={`${summary?.highest_score ?? 0}%`} color="amber" />
            <StatCard icon={Trophy} label="Top Candidate" value={summary?.top_candidate?.replace(/\.(pdf|docx?)$/i, '') || '—'} color="violet" />
          </div>

          {/* Top 3 Podium */}
          {filtered.slice(0, 3).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {filtered.slice(0, 3).map((c, idx) => {
                const cfg = RANK_CONFIG[idx];
                const Icon = cfg.icon;
                const name = c.original_name?.replace(/\.(pdf|docx?)$/i, '') || 'Candidate';
                return (
                  <div key={c.rank} className={`bg-gradient-to-br ${cfg.bg} border ${cfg.border} rounded-2xl p-5 relative overflow-hidden`}>
                    <div className="absolute top-3 right-3">
                      <Icon className={`w-6 h-6 ${cfg.color}`} />
                    </div>
                    <div className="text-xs font-bold text-slate-500 mb-2">{cfg.label}</div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white mb-3">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="font-semibold text-slate-200 truncate">{name}</div>
                    <div className="text-xs text-slate-500 truncate mb-3">{c.email || '—'}</div>
                    <ScoreBar score={c.score} />
                    <div className={`mt-2 text-xs px-2 py-0.5 rounded-full border inline-block ${getLevelColor(c.match_level)}`}>{c.match_level}</div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(c.skills || []).slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-800/60 text-slate-400 rounded capitalize">{s}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => c.resume_id && navigate(`/candidates/${c.resume_id}`)}
                      disabled={!c.resume_id}
                      className="mt-3 w-full text-xs border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 rounded-lg py-1.5 transition-all disabled:opacity-40"
                    >
                      View Profile
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Score Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-400" /> Score Distribution
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreBuckets} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Skills */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Top Skills
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topSkillsChart} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Match Level Pie */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Match Levels</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={matchDistChart} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={70} label={({ name }) => name}>
                    {matchDistChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${showFilters ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white text-sm transition-all">
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </button>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Min Score</label>
                  <input type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                    placeholder="0" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Match Level</label>
                  <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                    <option value="">All</option>
                    <option>Strong Match</option><option>Good Match</option>
                    <option>Moderate Match</option><option>Weak Match</option>
                  </select>
                </div>
                {(search || minScore !== '' || filterLevel) && (
                  <button onClick={() => { setSearch(''); setMinScore(''); setFilterLevel(''); }} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ranking Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Ranked Candidates
                <span className="ml-2 text-sm text-slate-500 font-normal">({filtered.length} shown)</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/40">
                    {[
                      { key: 'rank', label: 'Rank' },
                      { key: 'name', label: 'Candidate' },
                      { key: 'score', label: 'ATS Score' },
                      { key: null, label: 'Match Level' },
                      { key: null, label: 'Confidence' },
                      { key: 'exp', label: 'Exp (yrs)' },
                      { key: null, label: 'Top Skills' },
                      { key: null, label: 'Missing' },
                      { key: null, label: 'Actions' },
                    ].map(col => (
                      <th
                        key={col.label}
                        onClick={() => col.key && toggleSort(col.key as typeof sortKey)}
                        className={`text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-slate-200 select-none' : ''}`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && <ArrowUpDown className="w-3 h-3" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-600">No candidates match your filters.</td></tr>
                  ) : (
                    filtered.map(c => {
                      const name = c.original_name?.replace(/\.(pdf|docx?|txt)$/i, '') || 'Unknown';
                      const rankBg = c.rank === 1 ? 'bg-amber-500/5' : c.rank === 2 ? 'bg-slate-400/5' : c.rank === 3 ? 'bg-orange-700/5' : '';
                      const isExpanded = expandedId === c.original_name;

                      return (
                        <Fragment key={`row-${c.rank}`}>
                          <tr
                            className={`hover:bg-slate-800/50 transition-colors ${rankBg}`}
                          >
                            {/* Rank */}
                            <td className="px-4 py-3 text-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto ${
                                c.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                c.rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40' :
                                c.rank === 3 ? 'bg-orange-700/20 text-orange-500 border border-orange-700/40' :
                                'bg-slate-800 text-slate-500 border border-slate-700'
                              }`}>{c.rank}</div>
                            </td>

                            {/* Name */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                  {name[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-200 truncate max-w-[140px]">{name}</div>
                                  <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{c.email || '—'}</div>
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-4 py-3 min-w-[120px]">
                              <ScoreBar score={c.score} />
                            </td>

                            {/* Match Level */}
                            <td className="px-4 py-3">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${getLevelColor(c.match_level)}`}>
                                {c.match_level}
                              </span>
                            </td>

                            {/* Confidence */}
                            <td className="px-4 py-3 text-sm text-slate-300">{Math.round(c.confidence * 100)}%</td>

                            {/* Exp */}
                            <td className="px-4 py-3 text-sm text-slate-300">{c.exp_years || 0}</td>

                            {/* Top Skills */}
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {(c.skills || []).slice(0, 3).map(s => (
                                  <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded capitalize">{s}</span>
                                ))}
                                {(c.skills || []).length > 3 && <span className="text-[10px] text-slate-600">+{c.skills.length - 3}</span>}
                              </div>
                            </td>

                            {/* Missing */}
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[140px]">
                                {(c.missing_skills || []).slice(0, 2).map(s => (
                                  <span key={s} className="text-[10px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded capitalize">{s}</span>
                                ))}
                                {(c.missing_skills || []).length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {c.resume_id && (
                                  <button
                                    onClick={() => navigate(`/candidates/${c.resume_id}`)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                                    title="View Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {c.resume_id && (
                                  <button
                                    onClick={() => navigate(`/compare?ids=${c.resume_id}`)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                                    title="Compare"
                                  >
                                    <GitCompare className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : c.original_name)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                                  title={isExpanded ? 'Collapse' : 'AI Explanation'}
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Row */}
                          {isExpanded && (
                            <tr className="border-b border-slate-800 bg-slate-800/30">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-400 uppercase mb-2">AI Explanation</div>
                                    <p className="text-sm text-slate-300 leading-relaxed">{c.explanation || 'No explanation available.'}</p>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-emerald-400 uppercase mb-2">Strengths</div>
                                    <ul className="space-y-1">
                                      {(c.strengths || []).map((s, i) => (
                                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />{s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-rose-400 uppercase mb-2">Gaps</div>
                                    <ul className="space-y-1">
                                      {(c.gaps || []).map((g, i) => (
                                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                                          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />{g}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Failed Files */}
          {errors.length > 0 && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Failed Files ({errors.length})
              </h4>
              <div className="space-y-2">
                {errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <X className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{e.file}</span>
                    <span className="text-slate-600">—</span>
                    <span>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
