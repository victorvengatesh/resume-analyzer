import { AnalysisResult, DashboardStats, Candidate } from '../api';

// Pre-seeded candidates
const INITIAL_CANDIDATES: AnalysisResult[] = [
  {
    id: "cand-1",
    filename: "Victor_Vengatesh_Resume.pdf",
    email: "victor@vengatesh.dev",
    phone: "+1 (555) 019-2834",
    linkedin: "linkedin.com/in/victorvengatesh",
    github: "github.com/victorvengatesh",
    skills: ["React", "TypeScript", "Node.js", "Python", "GraphQL", "Docker", "AWS", "Framer Motion", "TailwindCSS"],
    skill_score: 92,
    exp_years: 5,
    exp_score: 88,
    total_score: 91,
    job_applied: "Senior Frontend Engineer",
    match_level: "Strong Match",
    explanation: "Victor demonstrates senior-level command over modern frontend frameworks (React, Framer Motion, TailwindCSS) and has built scalable full-stack pipelines. His experience aligns closely with product-focused roles at high-growth startups.",
    missing_skills: ["Next.js", "Kubernetes"],
    strengths: [
      "Expert knowledge of React, state management, and 60fps animations.",
      "Proven track record of designing flexible UI component libraries.",
      "Deep understanding of web performance and rendering pipelines."
    ],
    gaps: [
      "Limited direct production experience with complex orchestration layers like Kubernetes.",
      "No listed experience in rust or WebAssembly."
    ],
    education: ["B.S. in Computer Science - Stanford University"],
    projects: [
      "Antigravity UI - A luxury React component library with high performance canvas support",
      "StitchMCP - Next-gen canvas designer for product and styling engineering groups"
    ],
    certifications: ["AWS Certified Solutions Architect", "TensorFlow Developer Certification"],
    retrieved_chunks: [
      "Candidate worked at Linear as lead visual engineer building the interactive editor interface.",
      "Spearheaded redesign of Stripe Dashboard core telemetry page increasing frame rate to 60fps."
    ],
    confidence: 0.95,
    size: 2450000,
    uploaded_at: "2026-07-04T10:00:00Z"
  },
  {
    id: "cand-2",
    filename: "Jane_Doe_Data_Science.pdf",
    email: "jane.doe@datascience.io",
    phone: "+1 (555) 043-9921",
    linkedin: "linkedin.com/in/janedoe-ds",
    github: "github.com/janedoe-ds",
    skills: ["Python", "PyTorch", "SQL", "Pandas", "Scikit-Learn", "AWS", "Docker", "Machine Learning"],
    skill_score: 85,
    exp_years: 3,
    exp_score: 75,
    total_score: 80,
    job_applied: "AI/ML Engineer",
    match_level: "Strong Match",
    explanation: "Jane has a robust foundation in machine learning pipelines, specifically using PyTorch and traditional statistical packages. Her cloud expertise ensures models can be successfully hosted on AWS.",
    missing_skills: ["FastAPI", "Kubernetes"],
    strengths: [
      "Strong machine learning foundations and mathematical background.",
      "Demonstrated experience training transformers and LLM fine-tuning."
    ],
    gaps: [
      "Needs more exposure to real-time microservices design for low latency APIs."
    ],
    education: ["M.S. in Data Science - UC Berkeley"],
    projects: [
      "NeuroScribe - An AI writing assistant using custom mistral-7b weights"
    ],
    certifications: ["Google Cloud Professional ML Engineer"],
    retrieved_chunks: [
      "Developed and evaluated custom recommendation models driving a 4.2% lift in user retention."
    ],
    confidence: 0.89,
    size: 1890000,
    uploaded_at: "2026-07-03T14:30:00Z"
  },
  {
    id: "cand-3",
    filename: "Alex_Smith_Product_Mgr.pdf",
    email: "alex.smith@pm.org",
    phone: "+1 (555) 088-7711",
    linkedin: "linkedin.com/in/alexsmith-pm",
    github: null,
    skills: ["Product Roadmap", "SQL", "Agile", "User Research", "Jira", "A/B Testing", "Analytics"],
    skill_score: 65,
    exp_years: 2,
    exp_score: 55,
    total_score: 60,
    job_applied: "Product Manager",
    match_level: "Moderate Match",
    explanation: "Alex is an early-career product manager with high potential in structured research and roadmapping. He lacks technical system design experience but displays solid user empathy.",
    missing_skills: ["System Design", "Python"],
    strengths: [
      "Excellent communication and cross-functional team coordination.",
      "Analytical mindset using SQL for metrics evaluation."
    ],
    gaps: [
      "Limited technical architecture capability for scale.",
      "Few years of direct product management leadership."
    ],
    education: ["B.A. in Economics - Yale University"],
    projects: [
      "Linear Launch Integration - Redesigned the developer feedback loop"
    ],
    certifications: ["Certified Scrum Product Owner (CSPO)"],
    retrieved_chunks: [
      "Led user research cohort of 50 enterprise clients to refine the product requirements."
    ],
    confidence: 0.81,
    size: 1120000,
    uploaded_at: "2026-07-02T09:15:00Z"
  }
];

