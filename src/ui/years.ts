/** Pure year calculation so cached static HTML stays accurate across New Year boundaries. */
export function calculateYearsSince(foundedYear: string | null, now = new Date()): number | null {
  const parsed = Number.parseInt(String(foundedYear ?? '').trim(), 10);
  const current = now.getFullYear();
  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > current) return null;
  return current - parsed;
}

export function updateYears(root: Document | HTMLElement = document, now = new Date()): void {
  const currentYear = String(now.getFullYear());
  for (const el of root.querySelectorAll<HTMLElement>('[data-year]')) {
    el.textContent = currentYear;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-since]')) {
    const years = calculateYearsSince(el.dataset.since ?? null, now);
    if (years !== null) {
      el.textContent = String(years);
    }
  }
}
