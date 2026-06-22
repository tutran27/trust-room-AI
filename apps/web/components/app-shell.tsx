'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Button } from '@trustroom/ui';
import { useAuth } from '../providers/auth-provider';
import { shortAddress } from '../lib/wallet';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/deals/new', label: 'Tạo deal' },
  { href: '/disputes', label: 'Disputes' },
];

export function AppShell({
  title,
  subtitle,
  actions,
  contentClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { address, logout, status, connect } = useAuth();
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-base font-semibold tracking-tight text-indigo-600">
              TrustRoom AI
            </Link>
            <nav className="hidden gap-1 md:flex">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {status === 'authenticated' && address ? (
              <>
                <button
                  onClick={copyAddress}
                  title={copied ? 'Đã copy!' : `Copy full address: ${address}`}
                  className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-colors duration-150 hover:bg-slate-50 cursor-pointer sm:flex"
                >
                  <Avatar size="sm" address={address} showLabel={false} />
                  <span className="text-sm text-slate-700">
                    {shortAddress(address, 5, 5)}
                  </span>
                  {copied ? (
                    <span className="text-xs text-indigo-600">✓</span>
                  ) : (
                    <span className="text-xs text-slate-400">copy</span>
                  )}
                </button>
                <Button variant="ghost" onClick={logout} className="text-slate-500">
                  Đăng xuất
                </Button>
              </>
            ) : (
              <Button onClick={() => connect('phantom')}>Kết nối Phantom</Button>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-7xl px-6 py-8 ${contentClassName ?? ''}`}>
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
