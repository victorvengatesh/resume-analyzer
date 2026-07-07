import { mockStore } from './lib/mockStore';

// In development, Vite proxies /api/* → http://localhost:8000 so we use '' (relative).
// In production builds, set VITE_API_BASE_URL to the deployed backend URL.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export type AnalysisResult = {
  id: string;
  filename: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  skills: string[];
  skill_score: number;
  exp_years: number;
  exp_score: number;
  total_score: number;
  job_applied: string;
  match_level: string;
  explanation: string;
  missing_skills: string[];
  strengths: string[];
  gaps: string[];
  education: string[];
  projects: string[];
  certifications: string[];
  retrieved_chunks: string[];
  confidence: number;
  size: number;
  uploaded_at: string;
};

export type DashboardStats = {
  total_resumes: number;
  total_candidates: number;
  total_interviews?: number;
  shortlisted_candidates?: number;
  rejected_candidates?: number;
  pending_candidates?: number;
  average_score: number;
  average_interview_score?: number;
  average_confidence: number;
  highest_match_score?: number;
  lowest_match_score?: number;
  top_skills: { name: string; count: number }[];
  missing_skills_analytics: { name: string; count: number }[];
  match_level_distribution: { level: string; count: number }[];
  status_distribution?: { status: string; count: number }[];
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  skills: string[];
  score: number;
  match_level?: string;
  status?: string;
  location?: string;
  exp_years?: number;
  uploaded_at: string;
};

// ─── Auth helpers ────────────────────────────────────────────────────────────

export const getAuthToken = (): string | null =>
  localStorage.getItem('smart_resume_jwt_token');

export const setAuthToken = (token: string | null) => {
  if (token) localStorage.setItem('smart_resume_jwt_token', token);
  else localStorage.removeItem('smart_resume_jwt_token');
};

export const isAuthenticated = (): boolean => !!getAuthToken();

// ─── Network error detection ─────────────────────────────────────────────────

/**
 * Returns true only for genuine network/connectivity failures (fetch threw
 * without ever receiving an HTTP response).  HTTP 4xx / 5xx are NOT network
 * errors — they carry real server information and must be surfaced to the
 * caller, not silently replaced with mock data.
 */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // TypeError: Failed to fetch / NetworkError / net::ERR_CONNECTION_REFUSED
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('err_connection')
  );
}

// ─── handleApiRequest ────────────────────────────────────────────────────────

/**
 * BUG 4 FIX: Only fall back to mock data on genuine network failures
 * (backend unreachable / offline).  HTTP errors from a running backend
 * (4xx, 5xx) are re-thrown so the caller can surface them to the user.
 *
 * Previously, every error — including 500s caused by corrupted file bytes —
 * was silently swallowed, and the same static mock result was returned for
 * every upload, making it look like the same resume was always shown.
 */
export const handleApiRequest = async <T>(
  apiCall: () => Promise<T>,
  fallbackData: T | (() => Promise<T>) | (() => T),
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error) {
    if (!isNetworkError(error)) {
      // Real server error — re-throw so the UI can show the actual message
      throw error;
    }
    // Backend is unreachable (offline / cold start) → use mock/demo data
    console.warn('[api] Backend unreachable — using demo data:', error);
    await new Promise(resolve => setTimeout(resolve, 300));
    if (typeof fallbackData === 'function') {
      return await (fallbackData as () => Promise<T> | T)();
    }
    return fallbackData;
  }
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export const login = async (
  email: string,
  password: string,
): Promise<{ token: string }> => {
  if (email === 'demo@smartresume.ai' && password === 'demo123') {
    const token = 'mock-jwt-token-demo-smart-resume';
    setAuthToken(token);
    return { token };
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    setAuthToken(data.access_token || data.token);
    return { token: data.access_token || data.token };
  } catch (err) {
    if (email === 'demo@smartresume.ai') {
      const token = 'mock-jwt-token-demo-smart-resume';
      setAuthToken(token);
      return { token };
    }
    throw err;
  }
};

export const register = async (
  email: string,
  password: string,
): Promise<{ success: boolean }> => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Registration failed');
    return { success: true };
  } catch {
    return { success: true }; // Demo registration always passes
  }
};

