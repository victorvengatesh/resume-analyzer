import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Brain, Users, Award, HelpCircle, CheckCircle2,
  AlertTriangle, BookOpen, Briefcase, BadgeCheck, FileText,
  DollarSign, Sparkles, RefreshCw, Save, Calendar, User,
  Plus, Edit3, Trash2, ArrowLeft, Download, Check, Loader2, Send
} from 'lucide-react';
import { API_BASE, fetchCandidates, Candidate, submitCopilotMessage, getScoreColor, getLevelColor } from '../api';
import { mockStore } from '../lib/mockStore';
import { useToast } from '../components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { pageVariants, listItem, staggerContainer } from '../lib/motion';
import { Button } from '../components/ui/Button';

type Question = {
  question: string;
  difficulty: string;
  expected_answer: string;
  criteria: string;
  followups: string[];
};

type InterviewKitData = {
  kit_id: string;
  resume_id: string;
  candidate: {
    name: string;
    email: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    job_applied: string;
    ats_score: number;
    match_level: string;
    exp_years: number;
    skills: string[];
    missing_skills: string[];
    strengths: string[];
    gaps: string[];
    education: string[];
    certifications: string[];
    projects: string[];
    explanation: string;
  };
  questions: {
    technical: Question[];
    coding: Question[];
    scenario: Question[];
    behavioral: Question[];
    hr: Question[];
  };
  scorecard_categories: { category: string; max_score: number }[];
  recommendation: {
    verdict: string;
    reasoning: string;
    pros: string[];
    cons: string[];
    risks: string[];
    suggested_salary_level: string;
  };
  generated_at: string;
  model_used: string;
};

type InterviewSession = {
  session_id: string;
  resume_id: string;
  kit_id: string;
  interviewer_name: string;
  interview_date: string;
  notes: string;
  scorecard_values: Record<string, number>;
  total_score: number;
  decision: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
};

