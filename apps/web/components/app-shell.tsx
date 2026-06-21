'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Badge, Button } from '@trustroom/ui';
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
  const { address, walletKind, logout, status, connect } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100">
      <header className="border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-300">
              TrustRoom AI
            </Link>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Demo-ready escrow workspace
            </p>
          </div>
          <nav className="hidden gap-2 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    active ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {status === 'authenticated' && address ? (
              <>
                <Badge variant={walletKind === 'demo' ? 'warning' : 'info'}>
                  {walletKind === 'demo' ? 'Demo wallet' : 'Phantom'}
                </Badge>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
                  <Avatar size="sm" address={address} showLabel={false} />
                  <span className="text-sm text-slate-200">{shortAddress(address, 5, 5)}</span>
                </div>
                <Button variant="ghost" onClick={logout}>
                  Đăng xuất
                </Button>
              </>
            ) : (
              <Button onClick={() => connect('demo')}>Bắt đầu demo</Button>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-7xl px-6 py-8 ${contentClassName ?? ''}`}>
        <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-300">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
