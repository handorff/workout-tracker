export interface GymGoal {
  startDay: string;
  timeZone: string;
  changes: { startDay: string; weekly: number }[];
}

const DAY = 86_400_000;
export const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY);
export const addDays = (day: string, count: number) => new Date((dayNumber(day) + count) * DAY).toISOString().slice(0, 10);
export function localDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export const validWeekly = (value: number) => Number.isFinite(value) && value >= 0.5 && value <= 7 && Number.isInteger(value * 2);
export function readGoal(value: unknown): GymGoal | null {
  if (!value || typeof value !== "object") return null;
  const goal = value as GymGoal;
  const validDay = (day: unknown): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(dayNumber(day)) && addDays(day, 0) === day;
  try {
    if (!validDay(goal.startDay) || typeof goal.timeZone !== "string") return null;
    localDay(new Date(), goal.timeZone);
    if (!Array.isArray(goal.changes) || !goal.changes.length || goal.changes[0].startDay !== goal.startDay) return null;
    if (!goal.changes.every((change, index) => change && validDay(change.startDay) && validWeekly(change.weekly) &&
      (dayNumber(change.startDay) - dayNumber(goal.startDay)) % 14 === 0 &&
      (index === 0 || change.startDay > goal.changes[index - 1].startDay))) return null;
    return goal;
  } catch { return null; }
}
export function periodFor(goal: GymGoal, day: string) {
  const index = Math.floor((dayNumber(day) - dayNumber(goal.startDay)) / 14);
  const start = addDays(goal.startDay, index * 14);
  const end = addDays(start, 14);
  const weekly = [...goal.changes].reverse().find((change) => change.startDay <= start)?.weekly ?? goal.changes[0].weekly;
  return { start, end, weekly, target: weekly * 2 };
}
export function changeGoal(goal: GymGoal, today: string, weekly: number): GymGoal {
  if (!validWeekly(weekly)) throw new Error("Choose 0.5 to 7 visits per week, in steps of 0.5.");
  const effective = periodFor(goal, today).end;
  return { ...goal, changes: [...goal.changes.filter((change) => change.startDay < effective), { startDay: effective, weekly }] };
}
export function visitDays(timestamps: string[], timeZone: string): Set<string> {
  return new Set(timestamps.map((timestamp) => localDay(new Date(timestamp), timeZone)));
}
export const countVisits = (days: Set<string>, start: string, end: string) => [...days].filter((day) => day >= start && day < end).length;
export const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
export const periodLabel = (start: string, end: string) => `${dateLabel(start)} – ${dateLabel(addDays(end, -1))}`;
