import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryPage } from "./HistoryPage";
import type { WorkoutSession } from "../types/domain";

const mockUseAuth = vi.fn();
const mockUseCompletedWorkouts = vi.fn();
const mockUseDeleteWorkoutSession = vi.fn();

vi.mock("../features/auth/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../features/workouts/hooks", () => ({
  useCompletedWorkouts: (userId: string) => mockUseCompletedWorkouts(userId),
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
  beforeEach(() => {
    vi.restoreAllMocks();
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

    expect(screen.getByText("No completed workouts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/today",
    );
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

    await user.click(screen.getByRole("button", { name: "Remove" }));

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

    await user.click(screen.getByRole("button", { name: "Remove" }));

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

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
