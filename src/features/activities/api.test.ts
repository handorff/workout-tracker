import { beforeEach, expect, it, vi } from "vitest";
import { deleteOutsideActivity, fetchOutsideActivities, saveOutsideActivity, validateActivity } from "./api";
const mocks = vi.hoisted(() => ({ from: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), single: vi.fn() } }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: mocks.from } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue(mocks.query);
  for (const method of Object.values(mocks.query)) method.mockReturnValue(mocks.query);
  mocks.query.single.mockResolvedValue({ data: { id: "a1" }, error: null });
});
const values = { activity: " Walking ", activity_date: "2026-04-05", distance_miles: 2.75 };

it("saves only to the outside activity table and scopes ownership", async () => {
  await saveOutsideActivity("u1", values);
  expect(mocks.from.mock.calls).toEqual([["outside_activities"]]);
  expect(mocks.query.insert).toHaveBeenCalledWith({ ...values, user_id: "u1", activity: "Walking" });
  await saveOutsideActivity("u1", values, "a1");
  expect(mocks.query.eq).toHaveBeenCalledWith("user_id", "u1");
  expect(mocks.query.eq).toHaveBeenCalledWith("id", "a1");
});

it("paginates calendar dates without timezone shifts, across year boundaries", async () => {
  mocks.query.range.mockResolvedValueOnce({ data: Array.from({ length: 100 }, () => ({ id: "a1" })), error: null })
    .mockResolvedValueOnce({ data: [{ id: "a2" }], error: null });
  expect(await fetchOutsideActivities("u1", new Date(2026, 11, 1))).toHaveLength(101);
  expect(mocks.query.gte).toHaveBeenCalledWith("activity_date", "2026-12-01");
  expect(mocks.query.lt).toHaveBeenCalledWith("activity_date", "2027-01-01");
  expect(mocks.query.range).toHaveBeenLastCalledWith(100, 199);
});

it("deletes only the user's selected outside activity", async () => {
  await deleteOutsideActivity("u1", "a1");
  expect(mocks.from).toHaveBeenCalledWith("outside_activities");
  expect(mocks.query.eq.mock.calls).toEqual([["id", "a1"], ["user_id", "u1"]]);
});

it("rejects invalid distance, name and dates before writing", async () => {
  for (const invalid of [{ distance_miles: 0 }, { distance_miles: -1 }, { distance_miles: NaN }, { distance_miles: Infinity }, { distance_miles: 10000 }, { distance_miles: 1.234 }, { activity: " " }, { activity_date: "2026-02-30" }, { activity_date: "2099-01-01" }]) {
    await expect(saveOutsideActivity("u1", { ...values, ...invalid })).rejects.toThrow();
  }
  expect(mocks.from).not.toHaveBeenCalled();
  expect(() => validateActivity({ ...values, distance_miles: 0.01 })).not.toThrow();
});

it("propagates database failures", async () => {
  mocks.query.single.mockResolvedValue({ data: null, error: new Error("offline") });
  await expect(saveOutsideActivity("u1", values)).rejects.toThrow("offline");
  mocks.query.range.mockResolvedValue({ data: null, error: new Error("offline") });
  await expect(fetchOutsideActivities("u1", new Date(2026, 3, 1))).rejects.toThrow("offline");
});
