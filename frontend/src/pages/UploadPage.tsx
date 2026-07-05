import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, ChevronRight, Loader2, CheckCircle2, AlertCircle, Users, Zap } from 'lucide-react';
import { analyzeResume, batchAnalyzeResumes, AnalysisResult, getScoreColor, getLevelColor } from '../api';
import { useToast } from '../components/ui/Toast';
import { pageVariants, listItem, staggerContainer } from '../lib/motion';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type Mode = 'single' | 'batch';

export default function UploadPage() {
  const [mode, setMode] = useState<Mode>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [jobRole, setJobRole] = useState('Senior React Architect');
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { success, error, warning } = useToast();

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const valid = Array.from(newFiles).filter(f => /\.(pdf|docx?)$/i.test(f.name));
    
    if (valid.length === 0) {
      warning('Invalid File Type', 'Please upload only PDF, DOC, or DOCX formats.');
      return;
    }

    if (mode === 'single') {
      setFiles([valid[0]].filter(Boolean));
      success('File Attached', `Selected ${valid[0].name} for parsing.`);
    } else {
      setFiles(prev => [...prev, ...valid]);
      success('Files Added', `Added ${valid.length} file(s) to the batch queue.`);
    }
  };

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      error('Selection Required', 'Attach at least one candidate resume first.');
      return;
    }
    setErrorText(null);
    setLoading(true);
    setProgress(0);
    
    try {
      if (mode === 'single') {
        const r = await analyzeResume(files[0], jobRole);
        setResults([r]);
        success('Analysis Complete', `Resume parsed with a score of ${Math.round(r.total_score)}%.`);
      } else {
        const r = await batchAnalyzeResumes(files, jobRole, (pct) => {
          setProgress(pct);
        });
        setResults(r);
        success('Batch Completed', `Successfully processed ${r.length} candidates.`);
      }
    } catch (e: any) {
      setErrorText(e.message || 'Analysis failed.');
      error('Analysis Failure', e.message || 'Could not parse resume data.');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white font-display tracking-tight">Parser Ingestion</h2>
        <p className="text-slate-500 text-xs mt-1">Ingest candidate profiles into the scoring matrix.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 bg-slate-950/60 p-1.5 rounded-xl border border-glass-border w-fit">
        {(['single', 'batch'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setFiles([]); setResults([]); setErrorText(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              mode === m 
                ? 'bg-slate-800 text-white shadow-sm border border-glass-border' 
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            {m === 'single' ? <FileText className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            {m === 'single' ? 'Single Intake' : 'Batch Queue'}
          </button>
        ))}
      </div>

      {/* Job Role & Upload Form */}
      <motion.div 
        variants={listItem}
        className="glass-panel border border-glass-border rounded-2xl p-6 space-y-6"
      >
        <Input
          label="Job Target Blueprint"
          type="text"
          value={jobRole}
          onChange={e => setJobRole(e.target.value)}
          placeholder="e.g. Senior Frontend Architect (React, TypeScript)"
          icon={<Zap className="w-4 h-4 text-accent-cyan" />}
          disabled={loading}
          required
        />

        {/* Drop zone */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Ingestion Zone <span className="text-slate-600">(PDF, DOC, DOCX)</span>
          </label>
          
          <motion.div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => !loading && inputRef.current?.click()}
            whileHover={loading ? {} : { scale: 1.005 }}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              isDragging 
                ? 'border-violet-500 bg-violet-500/10 shadow-neon-primary' 
                : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/40'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragging ? 'text-violet-400 animate-bounce' : 'text-slate-500'}`} />
            <p className="text-sm text-slate-300">
              Drag & drop resume here, or <span className="text-violet-400 hover:text-violet-300 underline font-semibold">browse files</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Supports PDF, DOC, DOCX formats • Under 15MB</p>
            <input
              ref={inputRef}
              type="file"
              multiple={mode === 'batch'}
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
              disabled={loading}
            />
          </motion.div>
        </div>

        {/* File list */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              {files.map((f, i) => (
                <motion.div 
                  key={i} 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 bg-slate-950/60 rounded-xl px-4 py-2.5 border border-glass-border"
                >
                  <FileText className="w-4 h-4 text-violet-400 flex-shrink-0 animate-pulse" />
                  <span className="flex-1 text-xs text-slate-300 truncate font-mono">{f.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{fmtSize(f.size)}</span>
                  <button 
                    onClick={() => removeFile(i)} 
                    className="text-slate-500 hover:text-rose-450 p-1 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {errorText && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 font-medium">{errorText}</p>
          </div>
        )}

        {/* Progress bar for batch mode */}
        {loading && mode === 'batch' && progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                Ingesting files...
              </span>
              <span className="text-violet-400 font-mono">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-glass-border">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          fullWidth
          onClick={handleAnalyze}
          loading={loading}
          icon={<Zap className="w-4 h-4 text-accent-cyan" />}
          className="shadow-neon-primary py-3"
          disabled={files.length === 0}
        >
          Evaluate Ingestion Queue
        </Button>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Ingestion complete — {results.length} record(s) cataloged
            </div>

            {results.map((r, i) => {
              const name = r.filename?.replace(/\.(pdf|docx?)$/i, '').replace(/_Resume|_/g, ' ') || 'Candidate';
              return (
                <motion.div 
                  key={i} 
                  variants={listItem}
                  className="glass-panel border border-glass-border rounded-2xl p-6 space-y-4 hover:border-violet-500/20 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shadow-md">
                        {name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-200">{name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{r.email || '—'} • target: {r.job_applied}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getLevelColor(r.match_level)}`}>
                        {r.match_level}
                      </span>
                      <span className={`text-lg font-bold font-mono ${getScoreColor(r.total_score)}`}>
                        {Math.round(r.total_score)}%
                      </span>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-glass-border">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      style={{ width: `${r.total_score}%` }}
                    />
                  </div>

                  {/* Explanation */}
                  <p className="text-xs text-slate-400 leading-relaxed leading-normal">{r.explanation}</p>

                  <div className="flex items-center justify-between border-t border-glass-border pt-3">
                    {/* Skills */}
                    <div className="flex flex-wrap gap-1.5">
                      {(r.skills || []).slice(0, 6).map(s => (
                        <span key={s} className="text-[10px] px-2.5 py-0.5 bg-slate-950 text-slate-400 border border-glass-border rounded-lg uppercase tracking-wider font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => navigate(`/candidates/${r.id}`)}
                      className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <span>Analyze Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
