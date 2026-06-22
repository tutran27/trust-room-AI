'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, FileText, AlertTriangle, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Deals', href: '/deals', icon: FileText },
  { name: 'Disputes', href: '/disputes', icon: AlertTriangle },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { address, status, logout, connect } = useAuth();
  const isConnected = status === 'authenticated';
  const shortAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '—';

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-surface-300 text-surface-600 hover:text-brand-600 hover:border-brand-300 transition-colors shadow-sm"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-surface-200 z-40 transform transition-transform duration-200 ease-in-out flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-surface-200">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 tracking-tight">TrustRoom</h1>
              <p className="text-[10px] font-mono text-brand-600 uppercase tracking-widest">AI Escrow</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                    : 'text-surface-600 hover:text-surface-800 hover:bg-surface-50 border border-transparent'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-surface-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-surface-200">
          {isConnected && address ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
                  {address[2]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-700 truncate">
                    Wallet
                  </p>
                  <button
                    onClick={() => {
                      if (address) {
                        navigator.clipboard.writeText(address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="text-xs text-surface-500 font-mono truncate hover:text-brand-600 transition-colors flex items-center gap-1"
                    title="Click to copy address"
                  >
                    {shortAddress}
                    {copied ? (
                      <span className="text-success-600 text-[10px]">Copied!</span>
                    ) : (
                      <span className="text-surface-400 text-[10px]">copy</span>
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <p className="text-xs text-surface-400 text-center px-3">Not connected</p>
          )}
        </div>
      </aside>
    </>
  );
}