export default function InterviewCopilot() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error: toastError, info } = useToast();
  const candidateIdFromUrl = searchParams.get('candidate_id');

  // Candidate list state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string>('');

  // Interview Kit state
  const [kit, setKit] = useState<InterviewKitData | null>(null);
  const [loadingKit, setLoadingKit] = useState(false);
  const [errorKit, setErrorKit] = useState<string | null>(null);

  // Active tab inside the kit
  const [activeTab, setActiveTab] = useState<'dashboard' | 'questions' | 'chat' | 'evaluation' | 'history'>('dashboard');
  const [activeQuestionCategory, setActiveQuestionCategory] = useState<'technical' | 'coding' | 'scenario' | 'behavioral' | 'hr'>('technical');

  // Scorecard / Notes Form state
  const [interviewerName, setInterviewerName] = useState('Recruiter Sandbox');
  const [decision, setDecision] = useState('Maybe');
  const [notes, setNotes] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [savingSession, setSavingSession] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sessions History state
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Copilot Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatThinking, setChatThinking] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // Initialize scorecard values
  const initScorecard = (categories: { category: string }[]) => {
    const defaultScores: Record<string, number> = {};
    categories.forEach(c => {
      defaultScores[c.category] = 7; // mid point
    });
    setScores(defaultScores);
  };

  // Generate localized kit mock in sandbox
  const generateMockKit = (candidateId: string): InterviewKitData => {
    const match = mockStore.getCandidateById(candidateId) || mockStore.getCandidates()[0];
    const candidateName = match.filename.replace(/_Resume|_/g, ' ').replace(/\.pdf$/, '');
    
    return {
      kit_id: `kit-${candidateId}`,
      resume_id: candidateId,
      candidate: {
        name: candidateName,
        email: match.email || 'recruiter-sandbox@example.com',
        phone: match.phone || '+1 (555) 012-3456',
        linkedin: match.linkedin || 'linkedin.com',
        github: match.github || 'github.com',
        job_applied: match.job_applied || 'Software Architect',
        ats_score: match.total_score,
        match_level: match.match_level,
        exp_years: match.exp_years,
        skills: match.skills,
        missing_skills: match.missing_skills,
        strengths: match.strengths,
        gaps: match.gaps,
        education: match.education,
        certifications: match.certifications,
        projects: match.projects,
        explanation: match.explanation
      },
      questions: {
        technical: [
          {
            question: `Explain how you would design a scalable state sync system for ${match.skills[0] || 'React'} application components.`,
            difficulty: 'Hard',
            expected_answer: 'Recruiter looks for clean state machine modeling, throttle configurations, or optimistic updates.',
            criteria: 'Understands concurrency patterns and event pipelines.',
            followups: ['How do you verify visual performance limits?', 'What happens during network partitions?']
          },
          {
            question: `How would you minimize bundle latency when importing third party elements?`,
            difficulty: 'Medium',
            expected_answer: 'Dynamic code splitting, lazy-loading modules, tree shaking configs.',
            criteria: 'Practical familiarity with build setups (Vite/Rspack).',
            followups: ['Do you configure separate vendor chunks?']
          }
        ],
        coding: [
          {
            question: 'Implement a custom debounce function that supports cancellation.',
            difficulty: 'Medium',
            expected_answer: 'Return function with clearing timeout methods.',
            criteria: 'Flawless closure handling in JavaScript.',
            followups: []
          }
        ],
        scenario: [
          {
            question: `A critical release is pending, but QA identifies that animations trigger frame drops on low tier mobile engines. How do you isolate the error?`,
            difficulty: 'Hard',
            expected_answer: 'Use chrome devtools performance profiler to locate layout thrashing.',
            criteria: 'Systematic profiling competence.',
            followups: []
          }
        ],
        behavioral: [
          {
            question: 'Tell us about a time you had to push back on a designer\'s spec due to visual performance constraints.',
            difficulty: 'Medium',
            expected_answer: 'Demonstrates partnership, technical alternative pitches, and alignment on UX tradeoffs.',
            criteria: 'Collaboration skills.',
            followups: []
          }
        ],
        hr: [
          {
            question: 'Why are you leaving your current team?',
            difficulty: 'Easy',
            expected_answer: 'Focused on next stage scaling, high-density AI interfaces.',
            criteria: 'Professional attitude.',
            followups: []
          }
        ]
      },
      scorecard_categories: [
        { category: 'Technical Architecture & Scale', max_score: 10 },
        { category: 'Problem Solving & Algorithms', max_score: 10 },
        { category: 'UX Empathy & Motion design', max_score: 10 },
        { category: 'Infrastructure & Tooling', max_score: 10 },
        { category: 'Collaboration & Communication', max_score: 10 }
      ],
      recommendation: {
        verdict: match.total_score >= 75 ? 'Strong Hire' : 'Maybe',
        reasoning: `Based on automated resume parsing, candidate matches ${match.total_score}% of target requirements. Skill profile shows immediate utility for target tasks, with minor gaps in infrastructure orchestration.`,
        pros: match.strengths.slice(0, 2),
        cons: match.gaps.slice(0, 2),
        risks: ['Initial onboarding velocity might depend on team tooling support.'],
        suggested_salary_level: match.total_score >= 85 ? '$140k - $165k' : '$110k - $130k'
      },
      generated_at: new Date().toISOString(),
      model_used: 'Gemini 2.5 Flash'
    };
  };

  // 1. Fetch all candidates on mount
  useEffect(() => {
    fetchCandidates({ limit: 100 })
      .then(data => {
        setCandidates(data);
        if (candidateIdFromUrl) {
          setActiveCandidateId(candidateIdFromUrl);
        } else if (data.length > 0) {
          setActiveCandidateId(data[0].id);
        }
      })
      .catch(console.error);
  }, [candidateIdFromUrl]);

  // 2. Fetch kit and history when active candidate changes
  useEffect(() => {
    if (!activeCandidateId) return;

    setKit(null);
    setErrorKit(null);
    setLoadingKit(true);
    setSaveSuccess(false);
    
    // Seed default welcome message in chat
    const match = mockStore.getCandidateById(activeCandidateId) || mockStore.getCandidates()[0];
    const candName = match.filename.replace(/_Resume|_/g, ' ').replace(/\.pdf$/, '');
    setChatMessages([
      {
        id: 'msg-init',
        sender: 'ai',
        text: `Hello! I'm your AI Interview Copilot for **${candName}**. Ask me questions about their skillset, experience gaps, strengths, or request tailored coding problems.`
      }
    ]);

    // Try fetching existing kit
    fetch(`${API_BASE}/api/v1/interview/${activeCandidateId}/kit`)
      .then(async res => {
        if (!res.ok) throw new Error('Not generated');
        const data = await res.json();
        setKit(data);
        initScorecard(data.scorecard_categories);
        loadSessions(activeCandidateId);
      })
      .catch(() => {
        // Safe sandbox fallback: immediately compile mock kit
        const mockKit = generateMockKit(activeCandidateId);
        setKit(mockKit);
        initScorecard(mockKit.scorecard_categories);
        loadSessions(activeCandidateId);
      })
      .finally(() => {
        setLoadingKit(false);
      });
  }, [activeCandidateId]);

  // 3. Load past sessions
  const loadSessions = (resumeId: string) => {
    setLoadingSessions(true);
    fetch(`${API_BASE}/api/v1/interview/${resumeId}/sessions`)
      .then(res => res.json())
      .then(setSessions)
      .catch(() => {
        // Sandbox localStorage history fallback
        const cached = localStorage.getItem(`sessions_history_${resumeId}`);
        if (cached) {
          setSessions(JSON.parse(cached));
        } else {
          setSessions([]);
        }
      })
      .finally(() => setLoadingSessions(false));
  };

  // 4. Generate Kit via AI
  const handleGenerateKit = () => {
    if (!activeCandidateId) return;
    setLoadingKit(true);
    setErrorKit(null);
    setSaveSuccess(false);

    fetch(`${API_BASE}/api/v1/interview/${activeCandidateId}/generate`, { method: 'POST' })
      .then(async res => {
        if (!res.ok) throw new Error('AI generation failed');
        return res.json();
      })
      .then(data => {
        setKit(data);
        initScorecard(data.scorecard_categories);
        loadSessions(activeCandidateId);
        success('Kit Compiled', 'AI Interview Kit parsed successfully.');
      })
      .catch(() => {
        // Fallback simulation
        const mockKit = generateMockKit(activeCandidateId);
        setKit(mockKit);
        initScorecard(mockKit.scorecard_categories);
        success('Kit Compiled', 'Compiled sandbox recruiting guidelines.');
      })
      .finally(() => setLoadingKit(false));
  };

  // 5. Save Interview Session
  const handleSaveSession = () => {
    if (!activeCandidateId || !kit) return;
    setSavingSession(true);
    setSaveSuccess(false);

    const payload = {
      interviewer_name: interviewerName,
      interview_date: new Date().toISOString(),
      notes: notes,
      scorecard_values: scores,
      decision: decision
    };

    fetch(`${API_BASE}/api/v1/interview/${activeCandidateId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) throw new Error('Save failed');
        return res.json();
      })
      .then(() => {
        setSaveSuccess(true);
        setNotes('');
        loadSessions(activeCandidateId);
        setActiveTab('history');
      })
      .catch(() => {
        // Sandbox Save Fallback to LocalStorage
        const total = Object.values(scores).reduce((sum, val) => sum + val, 0);
        const newSession: InterviewSession = {
          session_id: `sess-${Date.now()}`,
          resume_id: activeCandidateId,
          kit_id: kit.kit_id,
          interviewer_name: interviewerName,
          interview_date: new Date().toISOString(),
          notes: notes,
          scorecard_values: scores,
          total_score: total,
          decision: decision,
          created_at: new Date().toISOString()
        };

        const existing = [...sessions, newSession];
        localStorage.setItem(`sessions_history_${activeCandidateId}`, JSON.stringify(existing));
        setSessions(existing);
        setSaveSuccess(true);
        setNotes('');
        success('Scorecard Saved', 'Recruiter notes written to sandbox history ledger.');
        setActiveTab('history');
      })
      .finally(() => setSavingSession(false));
  };

  // 6. Streaming Copilot message submission
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatThinking) return;

    const userMessageText = chatInput.trim();
    const userMsgId = `msg-user-${Date.now()}`;
    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userMessageText }]);
    setChatInput('');
    setChatThinking(true);
    setStreamingText('');

    try {
      const result = await submitCopilotMessage(userMessageText, activeCandidateId);
      
      // Streaming effect
      let currentIdx = 0;
      const fullResponse = result.response;
      setChatThinking(false);
      
      const interval = setInterval(() => {
        setStreamingText(prev => prev + fullResponse.charAt(currentIdx));
        currentIdx++;
        if (currentIdx >= fullResponse.length) {
          clearInterval(interval);
          setChatMessages(prev => [...prev, { id: `msg-ai-${Date.now()}`, sender: 'ai', text: fullResponse }]);
          setStreamingText('');
        }
      }, 10);
    } catch (err: any) {
      setChatThinking(false);
      setChatMessages(prev => [...prev, { id: `msg-err-${Date.now()}`, sender: 'ai', text: 'Error: Could not retrieve response from Copilot server.' }]);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const totalScore = (Object.values(scores) as number[]).reduce((sum, val) => sum + val, 0);
  const maxPossibleScore = (kit?.scorecard_categories.length || 5) * 10;
  const percentageScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-6 max-w-7xl mx-auto print:bg-white print:text-black"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2 font-display tracking-tight">
            <Brain className="w-6 h-6 text-violet-500 animate-pulse" />
            Interview Cockpit
          </h2>
          <p className="text-slate-500 text-xs mt-1">Structured interview guidelines, question banks and copilot chat.</p>
        </div>
        {kit && (
          <Button
            variant="outline"
            onClick={handlePrintPDF}
            icon={<Download className="w-4 h-4" />}
          >
            Export Kit Blueprint (PDF)
          </Button>
        )}
      </div>

      {/* Selection Dropdown */}
      <div className="glass-panel border border-glass-border rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 print:hidden">
        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold tracking-wider flex-shrink-0 font-mono">
          <Users className="w-4 h-4" />
          Target Candidate:
        </div>
        <select
          value={activeCandidateId}
          onChange={e => setActiveCandidateId(e.target.value)}
          className="flex-1 bg-slate-950 border border-glass-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono cursor-pointer"
        >
          {candidates.map(c => (
            <option key={c.id} value={c.id}>
              {c.name?.replace(/\.(pdf|docx?)$/i, '')} — {c.skills?.slice(0, 3).join(', ')} ({c.score}%)
            </option>
          ))}
        </select>
      </div>

      {/* Loading Spinner */}
      {loadingKit && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Generating customized recruiting kit...</p>
        </div>
      )}

      {/* Kit Workspace */}
      {kit && !loadingKit && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1 flex flex-col gap-2 print:hidden">
            {[
              { id: 'dashboard', label: 'Evaluation Deck', icon: FileText },
              { id: 'questions', label: 'AI Question Bank', icon: HelpCircle },
              { id: 'chat', label: 'AI Copilot Chat', icon: Brain },
              { id: 'evaluation', label: 'Candidate Scorecard', icon: Award },
              { id: 'history', label: 'Recruitment Log', icon: Calendar },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-violet-650/20 border border-violet-500/30 text-violet-300'
                      : 'glass-panel border border-glass-border text-slate-400 hover:text-slate-250 hover:border-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}

            {/* Quick Stats Panel */}
            <div className="glass-panel border border-glass-border rounded-2xl p-4 mt-4 space-y-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Automated Rank</div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-extrabold font-mono text-white leading-none">{Math.round(kit.candidate.ats_score)}%</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getLevelColor(kit.candidate.match_level)}`}>
                  {kit.candidate.match_level}
                </span>
              </div>
              <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-glass-border">
                <div className="h-full bg-violet-500" style={{ width: `${kit.candidate.ats_score}%` }} />
              </div>
              <button
                onClick={handleGenerateKit}
                className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-glass-border hover:border-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-all bg-slate-950/40 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recompile Kit
              </button>
            </div>
          </div>

          {/* Main Kit Content Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Tab 1: Dashboard */}
            {activeTab === 'dashboard' && (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
                {/* AI Recommendation Banner */}
                <motion.div variants={listItem} className="glass-panel border border-glass-border rounded-2xl p-6 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Hiring Verdict</h3>
                      <div className="text-base font-bold text-white mt-1 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                        Verdict:
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getLevelColor(kit.recommendation.verdict)}`}>
                          {kit.recommendation.verdict}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-glass-border px-4 py-2 rounded-xl text-center">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Salary Range Suggestion</div>
                      <div className="text-sm font-extrabold font-mono text-white flex items-center justify-center gap-0.5 mt-0.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        {kit.recommendation.suggested_salary_level}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 border border-glass-border p-4 rounded-xl font-sans">
                    {kit.recommendation.reasoning}
                  </p>
                  
                  {/* Pros & Cons Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2 bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                      <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-display">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Strengths (Pros)
                      </h4>
                      <ul className="space-y-1">
                        {(kit.recommendation.pros || []).map((p, i) => (
                          <li key={i} className="text-xs text-slate-350 flex items-start gap-1">
                            <span className="text-emerald-450">•</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2 bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl">
                      <h4 className="text-[10px] font-bold text-rose-455 uppercase tracking-wider flex items-center gap-1.5 font-display">
                        <AlertTriangle className="w-3.5 h-3.5" /> Gaps (Cons)
                      </h4>
                      <ul className="space-y-1">
                        {(kit.recommendation.cons || []).map((c, i) => (
                          <li key={i} className="text-xs text-slate-350 flex items-start gap-1">
                            <span className="text-rose-400">•</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                      <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-display">
                        <AlertTriangle className="w-3.5 h-3.5" /> Risks
                      </h4>
                      <ul className="space-y-1">
                        {(kit.recommendation.risks || []).map((r, i) => (
                          <li key={i} className="text-xs text-slate-355 flex items-start gap-1">
                            <span className="text-amber-400">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>

                {/* Candidate Overview Card */}
                <motion.div variants={listItem} className="glass-panel border border-glass-border rounded-2xl p-6 space-y-6">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
                    <FileText className="w-4 h-4 text-violet-400" /> Candidate Profile Summary
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Education Summary</div>
                      <div className="space-y-1.5">
                        {(kit.candidate.education || []).map((e, i) => (
                          <div key={i} className="text-xs text-slate-350 flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            {e}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Verification Details</div>
                      <div className="space-y-1.5">
                        {(kit.candidate.certifications || []).map((c, i) => (
                          <div key={i} className="text-xs text-slate-350 flex items-center gap-2">
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-450 flex-shrink-0" />
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Skills Grid */}
                  <div className="space-y-3 pt-4 border-t border-glass-border">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Analyzed Skill Matches</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(kit.candidate.skills || []).map(s => (
                          <span key={s} className="text-[10px] px-2.5 py-0.5 bg-slate-950 text-slate-400 border border-glass-border rounded-lg uppercase tracking-wider font-mono">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-2">
                      <div className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2">Flagged Skill Deficiency</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(kit.candidate.missing_skills || []).map(s => (
                          <span key={s} className="text-[10px] px-2.5 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg uppercase tracking-wider font-mono">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Tab 2: AI Questions */}
            {activeTab === 'questions' && (
              <motion.div variants={pageVariants} initial="initial" animate="animate" className="glass-panel border border-glass-border rounded-2xl p-6 space-y-6">
                <div className="flex flex-wrap gap-2 border-b border-glass-border pb-4">
                  {[
                    { id: 'technical', label: 'Technical Context' },
                    { id: 'coding', label: 'Coding Test Cases' },
                    { id: 'scenario', label: 'System Design/Scenario' },
                    { id: 'behavioral', label: 'Behavioral & Culture' },
                    { id: 'hr', label: 'Background/HR' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveQuestionCategory(cat.id as any)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        activeQuestionCategory === cat.id
                          ? 'bg-violet-600/15 border-violet-500/35 text-violet-300'
                          : 'border-glass-border bg-slate-950/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {(kit.questions[activeQuestionCategory] || []).map((q, i) => (
                    <div key={i} className="bg-slate-950/60 border border-glass-border rounded-xl p-5 space-y-3 hover:border-slate-800 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-xs font-semibold text-slate-200 flex gap-2 leading-relaxed">
                          <span className="text-violet-400 font-mono">Q{i + 1}.</span>
                          <span>{q.question}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase flex-shrink-0 ${
                          q.difficulty === 'Hard' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          q.difficulty === 'Medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {q.difficulty}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] pt-3 border-t border-glass-border">
                        <div>
                          <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">Expected Answer Concept</div>
                          <p className="text-slate-400 leading-normal leading-relaxed">{q.expected_answer}</p>
                        </div>
                        <div>
                          <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">Rubric Grading Criteria</div>
                          <p className="text-slate-400 leading-normal leading-relaxed">{q.criteria}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tab 3: AI Copilot Chat */}
            {activeTab === 'chat' && (
              <motion.div 
                variants={pageVariants} 
                initial="initial" 
                animate="animate" 
                className="glass-panel border border-glass-border rounded-2xl p-5 flex flex-col h-[580px] justify-between relative overflow-hidden"
              >
                {/* Chat header */}
                <div className="border-b border-glass-border pb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-accent-cyan animate-pulse" />
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Candidate Analysis Copilot</h3>
                    <p className="text-[10px] text-slate-550 font-mono">Consulting custom intelligence model on candidate ledger</p>
                  </div>
                </div>

                {/* Messages ledger */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  {chatMessages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed border ${
                        msg.sender === 'user'
                          ? 'bg-violet-650/15 border-violet-500/20 text-violet-100 rounded-tr-none'
                          : 'bg-slate-950/80 border-glass-border text-slate-300 rounded-tl-none font-sans'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  
                  {/* Live Streaming Response */}
                  {streamingText && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed border bg-slate-950/80 border-glass-border text-slate-300 rounded-tl-none">
                        {streamingText}
                        <span className="w-1.5 h-3.5 bg-violet-400 inline-block animate-pulse ml-1 align-middle" />
                      </div>
                    </div>
                  )}

                  {/* Thinking neural pulse */}
                  {chatThinking && (
                    <div className="flex justify-start items-center gap-2.5 p-3.5 bg-slate-950/40 border border-glass-border rounded-2xl w-fit">
                      <Brain className="w-4 h-4 text-accent-cyan pulse-glow-cyan rounded-full animate-bounce" />
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full typing-dot" />
                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full typing-dot" />
                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full typing-dot" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input action */}
                <form onSubmit={handleSendChat} className="border-t border-glass-border pt-4 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Ask about candidate strengths, technical gaps or salary recommendations..."
                    className="flex-1 bg-slate-950 border border-glass-border rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 font-mono"
                    disabled={chatThinking}
                  />
                  <Button
                    type="submit"
                    disabled={!chatInput.trim() || chatThinking}
                    icon={<Send className="w-4 h-4" />}
                    className="shadow-neon-primary px-4 py-2.5"
                  />
                </form>
              </motion.div>
            )}

            {/* Tab 4: Evaluation Scorecard */}
            {activeTab === 'evaluation' && (
              <motion.div variants={pageVariants} initial="initial" animate="animate" className="glass-panel border border-glass-border rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-glass-border pb-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Interview scorecard ledger</h3>
                  <div className="flex items-center gap-2 bg-slate-955 border border-glass-border px-3 py-1.5 rounded-xl font-mono">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Composite grade:</span>
                    <span className="text-xs font-extrabold text-violet-400">{totalScore} / {maxPossibleScore} ({percentageScore}%)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sliders */}
                  <div className="space-y-4">
                    {kit.scorecard_categories.map(cat => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-350">{cat.category}</span>
                          <span className="text-violet-400 font-extrabold font-mono">{scores[cat.category] || 7} / 10</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={scores[cat.category] || 7}
                          onChange={e => setScores({ ...scores, [cat.category]: Number(e.target.value) })}
                          className="w-full accent-violet-550 bg-slate-950 h-1.5 rounded-full appearance-none cursor-pointer border border-glass-border"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Interviewer Credential</label>
                      <input
                        type="text"
                        value={interviewerName}
                        onChange={e => setInterviewerName(e.target.value)}
                        className="w-full bg-slate-950 border border-glass-border rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                        placeholder="Interviewer Name"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Decision Recommendation</label>
                      <select
                        value={decision}
                        onChange={e => setDecision(e.target.value)}
                        className="w-full bg-slate-950 border border-glass-border rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono cursor-pointer"
                      >
                        <option>Strong Hire</option>
                        <option>Hire</option>
                        <option>Maybe</option>
                        <option>Reject</option>
                        <option>Second Round</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Observations Notes</label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={5}
                        className="w-full bg-slate-950 border border-glass-border rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none font-sans"
                        placeholder="Detail candidate reactions, coding speed, and architectural defense..."
                      />
                    </div>

                    {saveSuccess && (
                      <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg font-semibold">
                        <Check className="w-3.5 h-3.5 animate-bounce" />
                        Notes cached in workspace logs!
                      </div>
                    )}

                    <Button
                      onClick={handleSaveSession}
                      disabled={savingSession}
                      className="w-full shadow-neon-primary"
                    >
                      Commit scorecard session
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 5: History logs */}
            {activeTab === 'history' && (
              <motion.div variants={pageVariants} initial="initial" animate="animate" className="glass-panel border border-glass-border rounded-2xl p-6 space-y-6">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-glass-border pb-4 font-display">Recruitment verification ledger</h3>
                
                {loadingSessions ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-slate-550 text-center py-10">No records compiled. Perform a candidate scorecard evaluation to create records.</p>
                ) : (
                  <div className="space-y-4">
                    {sessions.map(s => (
                      <div key={s.session_id} className="bg-slate-950/60 border border-glass-border rounded-xl p-5 space-y-3">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-glass-border flex items-center justify-center text-xs text-slate-400 font-bold uppercase">
                              {(s.interviewer_name || 'U')[0]}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-200">{s.interviewer_name}</div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                {new Date(s.interview_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-900 px-2 py-0.5 border border-glass-border rounded-lg text-slate-450 font-mono">
                              Grade: {s.total_score}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              s.decision === 'Strong Hire' || s.decision === 'Hire' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' :
                              s.decision === 'Reject' ? 'bg-rose-500/15 text-rose-300 border-rose-500/20' :
                              'bg-amber-500/15 text-amber-300 border-amber-500/20'
                            }`}>
                              {s.decision}
                            </span>
                          </div>
                        </div>

                        {s.notes && (
                          <p className="text-xs text-slate-450 leading-relaxed bg-slate-950/80 border border-glass-border/40 p-3 rounded-lg font-sans">
                            {s.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
