import { describe, expect, it } from "vitest";

import type { ExercisePerformance, WorkoutTemplateExercise } from "../../types/domain";
import { getNextWorkoutName, getRecommendation } from "./logic";

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

  it("alternates from Workout A to Workout B", () => {
    expect(getNextWorkoutName("Workout A")).toBe("Workout B");
  });

  it("alternates from Workout B back to Workout A", () => {
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
