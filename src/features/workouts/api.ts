import { assertExists } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import type {
  Exercise,
  ExercisePerformance,
  LoggedSet,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../../types/domain";
import {
  buildInitialLoggedSet,
  findExerciseHistory,
  getNextWorkoutName,
  getRecommendation,
  sortTemplateExercises,
} from "./logic";

type RawExercise = {
  id: string;
  name: string;
  category: string | null;
  equipment: string | null;
  load_mode: Exercise["loadMode"];
  guidance_summary: string;
  setup_cues: string;
  execution_cues: string;
  common_mistakes: string;
  default_increment: number | null;
  unit: string;
};

type RawTemplateExercise = {
  id: string;
  workout_template_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_rep_min: number | null;
  target_rep_max: number | null;
  target_seconds_min: number | null;
  target_seconds_max: number | null;
  starting_load_value: number | null;
  starting_seconds_value: number | null;
  progression_rule_type: WorkoutTemplateExercise["progressionRuleType"];
  progression_increment: number | null;
  notes: string | null;
  exercises: RawExercise | RawExercise[] | null;
};

type RawTemplate = {
  id: string;
  name: string;
  order_index: number;
  warmup_notes: string | null;
  finisher_notes: string | null;
  workout_template_exercises?: RawTemplateExercise[];
};

type RawLoggedSet = {
  id: string;
  exercise_performance_id: string;
  set_number: number;
  load_value: number | null;
  reps: number | null;
  seconds: number | null;
  completed: boolean;
};

type RawPerformance = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_order: number;
  recommended_load_value: number | null;
  recommended_seconds_value: number | null;
  recommendation_text: string;
  completion_status: ExercisePerformance["completionStatus"];
  notes: string | null;
  exercises: RawExercise | RawExercise[] | null;
  logged_sets?: RawLoggedSet[];
};

type RawSession = {
  id: string;
  user_id: string;
  workout_template_id: string;
  status: WorkoutSession["status"];
  started_at: string;
  completed_at: string | null;
  workout_templates: RawTemplate | RawTemplate[] | null;
  exercise_performances?: RawPerformance[];
};

interface TodayData {
  inProgressSession: WorkoutSession | null;
  nextTemplate: WorkoutTemplate;
  lastCompletedWorkoutName: string | null;
}

interface ExerciseDetailData {
  exercise: Exercise;
  templateExercise: WorkoutTemplateExercise | null;
  recentPerformances: Array<{
    session: WorkoutSession;
    performance: ExercisePerformance;
  }>;
  currentRecommendationText: string;
  currentRecommendationLoad: number | null;
  currentRecommendationSeconds: number | null;
}

const sessionSelect = `
  id,
  user_id,
  workout_template_id,
  status,
  started_at,
  completed_at,
  workout_templates (
    id,
    name,
    order_index,
    warmup_notes,
    finisher_notes,
    workout_template_exercises (
      id,
      workout_template_id,
      exercise_id,
      order_index,
      target_sets,
      target_rep_min,
      target_rep_max,
      target_seconds_min,
      target_seconds_max,
      starting_load_value,
      starting_seconds_value,
      progression_rule_type,
      progression_increment,
      notes,
      exercises (
        id,
        name,
        category,
        equipment,
        load_mode,
        guidance_summary,
        setup_cues,
        execution_cues,
        common_mistakes,
        default_increment,
        unit
      )
    )
  ),
  exercise_performances (
    id,
    workout_session_id,
    exercise_id,
    exercise_order,
    recommended_load_value,
    recommended_seconds_value,
    recommendation_text,
    completion_status,
    notes,
    exercises (
      id,
      name,
      category,
      equipment,
      load_mode,
      guidance_summary,
      setup_cues,
      execution_cues,
      common_mistakes,
      default_increment,
      unit
    ),
    logged_sets (
      id,
      exercise_performance_id,
      set_number,
      load_value,
      reps,
      seconds,
      completed
    )
  )
`;

const templateSelect = `
  id,
  name,
  order_index,
  warmup_notes,
  finisher_notes,
  workout_template_exercises (
    id,
    workout_template_id,
    exercise_id,
    order_index,
    target_sets,
    target_rep_min,
    target_rep_max,
    target_seconds_min,
    target_seconds_max,
    starting_load_value,
    starting_seconds_value,
    progression_rule_type,
    progression_increment,
    notes,
    exercises (
      id,
      name,
      category,
      equipment,
      load_mode,
      guidance_summary,
      setup_cues,
      execution_cues,
      common_mistakes,
      default_increment,
      unit
    )
  )
`;

function unpackOne<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapExercise(raw: RawExercise): Exercise {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    equipment: raw.equipment,
    loadMode: raw.load_mode,
    guidanceSummary: raw.guidance_summary,
    setupCues: raw.setup_cues,
    executionCues: raw.execution_cues,
    commonMistakes: raw.common_mistakes,
    defaultIncrement: raw.default_increment,
    unit: raw.unit,
  };
}

