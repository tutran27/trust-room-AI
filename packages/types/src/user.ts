import { z } from 'zod';

/**
 * Minimal user representation. Users are identified solely by their
 * Solana wallet address — no email/password auth.
 */
export const userSchema = z.object({
  id: z.string(),
  wallet: z.string().min(32),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;

/**
 * Wallet connection payload sent from the frontend after
 * the user signs the challenge nonce.
 */
export const walletConnectSchema = z.object({
  wallet: z.string().min(32),
  signature: z.string(),
});

export type WalletConnect = z.infer<typeof walletConnectSchema>;
