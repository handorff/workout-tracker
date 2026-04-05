import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatLoad, formatRange } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import {
  useCompleteExercise,
  useUpdateLoggedSet,
  useWorkoutSession,
} from "../features/workouts/hooks";
import { getCurrentPerformance, getNextPerformance } from "../features/workouts/logic";
import type { LoggedSet } from "../types/domain";
import { StatusView } from "../components/StatusView";

interface SetRowProps {
  set: LoggedSet;
  unit: string;
  loadMode: "weight" | "assistance" | "bodyweight";
  onSave: (setId: string, patch: Partial<LoggedSet>) => void;
}

function SetRow({ set, unit, loadMode, onSave }: SetRowProps) {
  const [load, setLoad] = useState(set.loadValue?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const [seconds, setSeconds] = useState(set.seconds?.toString() ?? "");

  useEffect(() => {
    setLoad(set.loadValue?.toString() ?? "");
    setReps(set.reps?.toString() ?? "");
    setSeconds(set.seconds?.toString() ?? "");
  }, [set.id, set.loadValue, set.reps, set.seconds]);

  return (
    <div className="rounded-2xl bg-black/[0.03] p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
            set.setNumber === 3 ? "bg-accent text-mist" : "bg-ink text-mist"
          }`}
        >
          {set.setNumber}
        </div>
        {loadMode !== "bodyweight" && (
          <div className="flex-1">
            <label className="section-label">Load</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3"
              inputMode="decimal"
              value={load}
              onBlur={() =>
                onSave(set.id, {
                  loadValue: load === "" ? null : Number(load),
                })
              }
              onChange={(event) => setLoad(event.target.value)}
            />
          </div>
        )}
        {set.reps != null && (
          <div className="flex-1">
            <label className="section-label">Reps</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3"
              inputMode="numeric"
              value={reps}
              onBlur={() =>
                onSave(set.id, {
                  reps: reps === "" ? null : Number(reps),
                })
              }
              onChange={(event) => setReps(event.target.value)}
            />
          </div>
        )}
        {set.seconds != null && (
          <div className="flex-1">
            <label className="section-label">Seconds</label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3"
              inputMode="numeric"
              value={seconds}
              onBlur={() =>
                onSave(set.id, {
                  seconds: seconds === "" ? null : Number(seconds),
                })
              }
              onChange={(event) => setSeconds(event.target.value)}
            />
          </div>
        )}
        <button
          className={`mt-5 h-5 w-5 rounded-full border-2 ${
            set.completed ? "border-success bg-success" : "border-accent"
          }`}
          onClick={() => onSave(set.id, { completed: !set.completed })}
          type="button"
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        {loadMode === "assistance" ? "Assistance" : unit}
      </p>
    </div>
  );
}

export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const { sessionId = "" } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const sessionQuery = useWorkoutSession(userId, sessionId);
  const updateSet = useUpdateLoggedSet(userId, sessionId);
  const completeCurrentExercise = useCompleteExercise(userId, sessionId);

  const session = sessionQuery.data;
  const currentPerformance = session ? getCurrentPerformance(session) : null;
  const nextPerformance = session ? getNextPerformance(session) : null;
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

  if (sessionQuery.isError || !session || !currentPerformance) {
    return (
      <StatusView
        title="Workout"
        message="This workout could not be loaded. Start or resume a session from Today."
      />
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
    const updatedSession = await completeCurrentExercise.mutateAsync(activePerformance.id);

    if (updatedSession.status === "completed") {
      navigate(`/workout/${updatedSession.id}/complete`);
    }
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

  return (
    <main className="page-shell gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="section-label">{session.template.name}</p>
          <h1 className="page-title">{activePerformance.exercise.name}</h1>
          <p className="text-sm text-muted">
            {currentTemplateExercise?.targetSets ?? 0}{" "}
            x{" "}
            {currentTemplateExercise
              ? currentTemplateExercise.targetSecondsMin != null
                ? formatRange(
                    currentTemplateExercise.targetSecondsMin,
                    currentTemplateExercise.targetSecondsMax,
                    "s",
                  )
                : formatRange(
                    currentTemplateExercise.targetRepMin,
                    currentTemplateExercise.targetRepMax,
                  )
              : ""}
          </p>
        </div>
        <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-mist">
          {completedCount + 1}/{session.performances.length}
        </span>
      </header>

      <section className="card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label">Target</p>
            <p className="mt-1 text-4xl font-bold text-ink">{targetText}</p>
          </div>
          <div className="text-right">
            <p className="section-label">Last time</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {activePerformance.loggedSets
                .map((set) => set.reps ?? set.seconds ?? "—")
                .join(" / ")}
            </p>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted">{activePerformance.recommendationText}</p>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">Log sets</h2>
          <span className="text-sm text-muted">changes save on blur</span>
        </div>
        <div className="space-y-3">
          {activePerformance.loggedSets.map((set) => (
            <SetRow
              key={set.id}
              loadMode={activePerformance.exercise.loadMode}
              onSave={handleSave}
              set={set}
              unit={activePerformance.exercise.unit}
            />
          ))}
        </div>
      </section>

      {nextPerformance && (
        <section className="card space-y-2 p-5">
          <p className="font-display text-2xl font-bold text-ink">Up next</p>
          <p className="text-lg font-semibold text-ink">{nextPerformance.exercise.name}</p>
          <p className="text-sm text-muted">{nextPerformance.recommendationText}</p>
        </section>
      )}

      <div className="mt-auto flex gap-3">
        <Link
          className="secondary-button h-[60px] w-[64px] px-0 text-2xl"
          to={`/workout/${session.id}/help/${activePerformance.exerciseId}`}
        >
          ?
        </Link>
        <button
          className="primary-button flex-1"
          disabled={completeCurrentExercise.isPending}
          onClick={handleCompleteExercise}
        >
          {completeCurrentExercise.isPending ? "Saving..." : "Complete Exercise"}
        </button>
      </div>
    </main>
  );
}
