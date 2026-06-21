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

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <section className="text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/80">
          AI-supervised escrow room
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tighter sm:text-5xl lg:text-6xl">
          Secure high-risk P2P deals with{' '}
          <span className="text-gradient">AI-supervised negotiation</span> and Solana escrow.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400">
          TrustRoom AI combines realtime fraud monitoring, structured deal confirmation, on-chain
          escrow, and tamper-evident evidence — so you can trade with strangers safely.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/dashboard">
            <Button>Mở dashboard</Button>
          </Link>
          <Link href="/deals/new">
            <Button variant="secondary">Tạo deal</Button>
          </Link>
          <Link href="/disputes">
            <Button variant="ghost">Xem disputes</Button>
          </Link>
        </div>
      </section>

      <section className="mt-28 grid gap-4 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1]"
          >
            <span className="text-xs font-medium text-emerald-500/60">{p.number}</span>
            <h2 className="mt-2 text-base font-semibold text-zinc-100">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-20 text-center">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Built for</h3>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {USE_CASES.map((u) => (
            <span
              key={u}
              className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              {u}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
