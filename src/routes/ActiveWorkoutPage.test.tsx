import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveWorkoutPage } from "./ActiveWorkoutPage";
import type { WorkoutSession } from "../types/domain";

const mocks = vi.hoisted(() => ({ session: vi.fn(), complete: vi.fn(), update: vi.fn(), finish: vi.fn() }));
vi.mock("../features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("../features/workouts/hooks", () => ({
  useFinishCardioWorkout: () => ({ mutateAsync: mocks.finish, isPending: false }),
  useWorkoutSession: () => ({ data: mocks.session(), isLoading: false, isError: false }),
  useCompletedWorkouts: () => ({ data: [] }),
  useUpdateLoggedSet: () => ({ mutateAsync: mocks.update, isPending: false }),
  useCompleteExercise: () => ({ mutateAsync: mocks.complete, isPending: false }),
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


let session: WorkoutSession;
function renderPage(path = "/workout/session-1") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/workout/:sessionId" element={<ActiveWorkoutPage />} />
    <Route path="/workout/:sessionId/complete" element={<h1>Workout Saved</h1>} />
  </Routes></MemoryRouter>);
}

describe("exercise selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session = buildSession();
    session.status = "in_progress";
    session.completedAt = null;
    const first = session.performances[0];
    first.completionStatus = "pending";
    first.loggedSets[0].completed = false;
    session.performances.push({ ...first, id: "performance-2", exerciseId: "exercise-2", exerciseOrder: 2,
      exercise: { ...first.exercise, id: "exercise-2", name: "Cable Row" },
      loggedSets: [{ ...first.loggedSets[0], id: "set-2", exercisePerformanceId: "performance-2" }],
    });
    mocks.session.mockImplementation(() => session);
    mocks.complete.mockImplementation(async (id: string) => {
      session = { ...session, performances: session.performances.map(p => p.id === id ? { ...p, completionStatus: "completed" } : p) };
      if (session.performances.every(p => p.completionStatus === "completed")) session.status = "completed";
      return session;
    });
  });

  it("allows the second exercise first and returns to the checklist after completion", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("link", { name: /Cable Row/ }));
    expect(screen.getByRole("heading", { name: "Cable Row" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Complete Exercise" }));
    expect(mocks.complete).toHaveBeenCalledWith("performance-2");
    expect(await screen.findByText("1 of 2 completed")).toBeVisible();
    expect(screen.getByRole("link", { name: /Cable Row/ })).toHaveTextContent("Completed");
    expect(screen.getByRole("link", { name: /Goblet Squat/ })).toHaveTextContent("Not started");
  });

  it("shows partial progress after returning without completing an exercise", async () => {
    session.performances[1].loggedSets[0].completed = true;
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-2");
    await user.click(screen.getByRole("link", { name: "All exercises" }));
    expect(screen.getByRole("link", { name: /Cable Row/ })).toHaveTextContent("In progress");
    expect(screen.getByRole("link", { name: /Cable Row/ })).toHaveTextContent("1 of 1 sets logged");
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("finishes when the last remaining exercise is completed regardless of its order", async () => {
    session.performances[1].completionStatus = "completed";
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-1");
    await user.click(screen.getByRole("button", { name: "Complete Exercise" }));
    expect(await screen.findByRole("heading", { name: "Workout Saved" })).toBeVisible();
  });

  it("keeps the selected exercise visible when completion fails", async () => {
    mocks.complete.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-2");
    await user.click(screen.getByRole("button", { name: "Complete Exercise" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be completed");
    expect(screen.getByRole("heading", { name: "Cable Row" })).toBeVisible();
  });

  it("saves corrected values and missing checkmarks without completing the exercise again", async () => {
    session.performances[1].completionStatus = "completed";
    mocks.update.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-2");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Set 1 Load (lb)" }));
    await user.type(screen.getByRole("textbox", { name: "Set 1 Load (lb)" }), "55");
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(mocks.update).toHaveBeenCalledWith({ setId: "set-2", values: { loadValue: 55, reps: 8, seconds: null, completed: true } });
    expect(await screen.findByRole("button", { name: "Edit" })).toBeVisible();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("saves checked set corrections immediately and Done returns to the summary", async () => {
    session.performances[1].completionStatus = "completed";
    session.performances[1].loggedSets[0].completed = true;
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-2");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Set 1 Reps" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    expect(screen.getByRole("textbox", { name: "Set 1 Reps" })).toBeEnabled();
    await user.clear(screen.getByRole("textbox", { name: "Set 1 Reps" }));
    await user.type(screen.getByRole("textbox", { name: "Set 1 Reps" }), "6");
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    expect(mocks.update).toHaveBeenLastCalledWith({ setId: "set-2", values: { loadValue: 50, reps: 6, seconds: null, completed: true } });
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Set 1 Reps" })).toHaveValue("6");
    expect(screen.getByRole("button", { name: "Set 1 completed" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows failed saves and allows checking the set again to retry", async () => {
    session.performances[1].completionStatus = "completed";
    mocks.update.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-2");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.getByRole("button", { name: "Set 1 completed" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Set 1 completed" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeVisible();
  });

  it("allows completed exercises to be reviewed without modifying their sets", () => {
    session.performances[1].completionStatus = "completed";
    renderPage("/workout/session-1?exercise=exercise-2");
    expect(screen.getByRole("heading", { name: "Completed" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Complete Exercise" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("optional cardio", () => {
  beforeEach(() => {
    session = buildSession();
    session.status = "in_progress";
    session.completedAt = null;
    session.template.name = "Cardio";
    session.performances = [1, 2].map((number) => ({
      ...session.performances[0], id: `performance-${number}`, exerciseId: `exercise-${number}`,
      completionStatus: "pending", exercise: { ...session.performances[0].exercise, name: number === 1 ? "Bike" : "Row", unit: "minutes", loadMode: "bodyweight" },
      loggedSets: [{ ...session.performances[0].loggedSets[0], id: `set-${number}`, seconds: 0, reps: null, loadValue: null, completed: false }],
    }));
    mocks.session.mockImplementation(() => session);
    mocks.finish.mockResolvedValue({ ...session, status: "completed" });
    mocks.update.mockResolvedValue(undefined);
    mocks.complete.mockResolvedValue(session);
  });
  it("finishes cardio while activities remain uncompleted", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Finish Cardio" }));
    expect(mocks.finish).toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Workout Saved" })).toBeVisible();
  });
  it("records decimal minutes and returns to the choices", async () => {
    const user = userEvent.setup();
    renderPage("/workout/session-1?exercise=exercise-2");
    await user.type(screen.getByLabelText("Minutes"), "12.5");
    await user.click(screen.getByRole("button", { name: "Save activity" }));
    expect(mocks.update).toHaveBeenCalledWith({ setId: "set-2", values: { seconds: 750, completed: true } });
    expect(mocks.complete).toHaveBeenCalledWith("performance-2");
    expect(await screen.findByRole("button", { name: "Finish Cardio" })).toBeVisible();
  });
});
