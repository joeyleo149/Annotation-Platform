import React, { useEffect, useState } from 'react';
import { fetchProfile, updateProfile, getCurrentUser } from '../services/authService';
import { COUNTRIES } from '../data/countries';

export default function ProfilePage() {
  const user = getCurrentUser();
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Form states
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [nationality, setNationality] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setUsername(data.username);
        setEmail(data.email);
        setGender(data.gender);
        setNationality(data.nationality);
        if (data.dateOfBirth) {
          setDateOfBirth(data.dateOfBirth);
        }
      })
      .catch(() => setError('Failed to pull user credentials.')) // Changed from (err) to ()
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    const payload: any = { username, email };
    if (password.trim()) payload.password = password;

    if (user?.role === 'Annotator') {
      payload.gender = gender;
      payload.nationality = nationality;
      payload.dateOfBirth = dateOfBirth;
    }

    try {
      const res = await updateProfile(payload);
      setMessage(res.message || 'Profile saved successfully.');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to modify account settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <p className="p-8 text-slate-500 font-medium">Loading profile context...</p>;

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <header className="mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Account Identity</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Manage Profile Settings</h1>
          <p className="text-xs text-slate-500 mt-1">Update your system profile records and security authentication rules.</p>
        </header>

        {message && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl">✓ {message}</div>}
        {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-xl">✕ {error}</div>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password (leave blank to keep unchanged)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" />
          </div>

          {user?.role === 'Annotator' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nationality</label>
                <select value={nationality} onChange={e => setNationality(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600">
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Date of Birth</label>
                <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600" required />
              </div>
            </>
          )}

          <button type="submit" disabled={isSaving} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-50 mt-2">
            {isSaving ? 'Saving Changes...' : 'Update Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}