import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GymGoalCard } from "./GymGoalCard";
import { localDay, type GymGoal } from "../features/goals/logic";
const mocks = vi.hoisted(() => ({ metadata: {} as Record<string, unknown>, save: vi.fn(), visits: vi.fn() }));
vi.mock("../features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "u1", user_metadata: mocks.metadata } }) }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: { updateUser: (...args: unknown[]) => mocks.save(...args) } } }));
vi.mock("../features/goals/api", () => ({ fetchVisitTimestamps: (...args: unknown[]) => mocks.visits(...args) }));
function renderCard(mode: "today" | "history" | "complete" = "today") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GymGoalCard mode={mode} completedAt={new Date().toISOString()} /></QueryClientProvider>);
}
function enableGoal() {
  const today = localDay(new Date(), "America/New_York");
  mocks.metadata.gym_goal = { startDay: today, timeZone: "America/New_York", changes: [{ startDay: today, weekly: 2.5 }] } satisfies GymGoal;
}
beforeEach(() => { mocks.metadata = {}; mocks.save.mockReset().mockResolvedValue({ error: null }); mocks.visits.mockReset().mockResolvedValue([new Date().toISOString(), new Date().toISOString()]); });
describe("GymGoalCard", () => {
  it("starts at 2.5 and saves to the account", async () => {
    renderCard();
    expect(screen.getByRole("spinbutton")).toHaveValue(2.5);
    await userEvent.click(screen.getByRole("button", { name: "Save goal" }));
    expect(mocks.save).toHaveBeenCalledWith({ data: { gym_goal: expect.objectContaining({ changes: [expect.objectContaining({ weekly: 2.5 })] }) } });
  });
  it("shows errors when saving fails", async () => {
    mocks.save.mockResolvedValue({ error: new Error("offline") }); renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
  });
  it("counts duplicate sessions once and allows editing", async () => {
    enableGoal(); renderCard();
    expect(await screen.findByText("1 of 5 visits")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    await userEvent.clear(screen.getByRole("spinbutton"));
    await userEvent.type(screen.getByRole("spinbutton"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Save goal" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].data.gym_goal.changes.map((c: { weekly: number }) => c.weekly)).toEqual([2.5, 3]);
  });
  it("shows the long-term average and the initial history state", async () => {
    enableGoal(); renderCard("history");
    expect(await screen.findByText("0.1 visits/week over the last 56 days")).toBeInTheDocument();
    expect(screen.getByText(/Your first period is underway/)).toBeInTheDocument();
  });
  it("explains the completed workout contribution", async () => {
    enableGoal(); renderCard("complete");
    expect(await screen.findByText(/Nice job! Visit 4 more times by/)).toHaveTextContent("to complete your goal.");
  });
  it("does not turn a loading failure into zero progress", async () => {
    enableGoal(); mocks.visits.mockRejectedValue(new Error("offline")); renderCard();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
