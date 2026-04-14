'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [secretDirty, setSecretDirty] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const callbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/callback` : 'http://localhost:3000/api/auth/callback';
  const { showToast } = useToast();

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setClientId(data.aps_client_id || '');
        setHasSecret(data.has_secret || false);
        setIsConnected(data.is_connected || false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for auth-complete from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our own origin (the OAuth popup we opened).
      // Prevents a malicious page from spoofing an auth-complete event.
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'auth-complete') {
        showToast('Connected to Autodesk!');
        fetch('/api/settings')
          .then((r) => r.json())
          .then((data) => setIsConnected(data.is_connected || false))
          .catch(() => {});
        setConnecting(false);
        window.dispatchEvent(new CustomEvent('formaflow:settings-updated'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showToast]);

  const handleSave = async () => {
    if (!clientId.trim()) {
      showToast('Please enter a Client ID', 'error');
      return;
    }
    if (!hasSecret && !clientSecret.trim()) {
      showToast('Please enter a Client Secret', 'error');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { clientId: clientId.trim() };
      if (clientSecret.trim()) body['clientSecret'] = clientSecret.trim();

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setHasSecret(true);
        setSecretDirty(false);
        setClientSecret('');
        showToast('Credentials saved');
      } else {
        let msg = 'Failed to save';
        try { const body = await res.json(); msg = body.error || msg; } catch { /* non-JSON response */ }
        showToast(msg, 'error');
      }
    } catch {
      showToast('Failed to save credentials', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!hasSecret) {
      showToast('Save credentials first', 'error');
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch('/api/auth/authorize-url');
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.open(url, 'aps-auth', 'width=600,height=700');
    } catch {
      showToast('Failed to start auth flow', 'error');
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-slate-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b-subtle p-6">
        <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
      </div>

      {/* Content Area */}
      <div className="p-8 max-w-3xl space-y-6">
        {/* Credentials Card */}
        <div className="bg-white shadow-sm border border-slate-200">
          {/* Card Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800">Autodesk Integration</h2>
              <Badge variant={isConnected ? 'success' : 'error'}>
                {isConnected ? 'Linked' : 'Disconnected'}
              </Badge>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your APS Client ID"
                className="mt-1.5 w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600/50 focus:border-blue-600/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Client Secret</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretDirty ? clientSecret : ''}
                  onChange={(e) => { setClientSecret(e.target.value); setSecretDirty(true); }}
                  placeholder={hasSecret ? '•••••••••••••••• (saved)' : 'Enter your APS Client Secret'}
                  className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600/50 focus:border-blue-600/50"
                />
                <Button
                  onClick={() => setShowSecret(!showSecret)}
                  variant="default"
                  size="icon"
                  aria-label={showSecret ? 'Hide' : 'Reveal'}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {hasSecret && !secretDirty && (
                <p className="mt-1 text-xs text-slate-500">Secret is saved. Enter a new value to replace it.</p>
              )}
            </div>
          </div>

          {/* Card Footer */}
          <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-4">
            <Button
              onClick={handleSave}
              disabled={saving || !clientId.trim()}
              variant="primary"
              size="sm"
            >
              {saving ? 'Saving...' : 'Save Credentials'}
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connecting || !hasSecret}
              variant="default"
              size="sm"
            >
              {connecting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...</>
              ) : (
                <><ExternalLink className="h-3.5 w-3.5" /> Connect Autodesk Account</>
              )}
            </Button>
          </div>
        </div>

        {/* Callback URL Section */}
        <div className="bg-white shadow-sm border border-slate-200">
          {/* Card Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-800">Callback URL</h2>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                URL <span className="normal-case font-normal text-slate-600">(add this to your APS app)</span>
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={callbackUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-slate-200 text-slate-800"
                />
                <Button
                  onClick={() => { navigator.clipboard.writeText(callbackUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  variant="default"
                  size="icon"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Register this URL at <a href="https://aps.autodesk.com/myapps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 transition-colors">aps.autodesk.com/myapps</a> → your app → Callback URLs
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
