import type {
  ExercisePerformance,
  LoggedSet,
  Recommendation,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../../types/domain";

function areAllSetsCompleted(loggedSets: LoggedSet[], targetSets: number) {
  return (
    loggedSets.length >= targetSets &&
    loggedSets.slice(0, targetSets).every((set) => set.completed)
  );
}

function hitTopRepRange(
  loggedSets: LoggedSet[],
  targetSets: number,
  targetRepMax: number | null,
) {
  if (targetRepMax == null) {
    return false;
  }

  return (
    loggedSets.length >= targetSets &&
    loggedSets.slice(0, targetSets).every((set) => set.completed && (set.reps ?? 0) >= targetRepMax)
  );
}

function hitTargetSeconds(
  loggedSets: LoggedSet[],
  targetSets: number,
  targetSecondsMin: number | null,
) {
  if (targetSecondsMin == null) {
    return false;
  }

  return (
    loggedSets.length >= targetSets &&
    loggedSets.slice(0, targetSets).every((set) => set.completed && (set.seconds ?? 0) >= targetSecondsMin)
  );
}

function getLastSetValue<T>(loggedSets: LoggedSet[], accessor: (set: LoggedSet) => T | null) {
  for (const set of [...loggedSets].sort((a, b) => b.setNumber - a.setNumber)) {
    const value = accessor(set);

    if (value != null) {
      return value;
    }
  }

  return null;
}

export function getNextWorkoutName(lastCompletedName: string | null | undefined) {
  if (!lastCompletedName || lastCompletedName === "Workout B") {
    return "Workout A";
  }

  return "Workout B";
}

export function getCurrentPerformance(session: WorkoutSession) {
  return session.performances
    .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
    .find((performance) => performance.completionStatus !== "completed");
}

export function getNextPerformance(session: WorkoutSession) {
  const current = getCurrentPerformance(session);

  if (!current) {
    return null;
  }

  return session.performances
    .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
    .find((performance) => performance.exerciseOrder === current.exerciseOrder + 1) ?? null;
}

export function getRecommendation(
  templateExercise: WorkoutTemplateExercise,
  previousPerformance: ExercisePerformance | null,
): Recommendation {
  const increment =
    templateExercise.progressionIncrement ?? templateExercise.exercise.defaultIncrement ?? 0;

  const previousSets = previousPerformance?.loggedSets ?? [];
  const previousLoad =
    previousPerformance?.recommendedLoadValue ??
    getLastSetValue(previousSets, (set) => set.loadValue) ??
    templateExercise.startingLoadValue;
  const previousSeconds =
    previousPerformance?.recommendedSecondsValue ??
    getLastSetValue(previousSets, (set) => set.seconds) ??
    templateExercise.startingSecondsValue ??
    templateExercise.targetSecondsMin;

  if (!previousPerformance) {
    if (templateExercise.exercise.loadMode === "bodyweight") {
      return {
        recommendedLoadValue: null,
        recommendedSecondsValue: previousSeconds,
        recommendationText: "Start conservatively and log the first successful session.",
      };
    }

    return {
      recommendedLoadValue: previousLoad,
      recommendedSecondsValue: previousSeconds,
      recommendationText:
        previousLoad == null
          ? "Choose a conservative starting load and keep it until you complete the target cleanly."
          : "Use the seeded starting load and adjust only if it is clearly too easy or too hard.",
    };
  }

  switch (templateExercise.progressionRuleType) {
    case "top_of_range_increase": {
      const success = hitTopRepRange(
        previousSets,
        templateExercise.targetSets,
        templateExercise.targetRepMax,
      );

      return {
        recommendedLoadValue:
          success && previousLoad != null ? previousLoad + increment : previousLoad,
        recommendedSecondsValue: previousSeconds,
        recommendationText:
          success && increment > 0
            ? `All sets hit the top of the range last time, so increase by ${increment} ${templateExercise.exercise.unit}.`
            : "Keep the same load until all sets reach the top of the rep range.",
      };
    }
    case "reduce_assistance": {
      const success = hitTopRepRange(
        previousSets,
        templateExercise.targetSets,
        templateExercise.targetRepMax,
      );

      return {
        recommendedLoadValue:
          success && previousLoad != null ? Math.max(0, previousLoad - increment) : previousLoad,
        recommendedSecondsValue: previousSeconds,
        recommendationText:
          success && increment > 0
            ? `All sets hit target last time, so reduce assistance by ${increment} ${templateExercise.exercise.unit}.`
            : "Keep the same assistance until all sets hit the target reps.",
      };
    }
    case "complete_all_sets_increase":
    default: {
      const success =
        templateExercise.targetSecondsMin != null
          ? hitTargetSeconds(
              previousSets,
              templateExercise.targetSets,
              templateExercise.targetSecondsMin,
            )
          : areAllSetsCompleted(previousSets, templateExercise.targetSets);

      if (templateExercise.exercise.loadMode === "bodyweight") {
        return {
          recommendedLoadValue: null,
          recommendedSecondsValue: previousSeconds,
          recommendationText: success
            ? "Last session was completed cleanly. Keep building consistency with the same movement."
            : "Repeat the same target until all sets are completed cleanly.",
        };
      }

      return {
        recommendedLoadValue:
          success && previousLoad != null ? previousLoad + increment : previousLoad,
        recommendedSecondsValue: previousSeconds,
        recommendationText:
          success && increment > 0
            ? `All sets were completed cleanly, so increase by ${increment} ${templateExercise.exercise.unit}.`
            : "Keep the same load until all prescribed sets are completed cleanly.",
      };
    }
  }
}

export function buildInitialLoggedSet(
  templateExercise: WorkoutTemplateExercise,
  recommendation: Recommendation,
  previousSet: LoggedSet | null,
  setNumber: number,
) {
  return {
    setNumber,
    loadValue:
      previousSet?.loadValue ??
      recommendation.recommendedLoadValue ??
      templateExercise.startingLoadValue,
    reps:
      previousSet?.reps ??
      templateExercise.targetRepMin ??
      templateExercise.targetRepMax,
    seconds:
      previousSet?.seconds ??
      recommendation.recommendedSecondsValue ??
      templateExercise.targetSecondsMin,
    completed: previousSet?.completed ?? false,
  };
}

export function isWorkoutComplete(session: WorkoutSession) {
  return session.performances.every(
    (performance) => performance.completionStatus === "completed",
  );
}

export function findExerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string,
) {
  return sessions
    .flatMap((session) =>
      session.performances
        .filter((performance) => performance.exerciseId === exerciseId)
        .map((performance) => ({
          session,
          performance,
        })),
    )
    .sort((a, b) => {
      const aTime = new Date(a.session.completedAt ?? a.session.startedAt).getTime();
      const bTime = new Date(b.session.completedAt ?? b.session.startedAt).getTime();
      return bTime - aTime;
    });
}

export function sortTemplateExercises(template: WorkoutTemplate) {
  return [...template.exercises].sort((a, b) => a.orderIndex - b.orderIndex);
}
