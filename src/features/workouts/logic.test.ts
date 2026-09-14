import { describe, expect, it } from "vitest";

import type { ExercisePerformance, WorkoutTemplateExercise, WorkoutSession } from "../../types/domain";
import { buildInitialLoggedSet, getNextWorkoutName, getRecommendation, findLatestPerformance } from "./logic";

function buildTemplateExercise(
  overrides: Partial<WorkoutTemplateExercise> = {},
): WorkoutTemplateExercise {
  return {
    id: "slot-1",
    workoutTemplateId: "template-1",
    exerciseId: "exercise-1",
    orderIndex: 1,
    targetSets: 3,
    targetRepMin: 6,
    targetRepMax: 8,
    targetSecondsMin: null,
    targetSecondsMax: null,
    startingLoadValue: 50,
    startingSecondsValue: null,
    progressionRuleType: "top_of_range_increase",
    progressionIncrement: 5,
    notes: null,
    exercise: {
      id: "exercise-1",
      name: "Dumbbell Bench Press",
      category: "Push",
      equipment: "Dumbbells",
      loadMode: "weight",
      guidanceSummary: "",
      setupCues: "",
      executionCues: "",
      commonMistakes: "",
      defaultIncrement: 5,
      unit: "lb",
    },
    ...overrides,
  };
}

function buildPerformance(reps: number[], loadValue = 100): ExercisePerformance {
  return {
    id: "performance-1",
    workoutSessionId: "session-1",
    exerciseId: "exercise-1",
    exerciseOrder: 1,
    recommendedLoadValue: loadValue,
    recommendedSecondsValue: null,
    recommendationText: "",
    completionStatus: "completed",
    notes: null,
    exercise: {
      id: "exercise-1",
      name: "Dumbbell Bench Press",
      category: "Push",
      equipment: "Dumbbells",
      loadMode: "weight",
      guidanceSummary: "",
      setupCues: "",
      executionCues: "",
      commonMistakes: "",
      defaultIncrement: 5,
      unit: "lb",
    },
    loggedSets: reps.map((repCount, index) => ({
      id: `set-${index + 1}`,
      exercisePerformanceId: "performance-1",
      setNumber: index + 1,
      loadValue,
      reps: repCount,
      seconds: null,
      completed: true,
    })),
  };
}

describe("getNextWorkoutName", () => {
  it("defaults to Workout A when nothing has been completed", () => {
    expect(getNextWorkoutName(null)).toBe("Workout A");
  });

  it("selects Cardio after Workout A", () => {
    expect(getNextWorkoutName("Workout A")).toBe("Cardio");
  });

  it("selects Workout B after Cardio", () => {
    expect(getNextWorkoutName("Cardio")).toBe("Workout B");
  });

  it("cycles from Workout B back to Workout A", () => {
    expect(getNextWorkoutName("Workout B")).toBe("Workout A");
  });
});

describe("getRecommendation", () => {
  it("increases load for rep-range lifts after top-of-range success", () => {
    const templateExercise = buildTemplateExercise();
    const recommendation = getRecommendation(templateExercise, buildPerformance([8, 8, 8], 115));

    expect(recommendation.recommendedLoadValue).toBe(120);
  });

  it("keeps load the same when the top of the rep range is not hit", () => {
    const templateExercise = buildTemplateExercise();
    const recommendation = getRecommendation(templateExercise, buildPerformance([8, 7, 6], 115));

    expect(recommendation.recommendedLoadValue).toBe(115);
  });

  it("reduces assistance when assisted pull-ups hit target reps", () => {
    const templateExercise = buildTemplateExercise({
      progressionRuleType: "reduce_assistance",
      exercise: {
        ...buildTemplateExercise().exercise,
        loadMode: "assistance",
      },
    });

    const recommendation = getRecommendation(templateExercise, buildPerformance([8, 8, 8], 55));

    expect(recommendation.recommendedLoadValue).toBe(50);
  });
});

describe("buildInitialLoggedSet", () => {
  it("defaults load to the recommendation instead of the previous set", () => {
    const initial = buildInitialLoggedSet(
      buildTemplateExercise(),
      {
        recommendedLoadValue: 130,
        recommendedSecondsValue: null,
        recommendationText: "",
      },
      {
        id: "set-1",
        exercisePerformanceId: "performance-1",
        setNumber: 1,
        loadValue: 120,
        reps: 5,
        seconds: null,
        completed: true,
      },
      1,
    );

    expect(initial.loadValue).toBe(130);
    expect(initial.completed).toBe(false);
  });
});

