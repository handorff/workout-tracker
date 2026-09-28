import { beforeEach, expect, it, vi } from "vitest";
import { fetchVisitTimestamps } from "./api";
const mocks = vi.hoisted(() => ({ range: vi.fn(), from: vi.fn(), eq: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mocks.from(...args) } }));
beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: vi.fn(), eq: mocks.eq, gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: mocks.range };
  for (const method of [query.select, query.eq, query.gte, query.lt, query.order]) method.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
});
it("fetches all pages and only the current user's completed sessions", async () => {
  mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ completed_at: "2026-09-28T14:00:00Z" })), error: null })
    .mockResolvedValueOnce({ data: [{ completed_at: "2026-09-29T14:00:00Z" }], error: null });
  const result = await fetchVisitTimestamps("u1", "2026-09-01", "2026-10-01");
  expect(result).toHaveLength(1001);
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "u1");
  expect(mocks.eq).toHaveBeenCalledWith("status", "completed");
  expect(mocks.range).toHaveBeenNthCalledWith(2, 1000, 1999);
});
it("rejects partial results if a later page fails", async () => {
  mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ completed_at: "2026-09-28T14:00:00Z" })), error: null })
    .mockResolvedValueOnce({ data: null, error: new Error("offline") });
  await expect(fetchVisitTimestamps("u1", "2026-09-01", "2026-10-01")).rejects.toThrow("offline");
});