class MockStore {
  private candidates: AnalysisResult[] = [];
  
  constructor() {
    this.load();
  }

  private load() {
    const data = localStorage.getItem('smart_resume_candidates');
    if (data) {
      try {
        this.candidates = JSON.parse(data);
      } catch (e) {
        this.candidates = [...INITIAL_CANDIDATES];
      }
    } else {
      this.candidates = [...INITIAL_CANDIDATES];
      this.save();
    }
  }

  private save() {
    localStorage.setItem('smart_resume_candidates', JSON.stringify(this.candidates));
  }

  public getCandidates(): AnalysisResult[] {
    return this.candidates;
  }

  public getCandidateById(id: string): AnalysisResult | undefined {
    return this.candidates.find(c => c.id === id);
  }

  public addCandidate(candidate: AnalysisResult) {
    this.candidates = [candidate, ...this.candidates];
    this.save();
  }

  public deleteCandidate(id: string) {
    this.candidates = this.candidates.filter(c => c.id !== id);
    this.save();
  }

  public getStats(): DashboardStats {
    const total = this.candidates.length;
    const avgScore = total > 0 ? Math.round(this.candidates.reduce((acc, c) => acc + c.total_score, 0) / total) : 0;
    const avgConf = total > 0 ? parseFloat((this.candidates.reduce((acc, c) => acc + c.confidence, 0) / total).toFixed(2)) : 0;
    
    // Skill distribution counts
    const skillCounts: Record<string, number> = {};
    const missingCounts: Record<string, number> = {};
    const levelCounts: Record<string, number> = {
      'Strong Match': 0,
      'Good Match': 0,
      'Moderate Match': 0,
      'Low Match': 0
    };

    this.candidates.forEach(c => {
      c.skills.forEach(s => {
        skillCounts[s] = (skillCounts[s] || 0) + 1;
      });
      c.missing_skills.forEach(s => {
        missingCounts[s] = (missingCounts[s] || 0) + 1;
      });
      if (levelCounts[c.match_level] !== undefined) {
        levelCounts[c.match_level]++;
      } else {
        levelCounts['Low Match']++;
      }
    });

    const topSkills = Object.entries(skillCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const missingSkills = Object.entries(missingCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const matchDistribution = Object.entries(levelCounts).map(([level, count]) => ({
      level,
      count
    }));

    return {
      total_resumes: total,
      total_candidates: total,
      total_interviews: total + 2,
      shortlisted_candidates: this.candidates.filter(c => c.total_score >= 75).length,
      pending_candidates: this.candidates.filter(c => c.total_score >= 50 && c.total_score < 75).length,
      rejected_candidates: this.candidates.filter(c => c.total_score < 50).length,
      average_score: avgScore,
      average_interview_score: 82,
      average_confidence: avgConf,
      highest_match_score: total > 0 ? Math.max(...this.candidates.map(c => c.total_score)) : 0,
      lowest_match_score: total > 0 ? Math.min(...this.candidates.map(c => c.total_score)) : 0,
      top_skills: topSkills,
      missing_skills_analytics: missingSkills,
      match_level_distribution: matchDistribution,
      status_distribution: [
        { status: "Shortlisted", count: this.candidates.filter(c => c.total_score >= 75).length },
        { status: "Pending", count: this.candidates.filter(c => c.total_score >= 50 && c.total_score < 75).length },
        { status: "Rejected", count: this.candidates.filter(c => c.total_score < 50).length }
      ]
    };
  }

  public getMockAiInsights(): string {
    return `Based on an analysis of ${this.candidates.length} candidates, we have identified a high concentration of React/TypeScript talent, but a consistent skills gap in microservices infrastructure and cloud orchestration frameworks (e.g. Next.js and Kubernetes). 

Key Recommendations:
1. Shortlist Victor Vengatesh immediately (91 ATS score) for Frontend needs.
2. Consider candidate retraining programs focused on container orchestration if internal infrastructure is shifting to Kubernetes.
3. High overall ATS confidence indicates resume parsing is performing at optimal fidelity (90%+ match).`;
  }
}

export const mockStore = new MockStore();
