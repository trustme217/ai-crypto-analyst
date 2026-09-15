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
  const [testing, setTesting] = useState(false);
  const [recentChats, setRecentChats] = useState<Array<{ chatId: string; name: string }>>([]);

  async function load() {
    if (!isLoggedIn()) {
      setError('Sign in on Account to edit settings.');
      setSettings(null);
      return;
    }
    try {
      const s = await api.settings();
      setSettings({
        ...s,
        telegramAlerts: s.telegramAlerts ?? true,
        telegramChatId: s.telegramChatId ?? null,
      });
      setError(null);
      try {
        const chats = await api.telegramChats();
        setRecentChats(chats.chats || []);
      } catch {
        setRecentChats([]);
      }
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
      const updated = (await api.updateSettings({
        displayName: settings.displayName,
        defaultTimeframe: settings.defaultTimeframe,
        riskTolerance: settings.riskTolerance,
        emailAlerts: settings.emailAlerts,
        telegramAlerts: settings.telegramAlerts,
        telegramChatId: settings.telegramChatId,
        signalStyle: settings.signalStyle,
        currency: settings.currency,
      })) as Settings;
      setSettings(updated);
      setMessage('Settings saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onTestTelegram() {
    if (!settings) return;
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      // Persist chat ID from the form before sending (avoids testing a stale/empty saved value)
      if (settings.telegramChatId?.trim()) {
        await api.updateSettings({
          telegramChatId: settings.telegramChatId.trim(),
          telegramAlerts: settings.telegramAlerts,
        });
      }
      await api.testTelegram(settings.telegramChatId?.trim() || undefined);
      setMessage('Test message sent to Telegram. Check your chat with the bot.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
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
            <select
              id="ccy"
              value={
                [
                  'USD',
                  'EUR',
                  'GBP',
                  'JPY',
                  'KRW',
                  'CNY',
                  'HKD',
                  'SGD',
                  'AUD',
                  'CAD',
                  'CHF',
                  'INR',
                  'BRL',
                  'TRY',
                  'AED',
                  'BTC',
                  'ETH',
                ].includes(settings.currency)
                  ? settings.currency
                  : 'USD'
              }
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            >
              {[
                { code: 'USD', label: 'USD — US Dollar' },
                { code: 'EUR', label: 'EUR — Euro' },
                { code: 'GBP', label: 'GBP — British Pound' },
                { code: 'JPY', label: 'JPY — Japanese Yen' },
                { code: 'KRW', label: 'KRW — Korean Won' },
                { code: 'CNY', label: 'CNY — Chinese Yuan' },
                { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
                { code: 'SGD', label: 'SGD — Singapore Dollar' },
                { code: 'AUD', label: 'AUD — Australian Dollar' },
                { code: 'CAD', label: 'CAD — Canadian Dollar' },
                { code: 'CHF', label: 'CHF — Swiss Franc' },
                { code: 'INR', label: 'INR — Indian Rupee' },
                { code: 'BRL', label: 'BRL — Brazilian Real' },
                { code: 'TRY', label: 'TRY — Turkish Lira' },
                { code: 'AED', label: 'AED — UAE Dirham' },
                { code: 'BTC', label: 'BTC — Bitcoin' },
                { code: 'ETH', label: 'ETH — Ethereum' },
              ].map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <h3 className="panel-title" style={{ marginTop: '1.25rem' }}>
            Telegram alerts
          </h3>
          <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            {!settings.telegramBotConfigured &&
              'Add TELEGRAM_BOT_TOKEN to the root .env (wrap in quotes) and restart the API.'}
            {settings.telegramBotConfigured && settings.telegramBotOk === false && (
              <span className="error">
                Bot token is set but Telegram rejected it (invalid/revoked). Create a new token in
                BotFather, update .env, restart API.
              </span>
            )}
            {settings.telegramBotConfigured && settings.telegramBotOk !== false && (
              <>
                Bot connected
                {settings.telegramBotUsername ? ` (@${settings.telegramBotUsername})` : ''}. Open it
                in Telegram → Start → paste your numeric chat ID below → Send test.
              </>
            )}
          </p>
          <label className="muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={Boolean(settings.telegramAlerts)}
              onChange={(e) => setSettings({ ...settings, telegramAlerts: e.target.checked })}
            />
            Send price alerts to Telegram
          </label>
          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label htmlFor="tg">Telegram chat ID</label>
            <input
              id="tg"
              value={settings.telegramChatId || ''}
              onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
              placeholder="e.g. 123456789"
            />
          </div>
          {recentChats.length > 0 && (
            <div className="cta-row" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {recentChats.map((c) => (
                <button
                  key={c.chatId}
                  type="button"
                  className="chip"
                  onClick={() => setSettings({ ...settings, telegramChatId: c.chatId })}
                  title={c.name}
                >
                  {c.name || c.chatId}
                </button>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            Message your bot once in Telegram, then click a discovered chat above (or paste the numeric
            chat ID).
          </p>
          <div className="cta-row">
            <button className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={
                testing ||
                !settings.telegramBotConfigured ||
                settings.telegramBotOk === false ||
                !settings.telegramChatId?.trim()
              }
              onClick={onTestTelegram}
            >
              {testing ? 'Sending…' : 'Send test to Telegram'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
