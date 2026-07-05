import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { login, register } from '../api';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto trigger demo login if requested from URL
  useEffect(() => {
    if (searchParams.get('demo') === 'true') {
      triggerDemoLogin();
    }
  }, [searchParams]);

  const triggerDemoLogin = async () => {
    setLoading(true);
    setEmail('demo@smartresume.ai');
    setPassword('demo123');
    try {
      // Small visual delay to show filling
      await new Promise(r => setTimeout(r, 600));
      await login('demo@smartresume.ai', 'demo123');
      success('Welcome to Sandbox', 'Logged in successfully under demo recruiter mode.');
      navigate('/');
    } catch (err: any) {
      error('Authentication Failed', err.message || 'Could not verify demo session.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      error('Input Validation', 'Please fill in all standard credentials fields.');
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'login') {
        await login(email, password);
        success('Success', 'Authenticated successfully.');
        navigate('/');
      } else {
        await register(email, password);
        success('Registered', 'Account created! Logging you in now...');
        await login(email, password);
        navigate('/');
      }
    } catch (err: any) {
      error('Authentication Error', err.message || 'Credentials invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg-base overflow-hidden flex items-center justify-center p-6">
      {/* Background Gradients */}
      <div className="ambient-glow ambient-glow-1" />
      <div className="ambient-glow ambient-glow-2" />
      <div className="grid-overlay" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-900/50 mb-3">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">TalentAI Workspace</h1>
          <p className="text-xs text-slate-500 mt-1">Autonomous candidate analysis operating system</p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="glass-panel rounded-2xl p-6 relative overflow-hidden"
        >
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-glass-border mb-6">
            <button
              onClick={() => setActiveTab('login')}
              className={`py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'login'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'register'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Recruiter Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              icon={<Mail className="w-4 h-4" />}
              disabled={loading}
              required
            />

            <Input
              label="Security Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              icon={<Lock className="w-4 h-4" />}
              disabled={loading}
              required
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              iconRight={<ArrowRight className="w-4 h-4" />}
              className="mt-6"
            >
              {activeTab === 'login' ? 'Sign In' : 'Create Recruiter Profile'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-x-0 h-px bg-glass-border" />
            <span className="relative px-3 text-[10px] text-slate-500 bg-[#0e0e15] font-bold uppercase tracking-wider">
              Or Sandbox Mode
            </span>
          </div>

          {/* Try Demo Button */}
          <Button
            variant="outline"
            fullWidth
            onClick={triggerDemoLogin}
            disabled={loading}
            icon={<UserCheck className="w-4 h-4 text-accent-cyan" />}
            className="hover:border-accent-cyan/60 hover:text-cyan-300 transition-colors shadow-sm"
          >
            Access Sandbox (Try Demo)
          </Button>

          {/* Helper credentials display */}
          <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-900 text-[10px] text-slate-500 text-center">
            <span>demo credentials: </span>
            <span className="text-slate-400 font-semibold">demo@smartresume.ai</span>
            <span> / </span>
            <span className="text-slate-400 font-semibold">demo123</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
