import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GitCompare, Users, Trophy, CheckCircle2, AlertTriangle, X, Plus, ArrowLeft } from 'lucide-react';
import { fetchCandidate, fetchCandidates, AnalysisResult, Candidate, getScoreColor, getLevelColor } from '../api';

const MAX_COMPARE = 4;

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? '#10b981' : value >= 60 ? '#38bdf8' : value >= 40 ? '#f59e0b' : '#f43f5e';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className={getScoreColor(value)}>{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Compare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialIds = (searchParams.get('ids') || '').split(',').filter(Boolean);

  const [candidates, setCandidates] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetchCandidates({ limit: 50 }).then(setAllCandidates).catch(console.error);
  }, []);

  useEffect(() => {
    if (initialIds.length === 0) return;
    setLoading(true);
    Promise.all(initialIds.map(id => fetchCandidate(id)))
      .then(setCandidates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addCandidate = async (id: string) => {
    if (candidates.find(c => c.id === id) || candidates.length >= MAX_COMPARE) return;
    const c = await fetchCandidate(id);
    setCandidates(prev => [...prev, c]);
    setAddOpen(false);
  };

  const removeCandidate = (id: string) => setCandidates(prev => prev.filter(c => c.id !== id));

  const bestCandidate = candidates.length > 0
    ? candidates.reduce((best, c) => c.total_score > best.total_score ? c : best)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">Loading comparison…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Candidate Comparison</h2>
          <p className="text-slate-400 mt-1 text-sm">Compare up to {MAX_COMPARE} candidates side-by-side</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/candidates')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-sm transition-all">
            <ArrowLeft className="w-4 h-4" /> Candidates
          </button>
          {candidates.length < MAX_COMPARE && (
            <button onClick={() => setAddOpen(!addOpen)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm transition-all">
              <Plus className="w-4 h-4" /> Add Candidate
            </button>
          )}
        </div>
      </div>

      {/* Add candidate dropdown */}
      {addOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Select a candidate to add:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {allCandidates
              .filter(c => !candidates.find(x => x.id === c.id))
              .map(c => (
                <button
                  key={c.id}
                  onClick={() => addCandidate(c.id)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-left transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                    {(c.name || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-200 truncate">{c.name || 'Unknown'}</div>
                    <div className={`text-xs ${getScoreColor(c.score)}`}>{Math.round(c.score)}%</div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitCompare className="w-14 h-14 text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300">No candidates to compare</h3>
          <p className="text-slate-500 mt-2 max-w-sm">Select candidates from the Candidates page, or use the Add button above.</p>
          <button onClick={() => navigate('/candidates')} className="mt-6 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm transition-colors">
            Browse Candidates
          </button>
        </div>
      )}

      {/* Comparison Table */}
      {candidates.length > 0 && (
        <>
          {/* Best candidate banner */}
          {bestCandidate && candidates.length > 1 && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3">
              <Trophy className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-300 font-medium">
                <span className="text-white">{bestCandidate.filename?.replace(/\.(pdf|docx?)$/i, '')}</span> is the best match with a score of {Math.round(bestCandidate.total_score)}%
              </span>
            </div>
          )}

          {/* Cards Row */}
          <div className={`grid gap-4 ${candidates.length === 1 ? 'grid-cols-1 max-w-md' : candidates.length === 2 ? 'grid-cols-2' : candidates.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
            {candidates.map(c => {
              const name = c.filename?.replace(/\.(pdf|docx?)$/i, '') || 'Candidate';
              const isBest = bestCandidate?.id === c.id && candidates.length > 1;
              return (
                <div key={c.id} className={`bg-slate-900 border rounded-2xl p-5 space-y-4 relative ${isBest ? 'border-emerald-500/40' : 'border-slate-800'}`}>
                  {isBest && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-emerald-950 text-[10px] font-bold px-3 py-0.5 rounded-full flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Best Match
                    </div>
                  )}
                  <button
                    onClick={() => removeCandidate(c.id)}
                    className="absolute top-3 right-3 text-slate-600 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {/* Avatar & Name */}
                  <div className="text-center pt-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-lg font-bold text-white mx-auto">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="mt-2 font-semibold text-slate-200 text-sm truncate">{name}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getLevelColor(c.match_level)} mt-1 inline-block`}>
                      {c.match_level}
                    </span>
                  </div>

                  {/* Scores */}
                  <div className="space-y-2">
                    <ScoreBar label="ATS Score" value={c.total_score} />
                    <ScoreBar label="Skill Score" value={c.skill_score} />
                    <ScoreBar label="AI Confidence" value={c.confidence * 100} />
                  </div>

                  {/* Experience */}
                  <div className="text-center py-2 border-t border-slate-800">
                    <div className="text-xl font-bold text-white">{c.exp_years ?? '?'} <span className="text-sm text-slate-500">yrs</span></div>
                    <div className="text-xs text-slate-500">Experience</div>
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Skills</div>
                    <div className="flex flex-wrap gap-1">
                      {(c.skills || []).slice(0, 6).map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-full capitalize">{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Missing Skills */}
                  <div>
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Missing</div>
                    <div className="flex flex-wrap gap-1">
                      {(c.missing_skills || []).slice(0, 4).map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-full capitalize">{s}</span>
                      ))}
                      {(c.missing_skills || []).length === 0 && <span className="text-xs text-slate-600">None</span>}
                    </div>
                  </div>

                  {/* Education */}
                  {c.education && c.education.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 mb-2">Education</div>
                      <ul className="space-y-1">
                        {c.education.slice(0, 2).map((edu, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" /> {edu}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={() => navigate(`/candidates/${c.id}`)}
                    className="w-full text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg py-2 transition-all"
                  >
                    View Full Profile
                  </button>
                </div>
              );
            })}
          </div>

          {/* Side-by-side table comparison */}
          {candidates.length > 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Detailed Comparison Table</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-6 py-3 text-slate-500 font-medium w-40">Attribute</th>
                      {candidates.map(c => {
                        const name = c.filename?.replace(/\.(pdf|docx?)$/i, '') || 'Candidate';
                        return (
                          <th key={c.id} className="text-left px-4 py-3 text-slate-300 font-medium">{name}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      { label: 'ATS Score', key: 'total_score' as const },
                      { label: 'Skill Score', key: 'skill_score' as const },
                      { label: 'Experience (yrs)', key: 'exp_years' as const },
                      { label: 'Match Level', key: 'match_level' as const },
                      { label: 'Confidence', key: 'confidence' as const },
                    ].map(row => (
                      <tr key={row.label} className="hover:bg-slate-800/40">
                        <td className="px-6 py-3 text-slate-400 font-medium">{row.label}</td>
                        {candidates.map(c => {
                          const val = c[row.key];
                          return (
                            <td key={c.id} className="px-4 py-3">
                              {typeof val === 'number' ? (
                                <span className={getScoreColor(row.key === 'confidence' ? (val as number) * 100 : val as number)}>
                                  {row.key === 'confidence' ? `${Math.round((val as number) * 100)}%` : row.key === 'exp_years' ? val : `${Math.round(val as number)}%`}
                                </span>
                              ) : (
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${getLevelColor(String(val))}`}>{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
