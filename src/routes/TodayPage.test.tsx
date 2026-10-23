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
  const templates = ["A", "B", "Cardio"].map((name, index) => ({
    ...base.template, id: `template-${name}`, name: name === "Cardio" ? name : `Workout ${name}`, warmupNotes: `Warm-up ${name}`,
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

describe("Today workout actions", () => {
  it("marks the next workout and keeps outside activity secondary", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Start Workout A" })).toHaveAccessibleDescription("Next workout");
    expect(screen.getByRole("button", { name: "Start Workout A" })).toHaveClass("primary-button");
    expect(screen.getByRole("button", { name: "Start Workout B" })).not.toHaveAccessibleDescription("Next workout");
    expect(screen.getByRole("link", { name: "Log outside activity" })).toHaveAttribute("href", "/outside-activity/new");
    expect(screen.queryByText("Goblet Squat")).not.toBeInTheDocument();
    expect(screen.queryByText("Warm-up A")).not.toBeInTheDocument();
  });

  it.each([["Workout A", "template-A"], ["Workout B", "template-B"], ["Cardio", "template-Cardio"]])("starts %s with one click", async (name, id) => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: `Start ${name}` }));
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(id);
    expect(await screen.findByRole("heading", { name: "Workout checklist" })).toBeVisible();
  });

  it("previews each workout without starting it and toggles details closed", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "View Workout B details" }));
    expect(screen.getByText("Warm-up B")).toBeVisible();
    expect(screen.getByText("Cable Row")).toBeVisible();
    expect(screen.getByText("Suggested: 75 lb")).toBeVisible();
    expect(mocks.start).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "View Workout A details" }));
    expect(screen.getByText("Goblet Squat")).toBeVisible();
    expect(screen.queryByText("Warm-up B")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Workout A details" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Hide Workout A details" }));
    expect(screen.queryByText("Goblet Squat")).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("resumes an active workout and disables starting other routines", async () => {
    data.inProgressSession = { ...buildSession(), workoutTemplateId: data.templates[1].id, status: "in_progress", template: data.templates[1] };
    renderPage();
    expect(screen.getByRole("button", { name: "Start Workout A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start Cardio" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "View Workout A details" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Resume Workout B" }));
    expect(mocks.start).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Workout checklist" })).toBeVisible();
  });

  it("allows retrying the same workout after a failure", async () => {
    mocks.start.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Start Workout B" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be started");
    await userEvent.click(screen.getByRole("button", { name: "Start Workout B" }));
    expect(mocks.start).toHaveBeenNthCalledWith(2, "template-B");
    expect(await screen.findByRole("heading", { name: "Workout checklist" })).toBeVisible();
  });
});