function mapTemplateExercise(raw: RawTemplateExercise): WorkoutTemplateExercise {
  return {
    id: raw.id,
    workoutTemplateId: raw.workout_template_id,
    exerciseId: raw.exercise_id,
    orderIndex: raw.order_index,
    targetSets: raw.target_sets,
    targetRepMin: raw.target_rep_min,
    targetRepMax: raw.target_rep_max,
    targetSecondsMin: raw.target_seconds_min,
    targetSecondsMax: raw.target_seconds_max,
    startingLoadValue: raw.starting_load_value,
    startingSecondsValue: raw.starting_seconds_value,
    progressionRuleType: raw.progression_rule_type,
    progressionIncrement: raw.progression_increment,
    notes: raw.notes,
    exercise: mapExercise(assertExists(unpackOne(raw.exercises), "Exercise missing on slot")),
  };
}

function mapTemplate(raw: RawTemplate): WorkoutTemplate {
  return {
    id: raw.id,
    name: raw.name,
    orderIndex: raw.order_index,
    warmupNotes: raw.warmup_notes,
    finisherNotes: raw.finisher_notes,
    exercises: (raw.workout_template_exercises ?? [])
      .map(mapTemplateExercise)
      .sort((a, b) => a.orderIndex - b.orderIndex),
  };
}

function mapLoggedSet(raw: RawLoggedSet): LoggedSet {
  return {
    id: raw.id,
    exercisePerformanceId: raw.exercise_performance_id,
    setNumber: raw.set_number,
    loadValue: raw.load_value,
    reps: raw.reps,
    seconds: raw.seconds,
    completed: raw.completed,
  };
}

function mapPerformance(raw: RawPerformance): ExercisePerformance {
  return {
    id: raw.id,
    workoutSessionId: raw.workout_session_id,
    exerciseId: raw.exercise_id,
    exerciseOrder: raw.exercise_order,
    recommendedLoadValue: raw.recommended_load_value,
    recommendedSecondsValue: raw.recommended_seconds_value,
    recommendationText: raw.recommendation_text,
    completionStatus: raw.completion_status,
    notes: raw.notes,
    exercise: mapExercise(
      assertExists(unpackOne(raw.exercises), "Exercise missing on performance"),
    ),
    loggedSets: (raw.logged_sets ?? [])
      .map(mapLoggedSet)
      .sort((a, b) => a.setNumber - b.setNumber),
  };
}

function mapSession(raw: RawSession): WorkoutSession {
  return {
    id: raw.id,
    userId: raw.user_id,
    workoutTemplateId: raw.workout_template_id,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    template: mapTemplate(
      assertExists(unpackOne(raw.workout_templates), "Template missing on session"),
    ),
    performances: (raw.exercise_performances ?? [])
      .map(mapPerformance)
      .sort((a, b) => a.exerciseOrder - b.exerciseOrder),
  };
}

async function fetchTemplates() {
  const { data, error } = await supabase
    .from("workout_templates")
    .select(templateSelect)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as RawTemplate[]).map(mapTemplate).sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function fetchExercise(exerciseId: string) {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, name, category, equipment, load_mode, guidance_summary, setup_cues, execution_cues, common_mistakes, default_increment, unit",
    )
    .eq("id", exerciseId)
    .single();

  if (error) {
    throw error;
  }

  return mapExercise(data as RawExercise);
}

export async function fetchWorkoutSession(sessionId: string, userId: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(sessionSelect)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data as RawSession);
}

export async function fetchInProgressWorkout(userId: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(sessionSelect)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapSession(data as RawSession);
}

export async function fetchCompletedWorkouts(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(sessionSelect)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as RawSession[]).map(mapSession);
}

export async function fetchTodayData(userId: string): Promise<TodayData> {
  const [inProgressSession, templates, completedSessions] = await Promise.all([
    fetchInProgressWorkout(userId),
    fetchTemplates(),
    fetchCompletedWorkouts(userId, 1),
  ]);

  const lastCompletedWorkoutName = completedSessions[0]?.template.name ?? null;
  const nextWorkoutName = getNextWorkoutName(lastCompletedWorkoutName);
  const nextTemplate = assertExists(
    templates.find((template) => template.name === nextWorkoutName),
    "Next workout template missing from seed data",
  );

  return {
    inProgressSession,
    nextTemplate,
    lastCompletedWorkoutName,
  };
}

async function getLatestCompletedPerformanceMap(userId: string) {
  const completedSessions = await fetchCompletedWorkouts(userId, 30);
  const latestByExerciseId = new Map<string, ExercisePerformance>();

  for (const session of completedSessions) {
    for (const performance of session.performances) {
      if (!latestByExerciseId.has(performance.exerciseId)) {
        latestByExerciseId.set(performance.exerciseId, performance);
      }
    }
  }

  return latestByExerciseId;
}

