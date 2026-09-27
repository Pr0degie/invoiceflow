import { addDays, DATE_RE, isoWeekStart, secondsToQuantity } from "./format.ts";

export interface Worklog { id: number; issueId: number; date: string; seconds: number; description: string }
export interface IssueTotal { issueId: number; seconds: number; hours: number; worklogCount: number; firstDate: string; lastDate: string }
export interface DayTotal { date: string; seconds: number }
export interface WeekTotal { weekStart: string; seconds: number; hours: number; overCap: boolean; extendsOutsidePeriod: boolean }
export interface WorklogSummary {
  period: { from: string; to: string };
  worklogs: Worklog[];
  byIssue: IssueTotal[];
  byDay: DayTotal[];
  byWeek: WeekTotal[];
  totalSeconds: number;
}

export class PeriodError extends Error {
  override name = "PeriodError";
}

function assertCalendarDate(date: string): void {
  if (addDays(date, 0) !== date) throw new PeriodError(`"${date}" is not a valid calendar date.`);
}

export function assertPeriod(from: string, to: string): void {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new PeriodError(`Dates must be YYYY-MM-DD (got "${from}", "${to}").`);
  assertCalendarDate(from);
  assertCalendarDate(to);
  if (from > to) throw new PeriodError(`"from" (${from}) is after "to" (${to}).`);
}

/** The whole ISO weeks (Mon–Sun) a period touches — used for the weekly cap. */
export function weekRange(from: string, to: string): { from: string; to: string } {
  return { from: isoWeekStart(from), to: addDays(isoWeekStart(to), 6) };
}

export function summarize(all: Worklog[], from: string, to: string, weeklyCapHours?: number): WorklogSummary {
  const worklogs = all
    .filter((w) => w.date >= from && w.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const issues = new Map<number, IssueTotal>();
  const days = new Map<string, number>();
  for (const w of worklogs) {
    const t = issues.get(w.issueId);
    if (t) {
      t.seconds += w.seconds;
      t.worklogCount += 1;
      t.lastDate = w.date;
    } else {
      issues.set(w.issueId, { issueId: w.issueId, seconds: w.seconds, hours: 0, worklogCount: 1, firstDate: w.date, lastDate: w.date });
    }
    days.set(w.date, (days.get(w.date) ?? 0) + w.seconds);
  }

  const range = weekRange(from, to);
  const weeks = new Map<string, number>();
  for (const w of all) {
    if (w.date < range.from || w.date > range.to) continue;
    const start = isoWeekStart(w.date);
    weeks.set(start, (weeks.get(start) ?? 0) + w.seconds);
  }

  return {
    period: { from, to },
    worklogs,
    byIssue: [...issues.values()]
      .map((t) => ({ ...t, hours: secondsToQuantity(t.seconds) }))
      .sort((a, b) => a.issueId - b.issueId),
    byDay: [...days.entries()].map(([date, seconds]) => ({ date, seconds })).sort((a, b) => a.date.localeCompare(b.date)),
    byWeek: [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, seconds]) => ({
        weekStart,
        seconds,
        hours: secondsToQuantity(seconds),
        overCap: weeklyCapHours !== undefined && seconds > weeklyCapHours * 3600,
        extendsOutsidePeriod: weekStart < from || addDays(weekStart, 6) > to,
      })),
    totalSeconds: worklogs.reduce((sum, w) => sum + w.seconds, 0),
  };
}
