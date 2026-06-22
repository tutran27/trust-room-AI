'use client';

import { Card } from './Card';

interface SkeletonProps {
  className?: string;
  count?: number;
  variant?: 'text' | 'heading' | 'card' | 'stat' | 'avatar' | 'badge' | 'button' | 'image';
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const roundedClasses = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({ className = '', count = 1, variant = 'text', rounded = 'md' }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return items.map((i) => (
      <Card key={i} padding="md" className={`animate-pulse ${className}`}>
        <div className="space-y-3">
          <div className="h-4 bg-dark-700 rounded-md w-1/3" />
          <div className="h-8 bg-dark-700 rounded-md w-1/2" />
          <div className="h-3 bg-dark-700 rounded-md w-2/3" />
        </div>
      </Card>
    ));
  }

  if (variant === 'stat') {
    return items.map((i) => (
      <Card key={i} padding="md" className={`animate-pulse ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="h-3 bg-dark-700 rounded-md w-24" />
            <div className="h-7 bg-dark-700 rounded-md w-16" />
            <div className="h-3 bg-dark-700 rounded-md w-32" />
          </div>
          <div className="w-10 h-10 bg-dark-700 rounded-xl" />
        </div>
      </Card>
    ));
  }

  if (variant === 'avatar') {
    return items.map((i) => (
      <div
        key={i}
        className={`w-10 h-10 bg-dark-700 animate-pulse ${roundedClasses.full} ${className}`}
      />
    ));
  }

  if (variant === 'badge') {
    return items.map((i) => (
      <div
        key={i}
        className={`h-5 bg-dark-700 animate-pulse ${roundedClasses.full} w-16 ${className}`}
      />
    ));
  }

  if (variant === 'button') {
    return items.map((i) => (
      <div
        key={i}
        className={`h-9 bg-dark-700 animate-pulse ${roundedClasses.lg} w-24 ${className}`}
      />
    ));
  }

  if (variant === 'heading') {
    return items.map((i) => (
      <div
        key={i}
        className={`h-6 bg-dark-700 animate-pulse ${roundedClasses[rounded]} w-48 ${className}`}
      />
    ));
  }

  if (variant === 'image') {
    return items.map((i) => (
      <div
        key={i}
        className={`w-full h-48 bg-dark-700 animate-pulse ${roundedClasses.lg} ${className}`}
      />
    ));
  }

  return items.map((i) => (
    <div
      key={i}
      className={`h-4 bg-dark-700 animate-pulse ${roundedClasses[rounded]} ${className}`}
    />
  ));
}