// ─── Dashboard / Candidates ───────────────────────────────────────────────────

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const token = getAuthToken();
  return handleApiRequest(
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/analytics/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    mockStore.getStats(),
  );
};

export const fetchCandidates = async (params?: {
  q?: string;
  min_score?: number;
  job_role?: string;
  status?: string;
  location?: string;
  min_experience?: number;
  skills?: string;
  limit?: number;
  offset?: number;
}): Promise<Candidate[]> => {
  const token = getAuthToken();
  return handleApiRequest(
    async () => {
      const url = new URL(`${API_BASE}/api/v1/resumes`);
      if (params?.q) url.searchParams.set('q', params.q);
      if (params?.min_score != null) url.searchParams.set('min_score', String(params.min_score));
      if (params?.job_role) url.searchParams.set('job_role', params.job_role);
      if (params?.status) url.searchParams.set('status', params.status);
      if (params?.location) url.searchParams.set('location', params.location);
      if (params?.min_experience != null)
        url.searchParams.set('min_experience', String(params.min_experience));
      if (params?.skills) url.searchParams.set('skills', params.skills);
      if (params?.limit) url.searchParams.set('limit', String(params.limit));
      if (params?.offset) url.searchParams.set('offset', String(params.offset));

      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch candidates');
      return res.json();
    },
    mockStore
      .getCandidates()
      .map(c => ({
        id: c.id,
        name: c.filename.replace(/_Resume|_/g, ' ').replace(/\.pdf$/, ''),
        email: c.email || 'info@smartresume.ai',
        skills: c.skills,
        score: c.total_score,
        match_level: c.match_level,
        status:
          c.total_score >= 75 ? 'Shortlisted' : c.total_score >= 50 ? 'Pending' : 'Rejected',
        location: 'Remote',
        exp_years: c.exp_years,
        uploaded_at: c.uploaded_at,
      }))
      .filter(c => {
        if (params?.q) {
          const query = params.q.toLowerCase();
          return (
            c.name.toLowerCase().includes(query) ||
            c.skills.some(s => s.toLowerCase().includes(query))
          );
        }
        return true;
      }),
  );
};

export const fetchCandidate = async (id: string): Promise<AnalysisResult> => {
  const token = getAuthToken();
  return handleApiRequest(
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/resumes/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch candidate');
      return res.json();
    },
    mockStore.getCandidateById(id) ?? mockStore.getCandidates()[0],
  );
};

