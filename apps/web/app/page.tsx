'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Shield,
  ArrowRight,
  Lock,
  Users,
  FileCheck,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Plus,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    title: 'Solana Escrow',
    description: 'Smart contract-powered escrow with on-chain settlement. Funds locked until both parties confirm.',
  },
  {
    icon: Users,
    title: 'Video Meetings',
    description: 'HD video with real-time AI transcription, translation, and sentiment analysis built in.',
  },
  {
    icon: Bot,
    title: 'AI Risk Detection',
    description: 'Continuous monitoring for scam patterns, suspicious behavior, and contract anomalies.',
  },
  {
    icon: FileCheck,
    title: 'Smart Contracts',
    description: 'AI-extracted key terms from negotiations, auto-generated deal summaries and agreement drafts.',
  },
  {
    icon: AlertTriangle,
    title: 'Dispute Resolution',
    description: 'Evidence-backed dispute system with AI analysis, community voting, and fair resolution.',
  },
  {
    icon: Lock,
    title: 'Wallet Auth',
    description: 'Secure wallet-based authentication. No passwords — just connect your Solana wallet.',
  },
];

const STEPS = [
  { title: 'Connect Wallet', description: 'Sign in with your Solana wallet. Cryptographically verified — no personal data needed.' },
  { title: 'Create Deal', description: 'Set terms, amount, and counterparties. AI structures key negotiation points automatically.' },
  { title: 'Fund Escrow', description: 'Lock funds in a Solana smart contract. Held securely until both parties are satisfied.' },
  { title: 'Meet & Negotiate', description: 'Video call with live transcription, AI risk alerts, and smart term extraction.' },
  { title: 'Settle', description: 'Confirm completion, release funds on-chain, and rate your counterparty.' },
];

const STATS = [
  { value: '$2.4M+', label: 'Volume Secured' },
  { value: '1,200+', label: 'Deals Closed' },
  { value: '99.8%', label: 'Uptime' },
  { value: '< 2s', label: 'AI Response' },
];