describe("recommendations from actual logged weight", () => {
  it("uses 20 lb logged for 3 x 8 to suggest 25 lb even if the previous suggestion was 60 lb", () => {
    const previous = buildPerformance([8, 8, 8], 20);
    previous.recommendedLoadValue = 60;
    expect(getRecommendation(buildTemplateExercise(), previous).recommendedLoadValue).toBe(25);
  });

  it.each([[8, 8, 7], [8, 6, 8], [8, 8]])("keeps the actual weight when prescribed sets miss the maximum: %j", (...reps) => {
    const previous = buildPerformance(reps, 20);
    previous.recommendedLoadValue = 60;
    expect(getRecommendation(buildTemplateExercise(), previous).recommendedLoadValue).toBe(20);
  });

  it("requires completed sets and ignores an unlogged heavier default", () => {
    const previous = buildPerformance([8, 8, 8], 20);
    previous.loggedSets[2].completed = false;
    previous.loggedSets[2].loadValue = 60;
    expect(getRecommendation(buildTemplateExercise(), previous).recommendedLoadValue).toBe(20);
  });

  it("applies the rep requirement to lifts using the old complete-all-sets rule too", () => {
    const template = buildTemplateExercise({ progressionRuleType: "complete_all_sets_increase" });
    expect(getRecommendation(template, buildPerformance([8, 8, 7], 20)).recommendedLoadValue).toBe(20);
    expect(getRecommendation(template, buildPerformance([8, 8, 8], 20)).recommendedLoadValue).toBe(25);
  });

  it("uses the fixed rep target for fixed-rep exercises", () => {
    const template = buildTemplateExercise({ targetRepMin: 5, targetRepMax: 5, progressionRuleType: "complete_all_sets_increase" });
    expect(getRecommendation(template, buildPerformance([5, 5, 4], 20)).recommendedLoadValue).toBe(20);
    expect(getRecommendation(template, buildPerformance([5, 5, 5], 20)).recommendedLoadValue).toBe(25);
  });

  it("uses the last completed set's weight when loads differ, regardless of array order", () => {
    const previous = buildPerformance([8, 7, 6], 20);
    previous.loggedSets[0].loadValue = 30;
    previous.loggedSets.reverse();
    expect(getRecommendation(buildTemplateExercise(), previous).recommendedLoadValue).toBe(20);
  });

  it("retains the latest recorded weight when a workout was finished without checking off sets", () => {
    const previous = buildPerformance([8, 8, 8], 20);
    previous.recommendedLoadValue = 60;
    previous.loggedSets.forEach((set) => { set.completed = false; });
    expect(getRecommendation(buildTemplateExercise(), previous).recommendedLoadValue).toBe(20);
  });

  it("uses the configured starting weight when the exercise has no history", () => {
    expect(getRecommendation(buildTemplateExercise(), null).recommendedLoadValue).toBe(50);
  });
});

function historySession(date: string, templateId: string, weight: number): WorkoutSession {
  return {
    id: date, userId: "user", workoutTemplateId: templateId, status: "completed", startedAt: date, completedAt: date,
    template: { id: templateId, name: templateId, orderIndex: 1, warmupNotes: null, finisherNotes: null, exercises: [] },
    performances: [buildPerformance([8, 8, 8], weight)],
  };
}

describe("same-workout exercise history", () => {
  it("chooses the latest matching performance, ignoring older heavier loads and other workouts", () => {
    const sessions = [
      historySession("2026-03-01", "template-1", 60),
      historySession("2026-09-14", "other-workout", 80),
      historySession("2026-09-10", "template-1", 20),
    ];
    const previous = findLatestPerformance(sessions, "template-1", "exercise-1");
    expect(getRecommendation(buildTemplateExercise(), previous).recommendedLoadValue).toBe(25);
  });
  it("does not borrow history from another workout or an unfinished session", () => {
    const unfinished = { ...historySession("2026-09-14", "template-1", 60), status: "in_progress" as const };
    expect(findLatestPerformance([unfinished, historySession("2026-09-10", "other", 20)], "template-1", "exercise-1")).toBeNull();
  });
});
