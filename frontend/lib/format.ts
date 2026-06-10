/** Format INR for display (Cr / Lakh). */
export function formatInr(amount: number): string {
  if (amount >= 10_000_000) {
    const cr = amount / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (amount >= 100_000) {
    const lakh = amount / 100_000;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} L`;
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatInrRange(min: number, max: number): string {
  if (min === max) return formatInr(min);
  return `${formatInr(min)} – ${formatInr(max)}`;
}
