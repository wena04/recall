import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'violet' | 'amber' | 'emerald' | 'stone';

const TONE_CLASS: Record<BadgeTone, string> = {
  violet: 'bg-violet-100 text-violet-800 ring-violet-200',
  amber: 'bg-amber-100 text-amber-900 ring-amber-200',
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  stone: 'bg-stone-100 text-stone-700 ring-stone-200',
};

interface StatusBadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export default function StatusBadge({ tone = 'stone', children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
