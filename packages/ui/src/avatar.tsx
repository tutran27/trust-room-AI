import * as React from 'react';
import { cn } from './cn.js';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

/** Deterministic HSL color block derived from the address string. */
function colorFor(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 40%)`;
}

/** Truncate a wallet address to `head…tail`. */
function truncate(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Wallet address used for both the color block and the truncated label. */
  address: string;
  size?: AvatarSize;
  /** When false, only the color block is rendered (no address text). */
  showLabel?: boolean;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, address, size = 'md', showLabel = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('inline-flex items-center gap-2', className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white/90 ring-1 ring-white/10',
          SIZES[size],
        )}
        style={{ backgroundColor: colorFor(address) }}
      >
        {address.slice(0, 2).toUpperCase()}
      </span>
      {showLabel ? (
        <span className="font-mono text-xs text-zinc-400" title={address}>
          {truncate(address)}
        </span>
      ) : null}
    </div>
  ),
);
Avatar.displayName = 'Avatar';
