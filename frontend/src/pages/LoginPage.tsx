import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { login, homeFor } from '../services/authService';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const user = await login(username, password); navigate(homeFor(user.role), { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to log in.'); }
    finally { setBusy(false); }
  }

  return <AuthLayout>
    <div className="auth-icon" aria-hidden="true"><UserPlus /></div>
    <h1>Welcome Back</h1><p className="auth-subtitle">Log in to continue annotating videos.</p>
    <div className="auth-divider" />
    {typeof location.state?.message === 'string' ? <p className="text-sm text-emerald-700">{location.state.message}</p> : null}
    <form onSubmit={submit} className="auth-form">
      <Field label="Username"><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" required /></Field>
      <Field label="Password"><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></Field>
      <div className="text-right"><Link to="/forgot-password" className="text-sm font-semibold text-blue-600">Forgot password?</Link></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
    </form>
    <AuthSwitch text="Don’t have an account?" link="Register" to="/register" />
  </AuthLayout>;
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><header className="public-header"><Link to="/login" className="brand"><span className="brand-mark">▷</span>Annotate Pro</Link><span className="brand-separator" /><span className="tagline">Smart Video Annotation Platform</span></header><section className="auth-stage"><div className="auth-card">{children}</div></section></main>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="auth-field"><span>{label}</span>{children}</label>; }
export function AuthSwitch({ text, link, to }: { text: string; link: string; to: string }) { return <div className="auth-switch"><span>or</span><p>{text} <Link to={to}>{link}</Link></p></div>; }
