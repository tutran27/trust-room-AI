'use client';

import { shortAddress } from '@/lib/wallet';

interface AvatarProps {
  address?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

function hashAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

const AVATAR_COLORS = [
  'from-violet-400 to-purple-500',
  'from-sky-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-blue-500',
  'from-fuchsia-400 to-purple-500',
  'from-lime-400 to-green-500',
];

export function Avatar({ address, size = 'md', className = '' }: AvatarProps) {
  if (!address) {
    return (
      <div className={`${sizeMap[size]} rounded-full bg-dark-700 flex items-center justify-center font-semibold text-dark-400 ring-2 ring-dark-800 ${className}`}>
        ?
      </div>
    );
  }

  const colorIndex = hashAddress(address) % AVATAR_COLORS.length;
  const initials = shortAddress(address, 2, 0).toUpperCase();

  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIndex]} flex items-center justify-center font-bold text-white ring-2 ring-dark-800 shadow-sm ${className}`}
      title={address}
    >
      {initials}
    </div>
  );
}