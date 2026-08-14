import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { logout, register } from '../services/authService';
import { AuthLayout, AuthSwitch, Field } from './LoginPage';
import { UserPlus } from 'lucide-react';
import { COUNTRIES } from '../data/countries';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', gender: '', nationality: '', dateOfBirth: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(v => ({ ...v, [key]: event.target.value }));
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setBusy(true); try { await register(form); logout(); navigate('/login', { replace: true, state: { registered: true } }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to register.'); } finally { setBusy(false); } }
  return <AuthLayout><div className="auth-icon" aria-hidden="true"><UserPlus /></div><h1>Create Your Account</h1><p className="auth-subtitle">Join Annotate Pro and start annotating videos<br />with ease.</p><div className="auth-divider" />
    <form onSubmit={submit} className="auth-form compact">
      <Field label="Username"><input value={form.username} onChange={set('username')} placeholder="Enter your username" minLength={3} required /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={set('email')} placeholder="Enter your email" required /></Field>
      <Field label="Password"><input type="password" value={form.password} onChange={set('password')} placeholder="Enter your password" minLength={8} required /></Field>
      <Field label="Gender"><select value={form.gender} onChange={set('gender')} required><option value="">Select your gender</option><option>Male</option><option>Female</option></select></Field>
      <Field label="Nationality"><select value={form.nationality} onChange={set('nationality')} required><option value="">Select your nationality</option>{COUNTRIES.map(country => <option key={country} value={country}>{country}</option>)}</select></Field>
      <Field label="Date of Birth"><input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} required /></Field>
      {error ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
    </form><AuthSwitch text="Already have an account?" link="Sign in" to="/login" /></AuthLayout>;
}
