import { expect, it } from "vitest";
import { summarizeSet } from "./format";
const set = { id: "s", exercisePerformanceId: "p", setNumber: 1, seconds: 750, loadValue: null, reps: null, completed: true };
it("displays cardio in minutes and excludes unlogged options", () => {
  expect(summarizeSet(set, "minutes")).toBe("12.5 min");
  expect(summarizeSet({ ...set, completed: false }, "minutes")).toBe("");
  expect(summarizeSet(set, "lb")).toBe("750s");
});
