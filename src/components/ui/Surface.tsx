import React from 'react';
import { cn } from '@/src/lib/utils';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Single-elevation enterprise container with 1px hairline border.
 * Avoids nested cards-within-cards and thick left accent borders.
 */
export function Surface({
  className,
  padding = 'md',
  children,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white border border-slate-200 dark:bg-[#101B35] dark:border-[#223257]',
        paddingMap[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
