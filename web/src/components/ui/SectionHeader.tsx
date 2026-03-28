import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
          {description && <div className="mt-1 text-sm leading-relaxed text-stone-600">{description}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}
