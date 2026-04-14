'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FolderOpen, Activity, Settings, Menu, X } from 'lucide-react';

const navItems = [
  { label: 'Projects', href: '/projects', icon: FolderOpen },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [tokenHealthy, setTokenHealthy] = useState<boolean | null>(null); // null = checking
  const [healthReason, setHealthReason] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Load basic settings (fast, from config.json)
  useEffect(() => {
    const loadSettings = () => {
      fetch('/api/settings')
        .then((r) => { if (!r.ok) throw new Error(`Settings: ${r.status}`); return r.json(); })
        .then((data) => {
          setIsConnected(data.is_connected || false);
          setUserName(data.name || '');
          setUserEmail(data.email || '');
        })
        .catch((err) => console.error('Failed to load settings:', err));
    };
    loadSettings();
    const onSettingsUpdated = () => { loadSettings(); checkHealth(); setBannerDismissed(false); };
    window.addEventListener('formaflow:settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('formaflow:settings-updated', onSettingsUpdated);
  }, []);

  // Validate token health on startup (one real APS call)
  const checkHealth = () => {
    setTokenHealthy(null);
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data: { status: string; reason?: string; email?: string; name?: string }) => {
        const healthy = data.status === 'connected';
        setTokenHealthy(healthy);
        setHealthReason(data.reason || '');
        if (healthy) {
          setIsConnected(true);
          if (data.email) setUserEmail(data.email);
          if (data.name) setUserName(data.name);
        }
      })
      .catch(() => {
        setTokenHealthy(false);
        setHealthReason('Health check failed');
      });
  };

  useEffect(() => { checkHealth(); }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex h-screen bg-white overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-56 border-r-subtle flex flex-col bg-slate-50 transform transition-transform duration-200 md:relative md:translate-x-0 shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5">
          <Link href="/projects" className="block mb-5 pb-4 border-b-subtle">
            <span className="text-lg tracking-[0.15em] font-medium text-blue-800 flex items-center gap-2">
              FORMA <span className="text-blue-600 font-bold">FLOW</span>
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                  tokenHealthy === null
                    ? 'bg-slate-300 animate-pulse'
                    : tokenHealthy
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                }`}
                title={
                  tokenHealthy === null
                    ? 'Checking connection...'
                    : tokenHealthy
                      ? 'Connected to Autodesk'
                      : `Disconnected: ${healthReason}`
                }
              />
            </span>
          </Link>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-sm transition-all relative
                      ${active ? 'sidebar-item-active text-blue-700' : 'text-slate-500 hover:text-blue-600'}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-auto px-5 py-4 border-t-subtle">
          {/* Connection status */}
          <div className="space-y-2">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 relative z-10 shrink-0">
                  {userName?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate font-medium">{userName || 'Connected'}</p>
                  {userEmail && <p className="text-xs text-slate-500 truncate">{userEmail}</p>}
                </div>
              </div>
            ) : (
              <Link href="/settings" className="text-sm text-red-600 hover:text-red-700 transition-colors">
                Not connected, Set up in Settings
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="md:hidden border-b-subtle px-4 py-2 bg-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-slate-500 hover:text-blue-600"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto bg-white">
          {tokenHealthy === false && !bannerDismissed && pathname !== '/settings' && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between">
              <p className="text-sm text-red-700">
                <span className="font-medium">Connection issue:</span>{' '}
                {healthReason || 'Token expired or invalid.'}{' '}
                Scheduled tasks will fail until reconnected.{' '}
                <Link href="/settings" className="underline font-medium hover:text-red-800">
                  Fix in Settings
                </Link>
              </p>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-red-400 hover:text-red-600 ml-4 shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
