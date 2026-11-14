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
    'bg-[#4169F5] text-white hover:bg-[#3257DB] border border-transparent shadow-xs',
  secondary:
    'bg-[#101B35] text-white hover:bg-[#1A294D] dark:bg-slate-100 dark:text-[#101B35] dark:hover:bg-white border border-transparent',
  outline:
    'bg-white text-[#182238] border border-slate-200 hover:bg-slate-50 dark:bg-[#101B35] dark:text-slate-100 dark:border-[#223257] dark:hover:bg-[#162342]',
  ghost:
    'bg-transparent text-[#182238] hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#162342] border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 border border-transparent',
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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169F5] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0B1224]',
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
