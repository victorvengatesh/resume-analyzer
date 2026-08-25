import { useRef, type MouseEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  ChevronRight,
  FileText,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

function TiltPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    panel.style.setProperty('--tilt-x', `${(0.5 - y) * 8}deg`);
    panel.style.setProperty('--tilt-y', `${(x - 0.5) * 10}deg`);
    panel.style.setProperty('--glow-x', `${x * 100}%`);
    panel.style.setProperty('--glow-y', `${y * 100}%`);
  };

  const reset = () => {
    panelRef.current?.style.setProperty('--tilt-x', '0deg');
    panelRef.current?.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <div
      ref={panelRef}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={`ats-tilt-panel ${className}`}
    >
      {children}
    </div>
  );
}

const signals = [
  { label: 'Semantic fit', score: 94 },
  { label: 'Technical depth', score: 89 },
  { label: 'Business impact', score: 84 },
];

const productPrinciples = [
  {
    index: '01',
    icon: Brain,
    title: 'Semantic, not superficial',
    copy: 'Transferable experience is weighted by relevance and evidence—not keyword repetition.',
  },
  {
    index: '02',
    icon: BarChart3,
    title: 'Every score is explainable',
    copy: 'Recruiters can trace each conclusion to the resume evidence that produced it.',
  },
  {
    index: '03',
    icon: Zap,
    title: 'Feedback you can use',
    copy: 'Specific technical changes replace vague advice and improve the next revision.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <div className="ats-landing">
      <div className="ats-aurora ats-aurora-violet" />
      <div className="ats-aurora ats-aurora-cyan" />
      <div className="ats-noise" />

      <header className="ats-nav liquid-glass">
        <button className="ats-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="ats-brand-mark"><Sparkles className="h-4 w-4" /></span>
          <span>Talent<span>AI</span></span>
        </button>

        <div className="ats-engine-status">
          <i />
          Semantic engine online
        </div>

        <div className="ats-nav-actions">
          <button className="ats-sign-in" onClick={() => navigate('/auth')}>Sign in</button>
          <Button
            size="sm"
            iconRight={<ChevronRight className="h-4 w-4" />}
            onClick={() => navigate('/auth?demo=true')}
          >
            Open workspace
          </Button>
        </div>
      </header>

      <main>
        <section className="ats-hero">
          <motion.div
            className="ats-hero-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ats-eyebrow"><Sparkles className="h-3.5 w-3.5" /> Evidence-first candidate intelligence</div>
            <h1>See the candidate<br /><span>beyond the keywords.</span></h1>
            <p>
              Resume analysis that understands transferable experience, measures business impact,
              and shows recruiters the evidence behind every score.
            </p>
            <div className="ats-hero-actions">
              <button className="ats-primary-cta" onClick={() => navigate('/auth?demo=true')}>
                Analyze a resume <ArrowRight className="h-4 w-4" />
              </button>
              <span><ShieldCheck className="h-4 w-4" /> Private by design</span>
            </div>
            <div className="ats-proof-row">
              <span><Check className="h-3.5 w-3.5" /> Semantic alignment</span>
              <span><Check className="h-3.5 w-3.5" /> Impact analysis</span>
              <span><Check className="h-3.5 w-3.5" /> Three exact actions</span>
            </div>
          </motion.div>

          <motion.div
            className="ats-visual-stage"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ats-orbit ats-orbit-one" />
            <div className="ats-orbit ats-orbit-two" />
            <TiltPanel className="ats-score-card liquid-glass">
              <div className="ats-specular" />
              <div className="ats-score-head">
                <div>
                  <span>Candidate signal</span>
                  <h2>Frontend Architect</h2>
                </div>
                <b><Check className="h-3 w-3" /> Evidence checked</b>
              </div>

              <div className="ats-score-main">
                <div className="ats-score-ring">
                  <strong>91</strong>
                  <span>/100</span>
                </div>
                <div>
                  <i>Strong match</i>
                  <p>High-confidence alignment across architecture, delivery impact, and technical leadership.</p>
                </div>
              </div>

              <div className="ats-signal-list">
                {signals.map((signal, index) => (
                  <div className="ats-signal" key={signal.label}>
                    <div><span>{signal.label}</span><b>{signal.score}%</b></div>
                    <i><motion.em
                      initial={reduceMotion ? { width: `${signal.score}%` } : { width: 0 }}
                      animate={{ width: `${signal.score}%` }}
                      transition={{ duration: 1, delay: 0.55 + index * 0.12 }}
                    /></i>
                  </div>
                ))}
              </div>

              <div className="ats-insight-preview">
                <span><Sparkles className="h-3.5 w-3.5" /> AI recommendation</span>
                <p><b>Add the performance baseline.</b> State the initial load time, final load time, measurement tool, and traffic window.</p>
              </div>
            </TiltPanel>

            <motion.div
              className="ats-float-chip ats-chip-one liquid-glass"
              animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Zap className="h-3.5 w-3.5" /><span><b>12.4s</b> analysis</span>
            </motion.div>
            <motion.div
              className="ats-float-chip ats-chip-two liquid-glass"
              animate={reduceMotion ? undefined : { y: [0, 9, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FileText className="h-3.5 w-3.5" /><span><b>8</b> evidence links</span>
            </motion.div>
          </motion.div>
        </section>

        <section className="ats-principles">
          {productPrinciples.map(({ index, icon: Icon, title, copy }) => (
            <motion.article
              key={index}
              whileHover={reduceMotion ? undefined : { y: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <div><span>{index}</span><Icon className="h-4 w-4" /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </section>
      </main>

      <footer className="ats-footer">
        <div className="ats-brand"><span className="ats-brand-mark"><Sparkles className="h-3.5 w-3.5" /></span><span>Talent<span>AI</span></span></div>
        <p>Human judgment, sharpened by evidence.</p>
        <span>© 2026 TalentAI</span>
      </footer>
    </div>
  );
}
