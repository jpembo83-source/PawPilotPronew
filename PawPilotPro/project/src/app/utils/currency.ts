/**
 * Currency Utility
 * Provides centralized currency formatting based on organization settings
 */

import { useSettingsStore } from '../modules/settings/store';

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  JPY: '¥',
  CHF: 'CHF',
  SGD: 'S$',
  AED: 'د.إ',
};

// Currency decimal places (some currencies don't use decimals)
const CURRENCY_DECIMALS: Record<string, number> = {
  GBP: 2,
  USD: 2,
  EUR: 2,
  AUD: 2,
  CAD: 2,
  NZD: 2,
  JPY: 0, // Yen doesn't use decimals
  CHF: 2,
  SGD: 2,
  AED: 2,
};

/**
 * Format a number as currency using organization settings
 * @param amount - The amount to format
 * @param currencyCode - Optional currency code override (defaults to organization currency)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currencyCode?: string): string {
  // Get currency from organization settings if not provided
  const currency = currencyCode || useSettingsStore.getState().organisation.currency || 'GBP';
  
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  
  // Format the number with appropriate decimals
  const formatted = amount.toFixed(decimals);
  
  // Add thousand separators
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Return formatted string with symbol
  return `${symbol}${parts.join('.')}`;
}

/**
 * Get the currency symbol for the organization
 * @param currencyCode - Optional currency code override
 * @returns Currency symbol
 */
export function getCurrencySymbol(currencyCode?: string): string {
  const currency = currencyCode || useSettingsStore.getState().organisation.currency || 'GBP';
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Get the number of decimal places for a currency
 * @param currencyCode - Optional currency code override
 * @returns Number of decimal places
 */
export function getCurrencyDecimals(currencyCode?: string): number {
  const currency = currencyCode || useSettingsStore.getState().organisation.currency || 'GBP';
  return CURRENCY_DECIMALS[currency] ?? 2;
}

/**
 * React hook to get currency formatting functions with reactive updates
 */
export function useCurrency() {
  const { organisation } = useSettingsStore();
  const currency = organisation.currency || 'GBP';
  
  return {
    currency,
    symbol: CURRENCY_SYMBOLS[currency] || currency,
    decimals: CURRENCY_DECIMALS[currency] ?? 2,
    format: (amount: number) => formatCurrency(amount, currency),
  };
}