export async function startNextWorkout(userId: string) {
  const existingSession = await fetchInProgressWorkout(userId);

  if (existingSession) {
    return existingSession;
  }

  const todayData = await fetchTodayData(userId);
  const latestByExerciseId = await getLatestCompletedPerformanceMap(userId);
  const template = todayData.nextTemplate;

  const { data: sessionRecord, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      workout_template_id: template.id,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const orderedExercises = sortTemplateExercises(template);
  const performanceInsertPayload = orderedExercises.map((templateExercise) => {
    const previousPerformance = latestByExerciseId.get(templateExercise.exerciseId) ?? null;
    const recommendation = getRecommendation(templateExercise, previousPerformance);

    return {
      workout_session_id: sessionRecord.id,
      exercise_id: templateExercise.exerciseId,
      exercise_order: templateExercise.orderIndex,
      recommended_load_value: recommendation.recommendedLoadValue,
      recommended_seconds_value: recommendation.recommendedSecondsValue,
      recommendation_text: recommendation.recommendationText,
      completion_status: "pending",
      notes: templateExercise.notes,
    };
  });

  const { data: performanceRows, error: performanceError } = await supabase
    .from("exercise_performances")
    .insert(performanceInsertPayload)
    .select("id, exercise_id, exercise_order");

  if (performanceError) {
    throw performanceError;
  }

  const insertedPerformanceRows = assertExists(
    performanceRows,
    "Exercise performances were not returned after insert",
  );

  const setInsertPayload = insertedPerformanceRows.flatMap((performanceRow) => {
    const templateExercise = assertExists(
      orderedExercises.find((item) => item.exerciseId === performanceRow.exercise_id),
      "Template exercise missing while building sets",
    );
    const previousPerformance = latestByExerciseId.get(templateExercise.exerciseId) ?? null;
    const recommendation = getRecommendation(templateExercise, previousPerformance);

    return Array.from({ length: templateExercise.targetSets }, (_, index) => {
      const setNumber = index + 1;
      const previousSet =
        previousPerformance?.loggedSets.find((set) => set.setNumber === setNumber) ?? null;
      const initial = buildInitialLoggedSet(
        templateExercise,
        recommendation,
        previousSet,
        setNumber,
      );

      return {
        exercise_performance_id: performanceRow.id,
        set_number: setNumber,
        load_value: initial.loadValue,
        reps: initial.reps,
        seconds: initial.seconds,
        completed: initial.completed,
      };
    });
  });

  const { error: setError } = await supabase.from("logged_sets").insert(setInsertPayload);

  if (setError) {
    throw setError;
  }

  return fetchWorkoutSession(sessionRecord.id, userId);
}

export async function updateLoggedSet(
  setId: string,
  values: Partial<Pick<LoggedSet, "loadValue" | "reps" | "seconds" | "completed">>,
) {
  const { error } = await supabase
    .from("logged_sets")
    .update({
      load_value: values.loadValue,
      reps: values.reps,
      seconds: values.seconds,
      completed: values.completed,
    })
    .eq("id", setId);

  if (error) {
    throw error;
  }
}

export async function completeExercise(
  userId: string,
  sessionId: string,
  performanceId: string,
) {
  const { error } = await supabase
    .from("exercise_performances")
    .update({
      completion_status: "completed",
    })
    .eq("id", performanceId);

  if (error) {
    throw error;
  }

  let session = await fetchWorkoutSession(sessionId, userId);

  if (session.performances.every((performance) => performance.completionStatus === "completed")) {
    const { error: sessionError } = await supabase
      .from("workout_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (sessionError) {
      throw sessionError;
    }

    session = await fetchWorkoutSession(sessionId, userId);
  }

  return session;
}

export async function fetchExerciseDetail(
  userId: string,
  exerciseId: string,
): Promise<ExerciseDetailData> {
  const [exercise, templates, completedSessions] = await Promise.all([
    fetchExercise(exerciseId),
    fetchTemplates(),
    fetchCompletedWorkouts(userId, 30),
  ]);

  const templateExercise =
    templates.flatMap((template) => template.exercises).find((item) => item.exerciseId === exerciseId) ??
    null;
  const recentPerformances = findExerciseHistory(completedSessions, exerciseId);
  const latestPerformance = recentPerformances[0]?.performance ?? null;
  const recommendation =
    templateExercise != null
      ? getRecommendation(templateExercise, latestPerformance)
      : {
          recommendedLoadValue: null,
          recommendedSecondsValue: null,
          recommendationText: "No template slot found for this exercise.",
        };

  return {
    exercise,
    templateExercise,
    recentPerformances,
    currentRecommendationText: recommendation.recommendationText,
    currentRecommendationLoad: recommendation.recommendedLoadValue,
    currentRecommendationSeconds: recommendation.recommendedSecondsValue,
  };
}
