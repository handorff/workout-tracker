import { describe, expect, it } from "vitest";
import { addDays, changeGoal, countVisits, localDay, periodFor, readGoal, validWeekly, visitDays, type GymGoal } from "./logic";
const goal: GymGoal = { startDay: "2026-09-28", timeZone: "America/New_York", changes: [{ startDay: "2026-09-28", weekly: 2.5 }] };
describe("gym visit goals", () => {
  it("uses five visits and resets at the exact two-week boundary", () => {
    expect(periodFor(goal, "2026-10-11")).toEqual({ start: "2026-09-28", end: "2026-10-12", weekly: 2.5, target: 5 });
    expect(periodFor(goal, "2026-10-12").start).toBe("2026-10-12");
  });
  it("counts one local gym day across strength and cardio sessions", () => {
    const days = visitDays(["2026-09-29T00:30:00Z", "2026-09-28T18:00:00Z", "2026-09-29T15:00:00Z", "2026-10-12T12:00:00Z"], goal.timeZone);
    expect(countVisits(days, "2026-09-28", "2026-10-12")).toBe(2);
  });
  it("preserves past and current targets and replaces a pending change", () => {
    const changed = changeGoal(changeGoal(goal, "2026-10-01", 3), "2026-10-02", 4);
    expect(changed.changes).toHaveLength(2);
    expect(periodFor(changed, "2026-10-11").target).toBe(5);
    expect(periodFor(changed, "2026-10-12").target).toBe(8);
    expect(periodFor(changeGoal(changed, "2026-10-15", 2), "2026-10-12").target).toBe(8);
  });
  it("keeps calendar days stable across DST and year changes", () => {
    expect(addDays("2026-10-26", 14)).toBe("2026-11-09");
    expect(addDays("2026-12-28", 14)).toBe("2027-01-11");
    expect(localDay(new Date("2026-11-02T04:30:00Z"), goal.timeZone)).toBe("2026-11-01");
  });
  it("validates saved settings and half-visit increments", () => {
    expect(readGoal(goal)).toEqual(goal);
    for (const value of [undefined, {}, { ...goal, timeZone: "bad" }, { ...goal, startDay: "2026-02-30" }, { ...goal, changes: [{ startDay: goal.startDay, weekly: 2.3 }] }]) expect(readGoal(value)).toBeNull();
    for (const weekly of [0, -1, 7.5, 2.3, NaN]) expect(validWeekly(weekly)).toBe(false);
    expect(validWeekly(2.5)).toBe(true);
  });
});