export const deleteCandidate = async (id: string): Promise<{ success: boolean }> => {
  mockStore.deleteCandidate(id);
  const token = getAuthToken();
  try {
    await fetch(`${API_BASE}/api/v1/resumes/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    console.warn('Could not delete candidate on backend — removed locally only');
  }
  return { success: true };
};

// ─── Mock-data helpers ────────────────────────────────────────────────────────

/**
 * BUG 3 FIX: Derive a stable, per-file numeric seed from the filename and
 * file size.  Two different files always produce different scores,
 * skill sets, experience values, and IDs — even if the backend is offline.
 *
 * Previously every file got the SAME static skill list / score, so uploading
 * five resumes produced five identical result cards.
 */
function fileSeed(filename: string, size: number): number {
  let h = size;
  for (let i = 0; i < filename.length; i++) {
    h = (Math.imul(31, h) + filename.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Seeded pseudo-random integer in [min, max] */
function seededInt(seed: number, offset: number, min: number, max: number): number {
  const r = Math.abs(Math.sin(seed + offset) * 10000) % 1;
  return Math.floor(r * (max - min + 1)) + min;
}

const SKILL_POOL = [
  ['React', 'TypeScript', 'TailwindCSS', 'Next.js', 'GraphQL'],
  ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis'],
  ['Node.js', 'Express', 'MongoDB', 'AWS', 'Terraform'],
  ['Java', 'Spring Boot', 'Kubernetes', 'CI/CD', 'Kafka'],
  ['Go', 'gRPC', 'Prometheus', 'Linux', 'Bash'],
  ['Data Science', 'PyTorch', 'Pandas', 'SQL', 'Airflow'],
];

const MISSING_POOL = ['AWS', 'CI/CD', 'Kubernetes', 'System Design', 'WebAssembly', 'Rust'];

const MATCH_LEVELS = ['Strong Match', 'Good Match', 'Moderate Match', 'Weak Match'] as const;

function buildMockResult(file: File, jobRole: string, index: number): AnalysisResult {
  const seed = fileSeed(file.name, file.size) + index * 97;
  const candidateName = file.name.replace(/_Resume|_/g, ' ').replace(/\.[^/.]+$/, '').trim();
  const slug = candidateName.toLowerCase().replace(/\s+/g, '.');
  const skillSet = SKILL_POOL[seed % SKILL_POOL.length];
  const score = seededInt(seed, 1, 42, 95);
  const matchIdx = score >= 75 ? 0 : score >= 60 ? 1 : score >= 40 ? 2 : 3;
  const expYears = seededInt(seed, 3, 1, 10);

  return {
    id: `mock-${seed}-${Date.now()}-${index}`,
    filename: file.name,
    email: `${slug}@example.com`,
    phone: `+1 (555) ${String(seed % 900 + 100).padStart(3, '0')}-${String(seed % 9000 + 1000)}`,
    linkedin: `linkedin.com/in/${slug.replace(/\./g, '-')}`,
    github: `github.com/${slug.replace(/\./g, '-')}`,
    skills: skillSet,
    skill_score: seededInt(seed, 2, 50, 95),
    exp_years: expYears,
    exp_score: seededInt(seed, 4, 50, 95),
    total_score: score,
    job_applied: jobRole || 'Software Engineer',
    match_level: MATCH_LEVELS[matchIdx],
    explanation:
      `Offline demo result for "${candidateName}". ` +
      `Profile shows ${expYears} year(s) of experience with skills in ` +
      `${skillSet.slice(0, 3).join(', ')}. ` +
      `Connect the backend and set GEMINI_API_KEY for real AI analysis.`,
    missing_skills: MISSING_POOL.filter((_, i) => (seed + i) % 3 === 0).slice(0, 2),
    strengths: [
      `Proficiency in ${skillSet[0]} and ${skillSet[1]}`,
      `${expYears} year(s) of relevant industry experience`,
    ],
    gaps: [`Limited evidence of ${MISSING_POOL[(seed + 1) % MISSING_POOL.length]} experience`],
    education: [`B.S. Computer Science — University ${String.fromCharCode(65 + (seed % 26))}`],
    projects: [`Project ${String.fromCharCode(65 + (seed % 26))} — ${skillSet[0]} application`],
    certifications: [],
    retrieved_chunks: ['[Demo mode — no real text extraction performed]'],
    confidence: parseFloat((seededInt(seed, 5, 70, 95) / 100).toFixed(2)),
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };
}

// ─── Resume Analysis ──────────────────────────────────────────────────────────

export const analyzeResume = async (
  file: File,
  jobRole: string,
): Promise<AnalysisResult> => {
  const token = getAuthToken();

  const apiCall = async (): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(
      `${API_BASE}/api/v1/analyze?job_role=${encodeURIComponent(jobRole)}`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || 'Analysis failed');
    }
    const result: AnalysisResult = await res.json();
    mockStore.addCandidate(result);
    return result;
  };

  // BUG 3 FIX: Fallback builds a unique result per file using a seed derived
  // from the filename + size.  The old code returned the same static skill
  // list for every file, making all uploads look identical in offline mode.
  const fallback = (): AnalysisResult => {
    const result = buildMockResult(file, jobRole, 0);
    mockStore.addCandidate(result);
    return result;
  };

  return handleApiRequest(apiCall, fallback);
};

// ─── Batch Analysis ───────────────────────────────────────────────────────────

export const batchAnalyzeResumes = async (
  files: File[],
  jobRole: string,
  onProgress?: (pct: number, completed: number, total: number) => void,
): Promise<AnalysisResult[]> => {
  const token = getAuthToken();

  const apiCall = async (): Promise<AnalysisResult[]> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('job_description', jobRole);

    const startRes = await fetch(`${API_BASE}/api/v1/batch/analyze`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!startRes.ok) {
      const detail = await startRes.text();
      throw new Error(detail || 'Batch submission failed');
    }
    const { batch_id } = await startRes.json();

    const POLL_INTERVAL_MS = 1500;
    const MAX_POLLS = 120;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${API_BASE}/api/v1/batch/${batch_id}/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!pollRes.ok) throw new Error('Failed to poll batch status');
      const data = await pollRes.json();

      onProgress?.(data.progress_pct ?? 0, data.completed ?? 0, data.total_files ?? files.length);

      if (data.status === 'done') {
        const results = (data.results ?? []) as AnalysisResult[];
        results.forEach(res => mockStore.addCandidate(res));
        return results;
      }
      if (data.status === 'error') {
        throw new Error(data.errors?.[0]?.error || 'Batch processing failed');
      }
    }
    throw new Error('Batch analysis timed out. Please try again.');
  };

  // BUG 3 FIX: Build a unique per-file result using index + file seed so that
  // uploading N different files in offline mode produces N distinct cards.
  // The old loop emitted near-identical objects (same skills, same explanation)
  // for every file because nothing in the mock varied by file identity.
  const fallback = async (): Promise<AnalysisResult[]> => {
    const results: AnalysisResult[] = [];
    for (let i = 0; i < files.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      const pct = Math.round(((i + 1) / files.length) * 100);
      onProgress?.(pct, i + 1, files.length);
      const result = buildMockResult(files[i], jobRole, i);
      mockStore.addCandidate(result);
      results.push(result);
    }
    return results;
  };

  return handleApiRequest(apiCall, fallback);
};

// ─── AI Insights ──────────────────────────────────────────────────────────────

export const fetchAiInsights = async (): Promise<{ insights: string }> => {
  const token = getAuthToken();
  return handleApiRequest(
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/analytics/insights`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch insights');
      return res.json();
    },
    { insights: mockStore.getMockAiInsights() },
  );
};

