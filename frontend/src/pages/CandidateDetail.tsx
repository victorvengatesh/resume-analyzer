import { useEffect, useState, ElementType, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Mail, Phone, Linkedin, Github, Award, Brain, 
  TrendingUp, AlertTriangle, CheckCircle2, BookOpen, GitCompare, 
  BadgeCheck, Trash2, Calendar
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { fetchCandidate, deleteCandidate, AnalysisResult, getScoreColor, getLevelColor } from '../api';
import { pageVariants, listItem, staggerContainer } from '../lib/motion';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

function Section({ title, icon: Icon, color = 'violet', children }: { title: string; icon: ElementType; color?: string; children: ReactNode }) {
  const colorMap: Record<string, string> = {
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    sky: 'text-sky-400',
    indigo: 'text-indigo-400',
  };
  return (
    <motion.div 
      variants={listItem}
      className="glass-panel border border-glass-border rounded-2xl p-6"
    >
      <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2 font-display">
        <Icon className={`w-4 h-4 ${colorMap[color]}`} />
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function TagList({ items, color = 'slate' }: { items: string[]; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-950 text-slate-400 border-glass-border',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  };
  if (!items || items.length === 0) return <p className="text-slate-500 text-xs font-mono">No attributes cataloged</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-lg border ${colorMap[color]} font-mono capitalize`}>{item}</span>
      ))}
    </div>
  );
}

function BulletList({ items, icon: Icon, color }: { items: string[]; icon: ElementType; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-455',
  };
  if (!items || items.length === 0) return <p className="text-slate-500 text-xs font-mono">None cataloged</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorMap[color] || 'text-slate-500'}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [candidate, setCandidate] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCandidate(id)
      .then(setCandidate)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this candidate profile?")) {
      try {
        await deleteCandidate(id);
        success("Profile Purged", "Candidate record successfully deleted.");
        navigate('/candidates');
      } catch (err: any) {
        toastError("Purge Failed", err.message || "Failed to delete candidate.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-xs font-semibold">Compiling profile details...</p>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center glass-panel rounded-2xl p-8 max-w-md mx-auto border border-glass-border">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <h3 className="text-sm font-semibold text-slate-200">Failed to compile profile</h3>
        <p className="text-xs text-slate-500 mt-1">{error || 'Record offline'}</p>
        <Button onClick={() => navigate('/candidates')} className="mt-6">
          Directory Index
        </Button>
      </div>
    );
  }

  const c = candidate;
  const name = c.filename?.replace(/\.(pdf|docx?)$/i, '').replace(/_Resume|_/g, ' ') || 'Candidate';

  // Radar chart data modeling candidate skillset
  const skillRadarData = [
    { subject: 'Language Competency', A: c.skill_score, B: 100, fullMark: 100 },
    { subject: 'Domain Experience', A: c.exp_score, B: 100, fullMark: 100 },
    { subject: 'Missing Skill Gap', A: Math.max(10, 100 - (c.missing_skills.length * 15)), B: 100, fullMark: 100 },
    { subject: 'Confidence Metric', A: Math.round(c.confidence * 100), B: 100, fullMark: 100 },
    { subject: 'Overall Score', A: c.total_score, B: 100, fullMark: 100 }
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="max-w-5xl mx-auto space-y-6"
    >
      {/* Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/candidates')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Core Directory
        </button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={handleDelete}
            icon={<Trash2 className="w-4 h-4 text-rose-500" />}
            className="hover:bg-rose-500/10 text-rose-300 border border-glass-border hover:border-rose-500/20"
          >
            Purge Profile
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/compare?ids=${id}`)}
            icon={<GitCompare className="w-4 h-4" />}
          >
            Matrix Compare
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/interview?candidate_id=${id}`)}
            icon={<Brain className="w-4 h-4 text-accent-cyan animate-pulse" />}
            className="shadow-neon-primary"
          >
            Launch Interview Copilot
          </Button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <motion.div 
        variants={listItem}
        className="glass-panel border border-glass-border rounded-2xl p-6"
      >
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-650 flex items-center justify-center text-3xl font-extrabold text-white flex-shrink-0 shadow-lg border border-white/5">
            {name[0]?.toUpperCase()}
          </div>
          {/* Info details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white font-display tracking-tight">{name}</h2>
            
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-slate-400 font-mono">
              {c.email && (
                <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-violet-400 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />{c.email}
                </a>
              )}
              {c.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />{c.phone}
                </span>
              )}
              {c.linkedin && (
                <a href={`https://${c.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
                  <Linkedin className="w-3.5 h-3.5 text-slate-500" />LinkedIn
                </a>
              )}
              {c.github && (
                <a href={`https://${c.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                  <Github className="w-3.5 h-3.5 text-slate-500" />GitHub
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${getLevelColor(c.match_level)}`}>
                {c.match_level}
              </span>
              {c.job_applied && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border border-glass-border bg-slate-950/60 text-slate-350">
                  target: {c.job_applied}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border border-glass-border bg-slate-950/60 text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {c.uploaded_at ? new Date(c.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
              </span>
            </div>
          </div>
          
          {/* Score metrics */}
          <div className="flex-shrink-0 text-center bg-slate-950/60 p-4 border border-glass-border rounded-xl min-w-[130px] shadow-sm">
            <div className={`text-3xl font-extrabold font-mono ${getScoreColor(c.total_score)}`}>
              {Math.round(c.total_score)}<span className="text-xs text-slate-500">/100</span>
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">ATS Score</div>
            <div className="text-[9px] text-slate-550 font-mono mt-1">Confidence: {Math.round(c.confidence * 100)}%</div>
          </div>
        </div>
      </motion.div>

      {/* Grid details */}
      <motion.div 
        variants={staggerContainer}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Radar skillset dimension */}
        <motion.div 
          variants={listItem}
          className="glass-panel border border-glass-border rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]"
        >
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 font-display self-start">Capabilities Matrix</h3>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillRadarData}>
                <PolarGrid stroke="rgba(255, 255, 255, 0.05)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 8 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 8 }} />
                <Radar name="Candidate" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* AI Explanation details */}
        <div className="md:col-span-2 space-y-6">
          <Section title="AI Recruiter Breakdown" icon={Brain} color="violet">
            <p className="text-xs text-slate-350 leading-relaxed font-sans">{c.explanation || 'No structured summary returned.'}</p>
          </Section>
        </div>

        {/* Strengths */}
        <Section title="Evaluated Strengths" icon={CheckCircle2} color="emerald">
          <BulletList items={c.strengths} icon={BadgeCheck} color="emerald" />
        </Section>

        {/* Gaps */}
        <Section title="Flagged Gaps" icon={AlertTriangle} color="rose">
          <BulletList items={c.gaps} icon={AlertTriangle} color="rose" />
        </Section>

        {/* Skills Detected */}
        <Section title="Detected Skills" icon={TrendingUp} color="sky">
          <TagList items={c.skills} color="slate" />
        </Section>

        {/* Missing Skills */}
        <Section title="Missing Skill Targets" icon={AlertTriangle} color="amber">
          <TagList items={c.missing_skills} color="rose" />
        </Section>

        {/* Education */}
        <Section title="Academic Pedigree" icon={BookOpen} color="indigo">
          <BulletList items={c.education} icon={BookOpen} color="slate" />
        </Section>

        {/* Certifications / Projects */}
        <Section title="Projects & Verification" icon={BadgeCheck} color="violet">
          <BulletList items={c.projects || c.certifications} icon={BadgeCheck} color="slate" />
        </Section>
      </motion.div>
    </motion.div>
  );
}
