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
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-base font-semibold tracking-tight text-emerald-400">
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
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
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
                  className="hidden items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06] cursor-pointer sm:flex"
                >
                  <Avatar size="sm" address={address} showLabel={false} />
                  <span className="text-sm text-zinc-300">
                    {shortAddress(address, 5, 5)}
                  </span>
                  {copied ? (
                    <span className="text-xs text-emerald-400">✓</span>
                  ) : (
                    <span className="text-xs text-zinc-500">copy</span>
                  )}
                </button>
                <Button variant="ghost" onClick={logout} className="text-zinc-400">
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
        <div className="mb-8 flex flex-col gap-4 border-b border-white/[0.06] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