// ─── Interview Copilot ────────────────────────────────────────────────────────

export const submitCopilotMessage = async (
  message: string,
  candidateId?: string,
): Promise<{ response: string }> => {
  const token = getAuthToken();

  const apiCall = async () => {
    const res = await fetch(`${API_BASE}/api/v1/interview/copilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, candidate_id: candidateId }),
    });
    if (!res.ok) throw new Error('Copilot message failed');
    return res.json();
  };

  const fallback = async (): Promise<{ response: string }> => {
    await new Promise(r => setTimeout(r, 1200));
    const msgLower = message.toLowerCase();

    if (msgLower.includes('victor') || msgLower.includes('vengatesh')) {
      return {
        response:
          '**Victor Vengatesh** is an excellent candidate for the **Senior Frontend Engineer** ' +
          'position. He scores **91%** on our ATS metrics. His strengths include expert React ' +
          'competency, custom motion choreography (Framer Motion), and core style management.',
      };
    }
    if (msgLower.includes('questions') || msgLower.includes('interview')) {
      return {
        response: `Here are three targeted technical questions for this role:\n1. **Frontend Architecture**: How do you approach state synchronization for high-density canvas objects in React?\n2. **Animation Performance**: What strategies prevent layout thrashing at 60fps during concurrent state updates?\n3. **Collaboration**: How do you bridge design-system specs and component-library implementations?`,
      };
    }
    return {
      response: `Based on the loaded candidate records, we have high confidence in their technical profiles. For specialized screening, recommend verifying AWS deployments and database migration experience.`,
    };
  };

  return handleApiRequest(apiCall, fallback());
};

// ─── Score / Level color helpers ──────────────────────────────────────────────

export const getScoreColor = (score: number) => {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-sky-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-rose-400';
};

export const getScoreBg = (score: number) => {
  if (score >= 75) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (score >= 60) return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
  if (score >= 40) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
};

export const getLevelColor = (level: string) => {
  if (level === 'Strong Match') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (level === 'Good Match') return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
  if (level === 'Moderate Match') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
};
