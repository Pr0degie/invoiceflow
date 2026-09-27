import { formatDuration, secondsToQuantity } from "./format.ts";
import type { Worklog } from "./worklogs.ts";

export interface PositionInput { issueIds: number[]; description: string; unitPrice: number }
export interface ExcludeInput { issueIds: number[]; reason: string }
export interface LineItemDraft {
  description: string;
  quantity: number;
  unit: "h";
  unitPrice: number;
  displayMode: "AsEntered";
  seconds: number;
}

export class ValidationError extends Error {
  override name = "ValidationError";
}

/** Strips a trailing " (3 h 41 min)" / " (45 min)" / " (2 h)" / " (< 1 min)" duration suffix. */
const DURATION_SUFFIX_RE = /\s*\((?:< 1 min|(?:\d+ h)?\s*(?:\d+ min)?)\)\s*$/;

/**
 * Turns the period's worklogs into one hourly line item per position.
 * Every issue with logged time must be claimed exactly once — by a position
 * or by `exclude` — so no logged time is silently dropped or billed twice.
 */
export function buildLineItems(worklogs: Worklog[], positions: PositionInput[], exclude: ExcludeInput[] = []): LineItemDraft[] {
  if (positions.length === 0) throw new ValidationError("At least one position is required.");

  const claimed = new Set<number>();
  const doubles = new Set<number>();
  for (const id of [...positions.flatMap((p) => p.issueIds), ...exclude.flatMap((e) => e.issueIds)]) {
    if (claimed.has(id)) doubles.add(id);
    claimed.add(id);
  }

  const secondsByIssue = new Map<number, number>();
  for (const w of worklogs) secondsByIssue.set(w.issueId, (secondsByIssue.get(w.issueId) ?? 0) + w.seconds);

  const problems: string[] = [];
  if (doubles.size > 0) problems.push(`Issue ids assigned more than once: ${[...doubles].sort((a, b) => a - b).join(", ")}`);
  const unassigned = [...secondsByIssue.keys()].filter((id) => !claimed.has(id)).sort((a, b) => a - b);
  if (unassigned.length > 0) problems.push(`Issue ids with logged time in the period but in no position or exclude: ${unassigned.join(", ")}`);

  const items = positions.map((p, i): LineItemDraft => {
    const description = p.description.trim().replace(DURATION_SUFFIX_RE, "");
    const seconds = p.issueIds.reduce((sum, id) => sum + (secondsByIssue.get(id) ?? 0), 0);
    const quantity = secondsToQuantity(seconds);
    if (seconds === 0) problems.push(`Position ${i + 1} ("${description}") has no logged time in the period`);
    else if (quantity === 0) problems.push(`Position ${i + 1} ("${description}") has only ${seconds} s — below 0.01 h; merge it into another position`);
    return { description: `${description} (${formatDuration(seconds)})`, quantity, unit: "h", unitPrice: p.unitPrice, displayMode: "AsEntered", seconds };
  });

  if (problems.length > 0) throw new ValidationError(problems.join("\n"));
  return items;
}
