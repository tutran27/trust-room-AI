import Link from 'next/link';
import { Button } from '@trustroom/ui';

const PILLARS = [
  {
    number: '01',
    title: 'Realtime Scam Guard',
    body: 'AI watches the negotiation live and warns you before a dangerous action — early-release, off-platform moves, fake proof, credential requests.',
  },
  {
    number: '02',
    title: 'AI Deal Notary',
    body: 'Turns the conversation into structured, signable deal terms so both sides confirm exactly what was agreed.',
  },
  {
    number: '03',
    title: 'Solana Escrow',
    body: 'Buyer funds are locked on-chain until delivery conditions are met. AI never moves funds — only you do.',
  },
  {
    number: '04',
    title: 'Evidence Vault',
    body: 'Transcript, warnings, terms, proof, and transaction hashes are preserved — privately off-chain, integrity-anchored on-chain.',
  },
];

const USE_CASES = ['NFT', 'OTC token', 'Freelance service', 'Domain', 'Digital goods', 'Marketplace trust layer'];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create a Deal',
    body: 'Set the terms, amount, and deadline. Invite your counterparty with a single wallet address.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Negotiate with AI Watch',
    body: 'Jump on a voice/video call. AI monitors the conversation for scam patterns and flags risks in realtime.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Release or Dispute',
    body: 'Confirm delivery, release funds on-chain, or open a dispute with tamper-evident evidence.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <main className="relative mx-auto max-w-6xl px-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute top-60 right-0 h-[400px] w-[400px] rounded-full bg-sky-100/40 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-indigo-50/50 blur-3xl" />
      </div>

      {/* ─── Hero ─── */}
      <section className="relative pt-28 pb-16 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/80">
          AI-supervised escrow room
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tighter sm:text-5xl lg:text-6xl text-slate-900 max-w-4xl mx-auto">
          Secure high-risk P2P deals with{' '}
          <span className="text-gradient">AI-supervised negotiation</span> and Solana escrow.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500">
          TrustRoom AI combines realtime fraud monitoring, structured deal confirmation, on-chain
          escrow, and tamper-evident evidence — so you can trade with strangers safely.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg">Mở dashboard</Button>
          </Link>
          <Link href="/deals/new">
            <Button variant="secondary" size="lg">Tạo deal mới</Button>
          </Link>
        </div>
      </section>

      {/* ─── Dashboard mockup card ─── */}
      <section className="relative -mx-2 sm:mx-0 mb-16">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs text-slate-400 font-medium">trustroom.ai — Dashboard</span>
          </div>
          <div className="grid grid-cols-3 gap-3 p-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="h-2 w-16 rounded bg-slate-200 mb-3" />
              <div className="h-6 w-20 rounded bg-indigo-100" />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="h-2 w-16 rounded bg-slate-200 mb-3" />
              <div className="h-6 w-20 rounded bg-amber-100" />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="h-2 w-16 rounded bg-slate-200 mb-3" />
              <div className="h-6 w-20 rounded bg-sky-100" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats / Trust bar ─── */}
      <section className="mb-24">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-8 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-900">0</p>
            <p className="mt-1 text-xs text-slate-500">scams blocked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-900">0 SOL</p>
            <p className="mt-1 text-xs text-slate-500">in escrow</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-900">0</p>
            <p className="mt-1 text-xs text-slate-500">deals completed</p>
          </div>
        </div>
      </section>

      {/* ─── 4 Pillars ─── */}
      <section className="mb-24">
        <h2 className="mb-2 text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          Four pillars
        </h2>
        <p className="mb-10 text-center text-sm text-slate-500">
          How TrustRoom AI protects every transaction
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
            >
              <span className="text-xs font-medium text-indigo-500/60">{p.number}</span>
              <h2 className="mt-2 text-base font-semibold text-slate-900">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="mb-24">
        <h2 className="mb-2 text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          How it works
        </h2>
        <p className="mb-10 text-center text-sm text-slate-500">
          Three steps to a safer deal
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="relative rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {step.icon}
              </div>
              <span className="text-xs font-medium text-indigo-500/60">{step.step}</span>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Use Cases ─── */}
      <section className="mb-24 text-center">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Built for</h3>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {USE_CASES.map((u) => (
            <span
              key={u}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              {u}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="mb-24">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50/80 to-white px-8 py-14 text-center shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ready to make your first deal?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
            Create a deal, invite your counterparty, and let AI watch your back — all in one secure room.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg">Mở dashboard</Button>
            </Link>
            <Link href="/deals/new">
              <Button variant="secondary" size="lg">Tạo deal mới</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        TrustRoom AI &mdash; AI-supervised escrow on Solana. Not financial advice. Use at your own risk.
      </footer>
    </main>
  );
}
