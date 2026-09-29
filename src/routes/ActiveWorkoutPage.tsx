import { CompletedSets, SetRow } from "../components/WorkoutSets";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { formatLoad, formatRange, summarizeSet } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import {
  useCompleteExercise,
  useFinishCardioWorkout,
  useCompletedWorkouts,
  useUpdateLoggedSet,
  useWorkoutSession,
} from "../features/workouts/hooks";
import type { LoggedSet } from "../types/domain";
import { CardioEntry } from "../components/CardioEntry";
import { isCardioWorkout } from "../features/workouts/logic";
import { StatusView } from "../components/StatusView";

export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saveError, setSaveError] = useState<string | null>(null);
  const { sessionId = "" } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const sessionQuery = useWorkoutSession(userId, sessionId);
  const historyQuery = useCompletedWorkouts(userId, sessionQuery.data?.workoutTemplateId);
  const updateSet = useUpdateLoggedSet(userId, sessionId);
  const completeCurrentExercise = useCompleteExercise(userId, sessionId);
  const finishCardio = useFinishCardioWorkout(userId, sessionId);

  const session = sessionQuery.data;
  const currentPerformance = session?.performances.find(
    (performance) => performance.exerciseId === searchParams.get("exercise"),
  );
  const currentTemplateExercise = useMemo(
    () =>
      session?.template.exercises.find(
        (item) => item.exerciseId === currentPerformance?.exerciseId,
      ) ?? null,
    [currentPerformance?.exerciseId, session],
  );
  const completedCount = useMemo(
    () =>
      session?.performances.filter((performance) => performance.completionStatus === "completed")
        .length ?? 0,
    [session],
  );
  const previousPerformance = useMemo(() => {
    if (!currentPerformance || !historyQuery.data) {
      return null;
    }

    return (
      historyQuery.data
        .filter((completedSession) => completedSession.completedAt !== null && completedSession.workoutTemplateId === session?.workoutTemplateId)
        .find((completedSession) =>
          completedSession.performances.some(
            (performance) => performance.exerciseId === currentPerformance.exerciseId,
          ),
        )
        ?.performances.find(
          (performance) => performance.exerciseId === currentPerformance.exerciseId,
        ) ?? null
    );
  }, [currentPerformance, historyQuery.data, session?.workoutTemplateId]);

  useEffect(() => {
    if (session?.status === "completed") {
      navigate(`/workout/${session.id}/complete`, { replace: true });
    }
  }, [navigate, session]);

  if (!user) {
    return null;
  }

  if (sessionQuery.isLoading) {
    return <StatusView title="Workout" message="Loading your active session..." />;
  }

  if (sessionQuery.isError || !session) {
    return (
      <StatusView
        title="Workout"
        message="This workout could not be loaded. Start or resume a session from Today."
      />
    );
  }

  const cardio = isCardioWorkout(session.template);
  async function handleFinishCardio() {
    setSaveError(null);
    try {
      const saved = await finishCardio.mutateAsync();
      navigate(`/workout/${saved.id}/complete`);
    } catch { setSaveError("This workout could not be finished. Please try again."); }
  }

  if (!currentPerformance) {
    return (
      <main className="page-shell gap-5">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="page-title">{session.template.name}</h1>
            <p className="text-sm">{completedCount} of {session.performances.length} completed</p>
          </div>
          <Link className="secondary-button h-11 px-4 text-sm" to="/today">Today</Link>
        </header>
        <p className="text-sm leading-6">{cardio ? "Choose any activity. You can finish without doing every option." : "Choose any exercise to start or continue."}</p>
        {session.template.warmupNotes && (
          <section className="card space-y-2 p-5">
            <h2 className="section-label">Warm-up</h2>
            <p className="text-sm leading-6">{session.template.warmupNotes}</p>
          </section>
        )}
        <section className="space-y-3" aria-label="Exercises">
          {[...session.performances].sort((a, b) => a.exerciseOrder - b.exerciseOrder).map((performance) => {
            const completed = performance.completionStatus === "completed";
            const setsDone = performance.loggedSets.filter((set) => set.completed).length;
            const status = completed ? "Completed" : setsDone > 0 ? "In progress" : "Not started";
            return (
              <Link
                key={performance.id}
                className="card flex items-center justify-between gap-4 p-5 transition-colors hover:border-ink"
                to={`/workout/${session.id}?exercise=${performance.exerciseId}`}
              >
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">{performance.exercise.name}</h2>
                  <p className="text-sm">{cardio ? performance.loggedSets.map((set) => summarizeSet(set, "minutes")).filter(Boolean).join(" / ") || "Optional · minutes" : `${setsDone} of ${performance.loggedSets.length} sets logged`}</p>
                  <p className="text-xs font-semibold">{status}</p>
                </div>
                <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink ${completed ? "bg-accent" : ""}`}>
                  {completed ? "✓" : "→"}
                </span>
              </Link>
            );
          })}
        </section>
        {saveError && <p role="alert" className="text-sm font-semibold">{saveError}</p>}
        {cardio && <button className="primary-button w-full" disabled={finishCardio.isPending} onClick={handleFinishCardio}>
          {finishCardio.isPending ? "Finishing..." : "Finish Cardio"}
        </button>}
      </main>
    );
  }

  const activePerformance = currentPerformance;

  async function handleSave(setId: string, patch: Partial<LoggedSet>) {
    await updateSet.mutateAsync({
      setId,
      values: patch,
    });
  }

  async function handleCompleteExercise() {
    setSaveError(null);
    try {
      const updatedSession = await completeCurrentExercise.mutateAsync(activePerformance.id);
      navigate(updatedSession.status === "completed"
        ? `/workout/${updatedSession.id}/complete`
        : `/workout/${sessionId}`);
    } catch {
      setSaveError("This exercise could not be completed. Please try again.");
    }
  }

  if (cardio) {
    return (
      <main className="page-shell gap-5">
        <Link className="text-sm font-semibold underline underline-offset-4" to={`/workout/${session.id}`}>All exercises</Link>
        <header className="space-y-2">
          <p className="section-label">Cardio</p>
          <h1 className="page-title">{activePerformance.exercise.name}</h1>
          <p className="text-sm">{activePerformance.exercise.equipment}</p>
        </header>
        <p className="text-sm leading-6">Record your time in minutes. Choose another activity or finish from the workout list.</p>
        <CardioEntry key={activePerformance.id}
          initialSeconds={activePerformance.loggedSets[0]?.completed ? activePerformance.loggedSets[0].seconds : null}
          onSave={async (seconds) => {
            const set = activePerformance.loggedSets[0];
            if (!set) throw new Error("Activity log missing");
            await updateSet.mutateAsync({ setId: set.id, values: { seconds, completed: true } });
            const saved = await completeCurrentExercise.mutateAsync(activePerformance.id);
            navigate(saved.status === "completed" ? `/workout/${saved.id}/complete` : `/workout/${session.id}`);
          }}
        />
        <Link className="secondary-button" to={`/workout/${session.id}/help/${activePerformance.exerciseId}`}>Exercise help</Link>
      </main>
    );
  }

  const targetText =
    activePerformance.exercise.loadMode === "bodyweight"
      ? activePerformance.recommendedSecondsValue != null
        ? `${activePerformance.recommendedSecondsValue}s`
        : formatRange(currentTemplateExercise?.targetRepMin ?? null, currentTemplateExercise?.targetRepMax ?? null)
      : formatLoad(
          activePerformance.recommendedLoadValue,
          activePerformance.exercise.unit,
          activePerformance.exercise.loadMode === "assistance",
        );
  const targetRangeText = currentTemplateExercise
    ? currentTemplateExercise.targetSecondsMin != null
      ? formatRange(
          currentTemplateExercise.targetSecondsMin,
          currentTemplateExercise.targetSecondsMax,
          "s",
        )
      : formatRange(currentTemplateExercise.targetRepMin, currentTemplateExercise.targetRepMax)
    : "";
  const targetPrescriptionText = `${currentTemplateExercise?.targetSets ?? 0} sets of ${targetRangeText}`;

  return (
    <main className="page-shell gap-4">
      <Link className="text-sm font-semibold underline underline-offset-4" to={`/workout/${session.id}`}>All exercises</Link>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">{activePerformance.exercise.name}</h1>
        </div>
        <span className="shrink-0 rounded-md border border-line px-4 py-2 text-sm font-bold text-ink">
          {completedCount}/{session.performances.length} done
        </span>
      </header>

      <section className="space-y-4">
        <div className="space-y-4">
          <div>
            <p className="section-label">Target</p>
            <div className="mt-1 flex items-baseline justify-between gap-4">
              <p className="text-4xl font-bold text-ink">{targetText}</p>
              <p className="text-right text-sm font-semibold text-muted">
                {targetPrescriptionText}
              </p>
            </div>
          </div>
          <div>
            <p className="section-label">Last time</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-ink">
              {previousPerformance?.loggedSets
                .map((set) =>
                  summarizeSet(
                    set,
                    activePerformance.exercise.unit,
                    activePerformance.exercise.loadMode === "assistance",
                  ),
                )
                .filter(Boolean)
                .join(" / ")}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {activePerformance.completionStatus !== "completed" && (
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-ink">Log sets</h2>
          </div>
        )}
        <div className="space-y-3">
          {activePerformance.completionStatus === "completed" ? (
            <CompletedSets key={activePerformance.id} sets={activePerformance.loggedSets}
              unit={activePerformance.exercise.unit} loadMode={activePerformance.exercise.loadMode}
              defaultLoadValue={activePerformance.recommendedLoadValue}
              loadStep={currentTemplateExercise?.progressionIncrement ?? activePerformance.exercise.defaultIncrement ?? 5}
              onSave={handleSave} />
          ) : activePerformance.loggedSets.map((set) => (
            <SetRow
              key={set.id}
              defaultLoadValue={activePerformance.recommendedLoadValue}
              loadStep={
                currentTemplateExercise?.progressionIncrement ??
                activePerformance.exercise.defaultIncrement ??
                5
              }
              loadMode={activePerformance.exercise.loadMode}
              onSave={handleSave}
              set={set}
              unit={activePerformance.exercise.unit}
            />
          ))}
        </div>
      </section>

      {saveError && <p role="alert" className="text-sm font-semibold">{saveError}</p>}

      <div className="mt-auto flex gap-3">
        <Link
          className="secondary-button h-[60px] w-[64px] px-0 text-2xl"
          to={`/workout/${session.id}/help/${activePerformance.exerciseId}`}
        >
          ?
        </Link>
        {activePerformance.completionStatus === "completed" ? (
          <Link className="primary-button flex-1" to={`/workout/${session.id}`}>All exercises</Link>
        ) : <button
          className="primary-button flex-1"
          disabled={completeCurrentExercise.isPending || updateSet.isPending}
          onClick={handleCompleteExercise}
        >
          {completeCurrentExercise.isPending ? "Saving..." : "Complete Exercise"}
        </button>}
      </div>
    </main>
  );
}
