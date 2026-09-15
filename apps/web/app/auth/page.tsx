'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('aca_user');
    if (raw) {
      try {
        setUserEmail(JSON.parse(raw).email);
      } catch {
        /* ignore */
      }
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res =
        mode === 'register'
          ? await api.register(email, password, displayName || undefined)
          : await api.login(email, password);
      localStorage.setItem('aca_token', res.accessToken);
      localStorage.setItem('aca_user', JSON.stringify(res.user));
      setUserEmail(res.user.email);
      setMessage(mode === 'register' ? 'Account created.' : 'Signed in.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function signOut() {
    localStorage.removeItem('aca_token');
    localStorage.removeItem('aca_user');
    setUserEmail(null);
    setMessage('Signed out.');
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Save watchlists & chat history.</h1>
      </header>
      <div className="panel" style={{ marginTop: '1.25rem', maxWidth: 460 }}>
        {userEmail ? (
          <>
            <p>
              Signed in as <strong>{userEmail}</strong>
            </p>
            <button className="btn secondary" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="cta-row" style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className={`chip ${mode === 'register' ? 'active' : ''}`}
                onClick={() => setMode('register')}
              >
                Register
              </button>
              <button
                type="button"
                className={`chip ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                Login
              </button>
            </div>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="name">Display name</label>
                <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn">{mode === 'register' ? 'Create account' : 'Sign in'}</button>
          </form>
        )}
        {message && <p className="muted">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
