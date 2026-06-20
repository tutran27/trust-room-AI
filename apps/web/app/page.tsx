import { Button } from '@trustroom/ui';

const PILLARS = [
  {
    title: 'Realtime Scam Guard',
    body: 'AI watches the negotiation live and warns you before a dangerous action — early-release, off-platform moves, fake proof, credential requests.',
  },
  {
    title: 'AI Deal Notary',
    body: 'Turns the conversation into structured, signable deal terms so both sides confirm exactly what was agreed.',
  },
  {
    title: 'Solana Escrow',
    body: 'Buyer funds are locked on-chain until delivery conditions are met. AI never moves funds — only you do.',
  },
  {
    title: 'Evidence Vault',
    body: 'Transcript, warnings, terms, proof, and transaction hashes are preserved — privately off-chain, integrity-anchored on-chain.',
  },
];

const USE_CASES = ['NFT', 'OTC token', 'Freelance service', 'Domain', 'Digital goods', 'Marketplace trust layer'];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-400">
          AI-supervised escrow room
        </p>
        <h1 className="text-balance text-4xl font-bold sm:text-5xl">
          Secure high-risk P2P deals with AI-supervised negotiation and Solana escrow.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          TrustRoom AI combines realtime fraud monitoring, structured deal confirmation, on-chain
          escrow, and tamper-evident evidence — so you can trade with strangers safely.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button>Start a Deal</Button>
          <Button variant="secondary">Join a Deal</Button>
          <Button variant="ghost">View Demo</Button>
        </div>
      </section>

      <section className="mt-20 grid gap-5 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-emerald-300">{p.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 text-center">
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400">Built for</h3>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {USE_CASES.map((u) => (
            <span
              key={u}
              className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300"
            >
              {u}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
