/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'CHF', locale: string = 'de-CH'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(dateString: string, locale: string = 'en-GB'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date and time
 */
export function formatDateTime(dateString: string, locale: string = 'en-GB'): string {
  return new Date(dateString).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate price with tax
 */
export function calculatePriceWithTax(basePrice: number, taxRate: number): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = basePrice;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  
  return {
    subtotal,
    taxAmount,
    total,
  };
}

/**
 * Format pricing unit for display
 */
export function formatPricingUnit(unit: string): string {
  return unit
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
