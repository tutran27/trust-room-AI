'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Shield,
  ArrowRight,
  Lock,
  Zap,
  Users,
  FileCheck,
  AlertTriangle,
  Bot,
  ChevronRight,
  CheckCircle2,
  Globe,
  Sparkles,
  ArrowUpRight,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const FEATURES = [
  {
    icon: Shield,
    title: 'Solana Escrow',
    description: 'Smart contract-powered escrow with on-chain settlement. Funds are locked until both parties confirm deal completion.',
    color: 'text-accent-cyan',
    bg: 'bg-accent-cyan/10',
    border: 'border-accent-cyan/30',
  },
  {
    icon: Users,
    title: 'Video Meetings',
    description: 'HD video conferences with real-time AI transcription, translation, and sentiment analysis built in.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
  },
  {
    icon: Bot,
    title: 'AI Risk Detection',
    description: 'Continuous monitoring for scam patterns, suspicious behavior, and contract anomalies with instant alerts.',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    border: 'border-accent-purple/30',
  },
  {
    icon: FileCheck,
    title: 'Smart Contracts',
    description: 'AI-extracted key terms from negotiations, auto-generated deal summaries, and structured agreement drafts.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
  },
  {
    icon: AlertTriangle,
    title: 'Dispute Resolution',
    description: 'Evidence-backed dispute system with AI-powered analysis, community voting, and fair resolution workflows.',
    color: 'text-accent-orange',
    bg: 'bg-accent-orange/10',
    border: 'border-accent-orange/30',
  },
  {
    icon: Lock,
    title: 'Wallet Auth',
    description: 'Secure wallet-based authentication. No passwords, no email — just connect your Solana wallet and go.',
    color: 'text-accent-pink',
    bg: 'bg-accent-pink/10',
    border: 'border-accent-pink/30',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Connect Wallet',
    description: 'Sign in with your Solana wallet. Your identity is cryptographically verified — no personal data needed.',
  },
  {
    step: '02',
    title: 'Create or Join Deal',
    description: 'Set deal terms, amount, and counterparties. AI extracts and structures key negotiation points.',
  },
  {
    step: '03',
    title: 'Fund Escrow',
    description: 'Lock funds in a Solana smart contract. Money is held securely until both parties are satisfied.',
  },
  {
    step: '04',
    title: 'Meet & Negotiate',
    description: 'Video call with real-time transcription, AI risk alerts, and smart term extraction.',
  },
  {
    step: '05',
    title: 'Settle & Rate',
    description: 'Confirm completion, release escrow funds on-chain, and rate your counterparty for reputation.',
  },
];

const STATS = [
  { value: '$2.4M+', label: 'Volume Secured' },
  { value: '1,200+', label: 'Deals Completed' },
  { value: '99.8%', label: 'Uptime' },
  { value: '< 2s', label: 'AI Response' },
];

