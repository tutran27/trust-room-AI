import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrustRoom AI — AI-supervised escrow for P2P deals',
  description:
    'Negotiate high-risk P2P deals over voice/video with realtime AI fraud monitoring, Solana escrow, and tamper-evident evidence.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
