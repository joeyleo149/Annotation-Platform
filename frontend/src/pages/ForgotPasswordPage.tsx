import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AuthLayout, Field } from './LoginPage';
import { requestPasswordReset, resetPassword } from '../services/authService';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function sendCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message); setStep('reset');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the reset code.');
    } finally { setBusy(false); }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (newPassword !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await resetPassword(email, otp, newPassword);
      navigate('/login', { replace: true, state: { message: result.message } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset the password.');
    } finally { setBusy(false); }
  }

  return <AuthLayout>
    <div className="auth-icon" aria-hidden="true"><KeyRound /></div>
    <h1>Reset password</h1>
    <p className="auth-subtitle">{step === 'email' ? 'Enter your account email to receive a reset code.' : 'Enter the six-digit code and your new password.'}</p>
    <div className="auth-divider" />
    {step === 'email' ? <form onSubmit={sendCode} className="auth-form">
      <Field label="Email"><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Enter your email" autoComplete="email" required /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
    </form> : <form onSubmit={submitReset} className="auth-form">
      <Field label="Email"><input type="email" value={email} readOnly /></Field>
      <Field label="Reset code"><input value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required /></Field>
      <Field label="New password"><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="Enter a strong password" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></Field>
      <Field label="Confirm password"><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Enter the password again" required /></Field>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
      <button type="button" className="text-sm font-semibold text-blue-600" onClick={() => { setStep('email'); setOtp(''); setMessage(''); setError(''); }}>Request another code</button>
    </form>}
    <p className="mt-5 text-center text-sm"><Link to="/login" className="font-semibold text-blue-600">Back to login</Link></p>
  </AuthLayout>;
}
