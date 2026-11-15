import React from 'react';
import { cn } from '@/src/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#DC2626] text-white hover:bg-[#B91C1C] border border-transparent shadow-xs',
  secondary:
    'bg-[#FACC15] text-[#1C1917] hover:bg-[#EAB308] border border-amber-400/60 font-semibold shadow-xs',
  outline:
    'bg-white text-[#1C1917] border border-stone-200 hover:bg-stone-50 dark:bg-[#1B1417] dark:text-stone-100 dark:border-[#32242A] dark:hover:bg-[#251B20]',
  ghost:
    'bg-transparent text-[#1C1917] hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#251B20] border border-transparent',
  danger:
    'bg-red-700 text-white hover:bg-red-800 border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#141013]',
          'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
