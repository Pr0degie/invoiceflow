export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hours with 0.01 h precision (36 s) — spec §4.4. */
export function secondsToQuantity(seconds: number): number {
  return Math.round(seconds / 36) / 100;
}

/** "3 h 41 min", "45 min", "2 h", "< 1 min" — rounded to the nearest minute. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (seconds > 0 && totalMinutes === 0) return "< 1 min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** YYYY-MM-DD ± n days, computed in UTC so DST never shifts the date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `date`. */
export function isoWeekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** "<number|Entwurf>_<recipient>_<from>_<to>.pdf", safe on Windows. */
export function pdfFileName(number: string | null | undefined, recipient: string, from: string, to: string): string {
  const safe = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "");
  return `${safe(number ?? "Entwurf")}_${safe(recipient)}_${from}_${to}.pdf`;
}