export default function LandingPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-sm shadow-accent-cyan/20">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-dark-50 tracking-tight">
              Trust<span className="text-accent-cyan">Room</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-dark-400 hover:text-dark-100 transition-colors font-medium">Features</a>
            <a href="#how-it-works" className="text-sm text-dark-400 hover:text-dark-100 transition-colors font-medium">How it Works</a>
            <a href="#security" className="text-sm text-dark-400 hover:text-dark-100 transition-colors font-medium">Security</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="shadow-sm shadow-accent-cyan/20">
                Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent-cyan/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-accent-purple/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 mb-8 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="text-xs font-semibold text-accent-cyan tracking-wide uppercase">AI-Powered Deal Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-dark-50 tracking-tight leading-[1.1] max-w-4xl mx-auto animate-slide-up">
            Close deals with{' '}
            <span className="text-gradient">trust</span>,{' '}
            <span className="text-gradient-cool">speed</span>, and{' '}
            <span className="text-gradient-warm">protection</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg md:text-xl text-dark-400 max-w-2xl mx-auto leading-relaxed animate-slide-up stagger-1">
            Solana-powered escrow, AI risk detection, and real-time video meetings — 
            everything you need to negotiate and close deals safely.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex items-center justify-center gap-4 animate-slide-up stagger-2">
            <Link href="/dashboard">
              <Button size="lg" className="shadow-lg shadow-accent-cyan/20 px-8">
                Start Free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="px-8">
                See How it Works
              </Button>
            </a>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto animate-slide-up stagger-3">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-dark-50 tracking-tight">{stat.value}</p>
                <p className="text-xs text-dark-500 mt-1 font-medium uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Preview / Dashboard Mockup */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative rounded-2xl border border-dark-800/50 bg-dark-900/50 shadow-2xl shadow-accent-cyan/5 overflow-hidden backdrop-blur-sm">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-dark-900 border-b border-dark-800/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-dark-700" />
                <div className="w-3 h-3 rounded-full bg-dark-700" />
                <div className="w-3 h-3 rounded-full bg-dark-700" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-dark-800 rounded-lg border border-dark-700/50 px-3 py-1 text-xs text-dark-500 max-w-md mx-auto text-center">
                  app.trustroom.ai/dashboard
                </div>
              </div>
            </div>
            {/* Dashboard mockup content */}
            <div className="p-6 bg-dark-950/50">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Deals', value: '24', color: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20' },
                  { label: 'Active Escrows', value: '8', color: 'bg-accent-green/10 text-accent-green border border-accent-green/20' },
                  { label: 'Volume', value: '$142K', color: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' },
                  { label: 'Disputes', value: '1', color: 'bg-accent-orange/10 text-accent-orange border border-accent-orange/20' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl p-4 ${item.color}`}>
                    <p className="text-xs font-medium opacity-70">{item.label}</p>
                    <p className="text-xl font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-dark-900/50 rounded-xl border border-dark-800/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-dark-100">Recent Deals</p>
                    <span className="text-xs text-accent-cyan font-medium">View All</span>
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-dark-800/30 last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
                        <FileCheck className="w-4 h-4 text-accent-cyan/60" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2.5 bg-dark-700 rounded w-24 mb-1.5" />
                        <div className="h-2 bg-dark-800 rounded w-16" />
                      </div>
                      <div className="h-5 bg-accent-green/10 text-accent-green rounded-full px-2.5 flex items-center border border-accent-green/20">
                        <span className="text-[10px] font-semibold">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-dark-900/50 rounded-xl border border-dark-800/50 p-4">
                  <p className="text-sm font-semibold text-dark-100 mb-3">AI Alerts</p>
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg bg-accent-orange/10 border border-accent-orange/20">
                      <p className="text-[11px] font-medium text-accent-orange">Unusual pattern detected</p>
                      <p className="text-[10px] text-accent-orange/60 mt-0.5">Deal #1284</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-accent-green/10 border border-accent-green/20">
                      <p className="text-[11px] font-medium text-accent-green">Terms verified</p>
                      <p className="text-[10px] text-accent-green/60 mt-0.5">Deal #1280</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                      <p className="text-[11px] font-medium text-accent-blue">Meeting summary ready</p>
                      <p className="text-[10px] text-accent-blue/60 mt-0.5">Meeting #89</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-accent-cyan uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold text-dark-50 tracking-tight">
              Everything you need to close deals safely
            </h2>
            <p className="mt-4 text-dark-400 max-w-2xl mx-auto">
              From negotiation to settlement, TrustRoom AI provides the tools, intelligence, 
              and security infrastructure for modern deal-making.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 cursor-default ${
                  hoveredFeature === i
                    ? `${feature.border} ${feature.bg} shadow-lg`
                    : 'border-dark-800/50 bg-dark-900/30 hover:shadow-md hover:shadow-accent-cyan/5'
                }`}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-base font-semibold text-dark-50 mb-2">{feature.title}</h3>
                <p className="text-sm text-dark-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-dark-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-accent-cyan uppercase tracking-widest mb-3">How it Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-dark-50 tracking-tight">
              Five steps to a trusted deal
            </h2>
            <p className="mt-4 text-dark-400 max-w-xl mx-auto">
              From wallet connection to final settlement — every step is secured and intelligent.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Vertical line */}
            <div className="absolute left-[23px] top-0 bottom-0 w-px bg-dark-700 hidden md:block" />

            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <div key={step.step} className="relative flex gap-6 items-start group">
                  {/* Step number */}
                  <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl bg-dark-900 border-2 border-dark-700 group-hover:border-accent-cyan/50 group-hover:bg-accent-cyan/10 flex items-center justify-center transition-all duration-300 shadow-sm">
                    <span className="text-sm font-bold text-dark-500 group-hover:text-accent-cyan transition-colors">{step.step}</span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <h3 className="text-lg font-semibold text-dark-50 mb-1">{step.title}</h3>
                    <p className="text-sm text-dark-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative rounded-3xl bg-gradient-to-br from-dark-900 to-dark-950 p-12 md:p-16 overflow-hidden border border-dark-800/50">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-purple/5 rounded-full blur-3xl" />
            
            <div className="relative grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 mb-6">
                  <Lock className="w-3 h-3 text-accent-cyan" />
                  <span className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">Security First</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-dark-50 tracking-tight leading-tight">
                  Your funds are protected by Solana smart contracts
                </h2>
                <p className="mt-4 text-dark-400 leading-relaxed">
                  Escrow funds are locked on-chain in audited smart contracts. 
                  No central authority can access or move your money without 
                  cryptographic proof of deal completion from both parties.
                </p>
                <div className="mt-8 space-y-3">
                  {[
                    'Multi-signature release mechanism',
                    'On-chain transaction history',
                    'AI-powered fraud detection',
                    'Encrypted meeting transcripts',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-accent-green flex-shrink-0" />
                      <span className="text-sm text-dark-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl border border-dark-700/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-accent-green" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dark-50">Escrow #4821</p>
                      <p className="text-xs text-dark-500">Secured on Solana</p>
                    </div>
                    <div className="ml-auto">
                      <span className="px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green text-xs font-semibold border border-accent-green/20">
                        Funded
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">Amount</span>
                      <span className="text-dark-50 font-semibold">$25,000.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">Contract</span>
                      <span className="text-accent-cyan font-mono text-xs">7xKX...9mN2</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">Status</span>
                      <span className="text-accent-orange font-semibold">Awaiting Confirmation</span>
                    </div>
                    <div className="h-px bg-dark-700/50" />
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">Buyer Verified</span>
                      <CheckCircle2 className="w-4 h-4 text-accent-green" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">Seller Verified</span>
                      <CheckCircle2 className="w-4 h-4 text-accent-green" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-dark-50 tracking-tight">
            Ready to close deals with confidence?
          </h2>
          <p className="mt-4 text-dark-400 text-lg">
            Connect your wallet and start your first deal in under a minute.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="shadow-lg shadow-accent-cyan/20 px-8">
                Launch App <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-dark-500">
            No account needed · Free to start · Powered by Solana
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800/50 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-dark-50">
                Trust<span className="text-accent-cyan">Room</span>
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Features</a>
              <a href="#how-it-works" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">How it Works</a>
              <a href="#security" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Security</a>
            </div>
            <p className="text-xs text-dark-600">
              © 2026 TrustRoom AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}