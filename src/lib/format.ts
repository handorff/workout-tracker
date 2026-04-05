import type { ExercisePerformance, LoggedSet, WorkoutSession } from "../types/domain";

export function formatWorkoutDate(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatWorkoutDateTime(value: string | null) {
  if (!value) {
    return "Not completed";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDurationMinutes(startedAt: string, completedAt: string | null) {
  if (!completedAt) {
    return null;
  }

  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return `${minutes} min`;
}

export function formatLoad(value: number | null, unit: string, isAssistance = false) {
  if (value == null) {
    return isAssistance ? "Choose assistance" : "Choose weight";
  }

  return `${value} ${unit}`;
}

export function formatRange(min: number | null, max: number | null, suffix = "") {
  if (min == null && max == null) {
    return "";
  }

  if (min != null && max != null && min !== max) {
    return `${min}-${max}${suffix}`;
  }

  return `${min ?? max}${suffix}`;
}

export function summarizeSet(set: LoggedSet, unit: string, isAssistance = false) {
  const parts: string[] = [];

  if (set.loadValue != null) {
    parts.push(formatLoad(set.loadValue, unit, isAssistance));
  }

  if (set.reps != null) {
    parts.push(`${set.reps}`);
  }

  if (set.seconds != null) {
    parts.push(`${set.seconds}s`);
  }

  return parts.join(" x ");
}

export function summarizePerformance(performance: ExercisePerformance) {
  const isAssistance = performance.exercise.loadMode === "assistance";
  const setSummary = performance.loggedSets
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => summarizeSet(set, performance.exercise.unit, isAssistance))
    .filter(Boolean)
    .join(" / ");

  return `${performance.exercise.name} ${setSummary}`.trim();
}

export function summarizeSession(session: WorkoutSession) {
  return session.performances
    .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
    .map(summarizePerformance)
    .slice(0, 3);
}
