import type { ElementType, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BentoCardProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
}

export default function BentoCard({ as: Component = 'div', className, ...props }: BentoCardProps) {
  return (
    <Component
      className={cn(
        'rounded-2xl border border-violet-100/80 bg-white/95 p-5 shadow-sm shadow-violet-100/50 backdrop-blur-sm',
        className
      )}
      {...props}
    />
  );
}
