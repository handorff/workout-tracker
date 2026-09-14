import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPage } from "./TodayPage";
import type { WorkoutSession } from "../types/domain";
import type { fetchTodayData } from "../features/workouts/api";
const mocks = vi.hoisted(() => ({ today: vi.fn(), start: vi.fn() }));
vi.mock("../features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("../features/workouts/hooks", () => ({
  useTodayData: () => ({ data: mocks.today(), isLoading: false, isError: false }),
  useStartWorkout: () => ({ mutateAsync: mocks.start, isPending: false }),
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


let data: Awaited<ReturnType<typeof fetchTodayData>>;
function renderPage() {
  return render(<MemoryRouter initialEntries={["/today"]}><Routes>
    <Route path="/today" element={<TodayPage />} />
    <Route path="/workout/:sessionId" element={<h1>Workout checklist</h1>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  const base = buildSession();
  const templates = ["A", "B"].map((name, index) => ({
    ...base.template, id: `template-${name}`, name: `Workout ${name}`, warmupNotes: `Warm-up ${name}`,
    exercises: [{
      id: `slot-${name}`, workoutTemplateId: `template-${name}`, exerciseId: `exercise-${name}`, orderIndex: 1,
      targetSets: 3, targetRepMin: 6, targetRepMax: 8, targetSecondsMin: null, targetSecondsMax: null,
      startingLoadValue: 50, startingSecondsValue: null, progressionRuleType: "top_of_range_increase" as const,
      progressionIncrement: 5, notes: null,
      exercise: { ...base.performances[0].exercise, id: `exercise-${name}`, name: index === 0 ? "Goblet Squat" : "Cable Row" },
    }],
  }));
  data = { inProgressSession: null, nextTemplate: templates[0], templates, lastCompletedWorkoutName: "Workout B",
    recommendationsByTemplate: {
      "template-A": { "exercise-A": { recommendedLoadValue: 50, recommendedSecondsValue: null, recommendationText: "" } },
      "template-B": { "exercise-B": { recommendedLoadValue: 75, recommendedSecondsValue: null, recommendationText: "" } },
    },
  };
  mocks.today.mockImplementation(() => data);
  mocks.start.mockResolvedValue({ id: "new-session" });
});

describe("Today workout selection", () => {
  it("defaults to the suggested workout and previews the selected routine", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("button", { name: "Workout A" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Workout B" }));
    expect(screen.getByText("Warm-up B")).toBeVisible();
    expect(screen.getByText("Cable Row")).toBeVisible();
    expect(screen.getByText("Suggested: 75 lb")).toBeVisible();
    expect(screen.queryByText("Goblet Squat")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start Workout B" }));
    expect(mocks.start).toHaveBeenCalledWith("template-B");
    expect(await screen.findByRole("heading", { name: "Workout checklist" })).toBeVisible();
  });

  it("resumes an active workout without creating or replacing it", async () => {
    const user = userEvent.setup();
    data.inProgressSession = { ...buildSession(), status: "in_progress", template: data.templates[1] };
    renderPage();
    expect(screen.getByRole("button", { name: "Workout A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Workout B" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Resume Workout B" }));
    expect(mocks.start).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Workout checklist" })).toBeVisible();
  });

  it("keeps the selection available to retry if starting fails", async () => {
    const user = userEvent.setup();
    mocks.start.mockRejectedValue(new Error("offline"));
    renderPage();
    await user.click(screen.getByRole("button", { name: "Workout B" }));
    await user.click(screen.getByRole("button", { name: "Start Workout B" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be started");
    expect(screen.getByRole("button", { name: "Start Workout B" })).toBeEnabled();
  });
});