// Teal từ dashboard: #0891b2 / #0e7490 range (cyan-600/700)
const TEAL = '#0891b2';
const TEAL_DARK = '#0e7490';

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <div
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
      className="min-h-screen bg-white text-[#111827]"
    >

      {/* ─── Navigation ─────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo — match dashboard exactly */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
            >
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="leading-none">
              <span className="text-[14px] font-bold text-gray-900 tracking-tight">TrustRoom</span>
              <span className="block text-[9px] font-semibold tracking-widest uppercase text-cyan-600" style={{ marginTop: 1 }}>AI Escrow</span>
            </div>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-7">
            {['Features', 'How it Works', 'Security'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                className="text-[13px] text-gray-400 hover:text-gray-700 transition-colors font-medium"
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <button className="text-[13px] text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium">
                Sign In
              </button>
            </Link>
            <Link href="/dashboard">
              <button
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Deal
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="pt-36 pb-24 max-w-6xl mx-auto px-6">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 block" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold">
            AI-Powered Deal Platform · Solana
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-[clamp(2.4rem,5.5vw,4.5rem)] font-extrabold leading-[1.06] text-gray-900 max-w-3xl"
          style={{ letterSpacing: '-0.03em' }}
        >
          Close deals with{' '}
          <span style={{ color: TEAL }}>trust</span>
          <br />and protection.
        </h1>

        {/* Divider */}
        <div className="mt-9 mb-8 w-full h-px bg-gray-100" />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <p className="text-[15px] text-gray-500 max-w-md leading-[1.75]">
            Solana-powered escrow, AI risk detection, and real-time video meetings —
            everything you need to negotiate and close deals safely.
          </p>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/dashboard">
              <button
                className="flex items-center gap-2 text-[13px] font-semibold text-white px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
              >
                Launch App
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
            <a href="#how-it-works">
              <button className="text-[13px] font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-5 py-2.5 rounded-xl transition-colors">
                How it works
              </button>
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
          {STATS.map((stat) => (
            <div key={stat.label} className="px-7 py-5 bg-white">
              <p
                className="text-2xl font-bold text-gray-900"
                style={{ letterSpacing: '-0.02em' }}
              >
                {stat.value}
              </p>
              <p className="text-[11px] uppercase tracking-[0.1em] text-gray-400 mt-1 font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Hero Banner (mirror dashboard's teal gradient) ─ */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div
          className="rounded-2xl px-10 py-12 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)` }}
        >
          {/* subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'200\' height=\'200\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }} />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-cyan-200 text-[12px] font-semibold uppercase tracking-widest mb-2">
                Powered by Solana
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Your funds are always<br />secured on-chain.
              </h2>
              <p className="mt-3 text-cyan-100/70 text-[14px] max-w-md leading-relaxed">
                Audited smart contracts hold escrow funds with zero central authority.
                Cryptographic proof required from both parties to release.
              </p>
            </div>
            <Link href="/dashboard" className="flex-shrink-0">
              <button className="flex items-center gap-2 text-[13px] font-semibold bg-white text-cyan-700 px-5 py-2.5 rounded-xl hover:bg-cyan-50 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                New Deal
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────── */}
      <section id="features" className="py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2">
              Features
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ letterSpacing: '-0.025em' }}
            >
              Everything you need to close deals safely
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl border border-gray-100 bg-white hover:border-cyan-200 hover:shadow-sm transition-all cursor-default"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center mb-4 group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-colors">
                  <feature.icon className="w-4 h-4 text-gray-400 group-hover:text-cyan-600 transition-colors" />
                </div>
                <h3 className="text-[14px] font-semibold text-gray-800 mb-1.5">{feature.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2">
            How it Works
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-12"
            style={{ letterSpacing: '-0.025em' }}
          >
            Five steps to a trusted deal
          </h2>

          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                onMouseEnter={() => setActiveStep(i)}
                onMouseLeave={() => setActiveStep(null)}
                className={`flex items-start gap-5 px-7 py-5 cursor-default transition-colors ${
                  activeStep === i ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <span
                  className="text-[11px] font-mono font-bold mt-0.5 flex-shrink-0 w-5"
                  style={{ color: activeStep === i ? TEAL : '#d1d5db' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold text-gray-800 mb-0.5">{step.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{step.description}</p>
                </div>
                <ArrowRight
                  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-all duration-200"
                  style={{ color: activeStep === i ? TEAL : '#e5e7eb', transform: activeStep === i ? 'translateX(2px)' : 'none' }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Security ───────────────────────────────────── */}
      <section id="security" className="py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2">
                Security
              </p>
              <h2
                className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-4"
                style={{ letterSpacing: '-0.025em' }}
              >
                Your funds protected by
                <br />Solana smart contracts
              </h2>
              <p className="text-[14px] text-gray-500 leading-[1.75] mb-7">
                Escrow funds are locked on-chain in audited smart contracts.
                No central authority can move your money without cryptographic
                proof of deal completion from both parties.
              </p>
              <ul className="space-y-3">
                {[
                  'Multi-signature release mechanism',
                  'On-chain transaction history',
                  'AI-powered fraud detection',
                  'Encrypted meeting transcripts',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} />
                    <span className="text-[13px] text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — Escrow card matching dashboard card style */}
            <div className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0891b2, #0e7490)' }}>
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">Escrow #4821</p>
                    <p className="text-[11px] text-gray-400">Secured on Solana</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                  Funded
                </span>
              </div>

              <div className="space-y-3.5">
                {[
                  { label: 'Amount', value: '$25,000.00', type: 'normal' },
                  { label: 'Contract', value: '7xKX...9mN2', type: 'mono' },
                  { label: 'Status', value: 'Awaiting Confirmation', type: 'warning' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[12px] text-gray-400">{row.label}</span>
                    <span
                      className={`text-[12px] font-medium ${
                        row.type === 'warning' ? 'text-amber-500' :
                        row.type === 'mono' ? 'font-mono text-cyan-600' :
                        'text-gray-800'
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}

                <div className="h-px bg-gray-100 my-1" />

                {['Buyer Verified', 'Seller Verified'].map((label) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[12px] text-gray-400">{label}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div
            className="rounded-2xl px-10 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
            style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)' }}
          >
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Ready to close deals with confidence?
              </h2>
              <p className="text-[14px] text-cyan-100/70 mt-2">
                Connect your wallet and start your first deal in under a minute.
              </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <Link href="/dashboard">
                <button className="flex items-center gap-2 text-[13px] font-semibold bg-white text-cyan-700 px-5 py-2.5 rounded-xl hover:bg-cyan-50 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  New Deal
                </button>
              </Link>
              <span className="text-[11px] text-cyan-200/60">No account needed · Free to start</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
            >
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="text-[12px] font-bold text-gray-700">TrustRoom</span>
          </div>

          <div className="flex items-center gap-6">
            {['Features', 'How it Works', 'Security'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          <p className="text-[11px] text-gray-300">© 2026 TrustRoom AI</p>
        </div>
      </footer>
    </div>
  );
}