'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, isLoggedIn } from '@/lib/api';

type Settings = Awaited<ReturnType<typeof api.settings>>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!isLoggedIn()) {
      setError('Sign in on Account to edit settings.');
      setSettings(null);
      return;
    }
    try {
      setSettings(await api.settings());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateSettings({
        displayName: settings.displayName,
        defaultTimeframe: settings.defaultTimeframe,
        riskTolerance: settings.riskTolerance,
        emailAlerts: settings.emailAlerts,
        signalStyle: settings.signalStyle,
        currency: settings.currency,
      });
      setSettings(updated);
      setMessage('Settings saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Settings</div>
        <h1>Tune the desk.</h1>
      </header>

      {error && (
        <p className="error">
          {error} {!isLoggedIn() && <Link href="/auth">Account →</Link>}
        </p>
      )}
      {message && <p className="muted">{message}</p>}

      {settings && (
        <form className="panel" style={{ marginTop: '1.1rem', maxWidth: 520 }} onSubmit={onSave}>
          <div className="field">
            <label htmlFor="dn">Display name</label>
            <input
              id="dn"
              value={settings.displayName || ''}
              onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="tf">Default timeframe</label>
            <input
              id="tf"
              value={settings.defaultTimeframe}
              onChange={(e) => setSettings({ ...settings, defaultTimeframe: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Risk tolerance</label>
            <div className="cta-row">
              {(['low', 'medium', 'high'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`chip ${settings.riskTolerance === r ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, riskTolerance: r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Signal style</label>
            <div className="cta-row">
              {(['conservative', 'balanced', 'aggressive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${settings.signalStyle === s ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, signalStyle: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="ccy">Currency</label>
            <input
              id="ccy"
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            />
          </div>
          <label className="muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.emailAlerts}
              onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
            />
            Email alerts (preference only in MVP)
          </label>
          <div style={{ marginTop: '1rem' }}>
            <button className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
