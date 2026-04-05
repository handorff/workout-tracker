export type LoadMode = "weight" | "assistance" | "bodyweight";
export type ProgressionRuleType =
  | "top_of_range_increase"
  | "complete_all_sets_increase"
  | "reduce_assistance";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type CompletionStatus = "pending" | "completed";

export interface Exercise {
  id: string;
  name: string;
  category: string | null;
  equipment: string | null;
  loadMode: LoadMode;
  guidanceSummary: string;
  setupCues: string;
  executionCues: string;
  commonMistakes: string;
  defaultIncrement: number | null;
  unit: string;
}

export interface WorkoutTemplateExercise {
  id: string;
  workoutTemplateId: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetSecondsMin: number | null;
  targetSecondsMax: number | null;
  startingLoadValue: number | null;
  startingSecondsValue: number | null;
  progressionRuleType: ProgressionRuleType;
  progressionIncrement: number | null;
  notes: string | null;
  exercise: Exercise;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  orderIndex: number;
  warmupNotes: string | null;
  finisherNotes: string | null;
  exercises: WorkoutTemplateExercise[];
}

export interface LoggedSet {
  id: string;
  exercisePerformanceId: string;
  setNumber: number;
  loadValue: number | null;
  reps: number | null;
  seconds: number | null;
  completed: boolean;
}

export interface ExercisePerformance {
  id: string;
  workoutSessionId: string;
  exerciseId: string;
  exerciseOrder: number;
  recommendedLoadValue: number | null;
  recommendedSecondsValue: number | null;
  recommendationText: string;
  completionStatus: CompletionStatus;
  notes: string | null;
  exercise: Exercise;
  loggedSets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workoutTemplateId: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  template: WorkoutTemplate;
  performances: ExercisePerformance[];
}

export interface Recommendation {
  recommendedLoadValue: number | null;
  recommendedSecondsValue: number | null;
  recommendationText: string;
}
