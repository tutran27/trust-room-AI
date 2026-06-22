'use client';

import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

interface RiskIndicatorProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const config = {
  low: {
    icon: ShieldCheck,
    label: 'Low Risk',
    bg: 'bg-accent-emerald/10',
    border: 'border-accent-emerald/20',
    text: 'text-accent-emerald',
    iconColor: 'text-accent-emerald',
    ring: 'ring-accent-emerald/10',
  },
  medium: {
    icon: Shield,
    label: 'Medium Risk',
    bg: 'bg-accent-amber/10',
    border: 'border-accent-amber/20',
    text: 'text-accent-amber',
    iconColor: 'text-accent-amber',
    ring: 'ring-accent-amber/10',
  },
  high: {
    icon: ShieldAlert,
    label: 'High Risk',
    bg: 'bg-accent-rose/10',
    border: 'border-accent-rose/20',
    text: 'text-accent-rose',
    iconColor: 'text-accent-rose',
    ring: 'ring-accent-rose/10',
  },
  critical: {
    icon: ShieldX,
    label: 'Critical',
    bg: 'bg-accent-rose/20',
    border: 'border-accent-rose/30',
    text: 'text-accent-rose',
    iconColor: 'text-accent-rose',
    ring: 'ring-accent-rose/20',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1.5',
  md: 'px-3 py-1.5 text-sm gap-2',
  lg: 'px-4 py-2.5 text-base gap-2.5',
};

const iconSizes = {
  sm: 12,
  md: 16,
  lg: 20,
};

export function RiskIndicator({
  level,
  label,
  showIcon = true,
  size = 'md',
  className = '',
}: RiskIndicatorProps) {
  const c = config[level];
  const Icon = c.icon;
  const displayLabel = label || c.label;

  return (
    <div
      className={`inline-flex items-center font-medium rounded-full border ring-1 ${c.ring} ${c.bg} ${c.border} ${c.text} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Icon size={iconSizes[size]} className={c.iconColor} />}
      <span>{displayLabel}</span>
    </div>
  );
}