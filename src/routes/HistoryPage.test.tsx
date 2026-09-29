import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryPage } from "./HistoryPage";
import type { WorkoutSession } from "../types/domain";

const mockUpdateSet = vi.fn();
const mockUseAuth = vi.fn();
const mockUseCompletedWorkouts = vi.fn();
const mockUseDeleteWorkoutSession = vi.fn();

vi.mock("../features/auth/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../features/workouts/hooks", () => ({
  useUpdateLoggedSet: () => ({ mutateAsync: mockUpdateSet, isPending: false }),
  useCompletedWorkouts: (...args: unknown[]) => mockUseCompletedWorkouts(...args),
  useDeleteWorkoutSession: (userId: string) => mockUseDeleteWorkoutSession(userId),
}));

function buildSession(id = "session-1"): WorkoutSession {
  return {
    id,
    userId: "user-1",
    workoutTemplateId: "template-1",
    status: "completed",
    startedAt: "2026-04-05T10:00:00.000Z",
    completedAt: "2026-04-05T10:30:00.000Z",
    template: {
      id: "template-1",
      name: "Workout A",
      orderIndex: 1,
      warmupNotes: null,
      finisherNotes: null,
      exercises: [],
    },
    performances: [
      {
        id: "performance-1",
        workoutSessionId: id,
        exerciseId: "exercise-1",
        exerciseOrder: 1,
        recommendedLoadValue: 50,
        recommendedSecondsValue: null,
        recommendationText: "",
        completionStatus: "completed",
        notes: null,
        exercise: {
          id: "exercise-1",
          name: "Goblet Squat",
          category: "Squat",
          equipment: "Dumbbell",
          loadMode: "weight",
          guidanceSummary: "",
          setupCues: "",
          executionCues: "",
          commonMistakes: "",
          defaultIncrement: 5,
          unit: "lb",
        },
        loggedSets: [
          {
            id: "set-1",
            exercisePerformanceId: "performance-1",
            setNumber: 1,
            loadValue: 50,
            reps: 8,
            seconds: null,
            completed: true,
          },
        ],
      },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  );
}

describe("HistoryPage", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 3, 15, 12));
    vi.restoreAllMocks();
    mockUpdateSet.mockReset().mockResolvedValue(undefined);
    mockUseAuth.mockReset();
    mockUseCompletedWorkouts.mockReset();
    mockUseDeleteWorkoutSession.mockReset();

    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
    });
    mockUseCompletedWorkouts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [buildSession()],
    });
    mockUseDeleteWorkoutSession.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
  });

  it("shows an empty state when there are no completed workouts", () => {
    mockUseCompletedWorkouts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    });

    renderPage();

    expect(screen.getByText("No workouts this month")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/today",
    );
  });

  it("highlights workout days and shows only the selected day's details", async () => {
    const user = userEvent.setup();
    const older = buildSession("older");
    older.completedAt = new Date(2026, 3, 3, 12).toISOString();
    older.template = { ...older.template, name: "Workout B" };
    mockUseCompletedWorkouts.mockReturnValue({ data: [buildSession(), older] });
    renderPage();
    expect(screen.getByText("Workout A")).toBeVisible();
    expect(screen.queryByText("Workout B")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "April 3, 2026: Workout B" }));
    expect(screen.getByText("Workout B")).toBeVisible();
    expect(screen.queryByText("Workout A")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "April 4, 2026: No workouts" }));
    expect(screen.getByText("No workouts on this day.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("groups multiple workouts on one local calendar day", () => {
    const first = buildSession();
    const second = buildSession("second");
    first.completedAt = new Date(2026, 3, 5, 0, 30).toISOString();
    second.completedAt = new Date(2026, 3, 5, 23, 30).toISOString();
    mockUseCompletedWorkouts.mockReturnValue({ data: [first, second] });
    renderPage();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "April 5, 2026: Workout A, Workout A" })).toHaveAttribute("aria-pressed", "true");
  });

  it("averages distinct visit days over the elapsed portion of this month", () => {
    mockUseCompletedWorkouts.mockReturnValue({ data: [buildSession(), buildSession("same-day")] });
    renderPage();
    expect(screen.getByText("0.5 visits/week so far")).toBeVisible();
    expect(screen.queryByText("Gym consistency")).not.toBeInTheDocument();
  });

  it("uses the full length of a past month", async () => {
    const session = buildSession();
    session.completedAt = new Date(2026, 2, 5, 12).toISOString();
    mockUseCompletedWorkouts.mockReturnValue({ data: [session] });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("0.2 visits/week on average")).toBeVisible();
  });

  it("hides the average when history cannot be loaded", () => {
    mockUseCompletedWorkouts.mockReturnValue({ isError: true, data: [] });
    renderPage();
    expect(screen.queryByText(/visits\/week/)).not.toBeInTheDocument();
  });

  it("loads the chosen month and supports year boundaries and returning to this month", async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date(2026, 0, 15, 12));
    renderPage();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { name: "December 2025" })).toBeVisible();
    expect(mockUseCompletedWorkouts).toHaveBeenLastCalledWith("user-1", undefined, new Date(2025, 11, 1));
    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getByRole("heading", { name: "January 2026" })).toBeVisible();
  });

  it("keeps the calendar available while loading and does not claim the month is empty", () => {
    mockUseCompletedWorkouts.mockReturnValue({ isLoading: true });
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading completed workouts");
    expect(screen.queryByText("No workouts this month")).not.toBeInTheDocument();
  });

  it("edits a past exercise using the same set controls and saves immediately", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole("button", { name: "Remove workout" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Goblet Squat" }));
    expect(screen.getByRole("heading", { name: "Edit sets" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    await user.clear(screen.getByRole("textbox", { name: "Set 1 Reps" }));
    await user.type(screen.getByRole("textbox", { name: "Set 1 Reps" }), "6");
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    expect(mockUpdateSet).toHaveBeenLastCalledWith({ setId: "set-1", values: { loadValue: 50, reps: 6, seconds: null, completed: true } });
    await user.click(within(screen.getByRole("heading", { name: "Edit sets" }).parentElement!).getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Goblet Squat" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: "Remove workout" })).not.toBeInTheDocument();
  });

  it("removes a workout after confirmation", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);

    mockUseDeleteWorkoutSession.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Remove workout" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Remove this workout from your history permanently? This cannot be undone.",
    );
    expect(mutateAsync).toHaveBeenCalledWith("session-1");
  });

  it("shows an inline error when removal fails", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(new Error("delete failed"));

    mockUseDeleteWorkoutSession.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Remove workout" }));

    expect(await screen.findByText("That workout could not be removed. Try again.")).toBeVisible();
  });

  it("does not remove a workout when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);

    mockUseDeleteWorkoutSession.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Remove workout" }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
