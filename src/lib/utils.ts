import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a decimal string (from PostgreSQL NUMERIC) without converting
 * through IEEE-754 floating point arithmetic.
 */
export function formatNumericCurrency(
  numericString: string,
  currencyCode = 'USD',
  scale = 2,
): string {
  const trimmed = numericString.trim();
  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const [rawInt = '0', rawFrac = ''] = unsigned.split('.');

  const paddedFrac = rawFrac.padEnd(scale, '0').slice(0, scale);
  const formattedInt = rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const symbolMap: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    SGD: 'S$',
  };

  const prefix = symbolMap[currencyCode] ?? `${currencyCode} `;
  const sign = isNegative ? '-' : '';
  return scale > 0
    ? `${sign}${prefix}${formattedInt}.${paddedFrac}`
    : `${sign}${prefix}${formattedInt}`;
}
