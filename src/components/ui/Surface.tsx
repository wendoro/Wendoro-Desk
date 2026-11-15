import React from 'react';
import { cn } from '@/src/lib/utils';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Single-elevation modern enterprise container with subtle hairline border and crisp surface lift.
 */
export function Surface({
  className,
  padding = 'md',
  interactive = false,
  children,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white border border-stone-200/90 shadow-[0_1px_2px_rgba(24,18,20,0.04)] dark:bg-[#1B1417] dark:border-[#32242A] dark:shadow-none',
        interactive &&
          'transition-all duration-150 hover:border-[#DC2626]/60 hover:shadow-[0_6px_18px_rgba(220,38,38,0.08)] dark:hover:border-[#FACC15]/60',
        paddingMap[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
