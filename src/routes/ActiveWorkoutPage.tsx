import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
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

interface SetRowProps {
  set: LoggedSet;
  unit: string;
  loadMode: "weight" | "assistance" | "bodyweight";
  defaultLoadValue: number | null;
  loadStep: number;
  onSave: (setId: string, patch: Partial<LoggedSet>) => void;
}

type AdjustableField = "load" | "reps" | "seconds";

interface DragState {
  field: AdjustableField;
  startValue: number;
  startY: number;
  step: number;
  value: number;
}

const pixelsPerDragStep = 14;

function formatDraggedNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function SetRow({ set, unit, loadMode, defaultLoadValue, loadStep, onSave }: SetRowProps) {
  const initialLoadValue = set.loadValue ?? defaultLoadValue;
  const [load, setLoad] = useState(initialLoadValue?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const [seconds, setSeconds] = useState(set.seconds?.toString() ?? "");
  const [completed, setCompleted] = useState(set.completed);
  const dragState = useRef<DragState | null>(null);

  useEffect(() => {
    setLoad(initialLoadValue?.toString() ?? "");
    setReps(set.reps?.toString() ?? "");
    setSeconds(set.seconds?.toString() ?? "");
    setCompleted(set.completed);
  }, [initialLoadValue, set.completed, set.id, set.reps, set.seconds]);

  function handleToggleCompleted() {
    const nextCompleted = !completed;
    setCompleted(nextCompleted);

    onSave(set.id, {
      completed: nextCompleted,
      loadValue: loadMode === "bodyweight" || load === "" ? null : Number(load),
      reps: reps === "" ? null : Number(reps),
      seconds: seconds === "" ? null : Number(seconds),
    });
  }

  function getFieldValue(field: AdjustableField) {
    const value = field === "load" ? load : field === "reps" ? reps : seconds;
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function setFieldValue(field: AdjustableField, value: number) {
    const formattedValue = formatDraggedNumber(value);

    if (field === "load") {
      setLoad(formattedValue);
    } else if (field === "reps") {
      setReps(formattedValue);
    } else {
      setSeconds(formattedValue);
    }
  }

  function beginDrag(field: AdjustableField, step: number, startY: number) {
    const startValue = getFieldValue(field);
    dragState.current = {
      field,
      startValue,
      startY,
      step,
      value: startValue,
    };
  }

  function updateDrag(clientY: number) {
    const currentDragState = dragState.current;

    if (!currentDragState) {
      return;
    }

    const stepDelta = Math.trunc((currentDragState.startY - clientY) / pixelsPerDragStep);
    const nextValue = Math.max(0, currentDragState.startValue + stepDelta * currentDragState.step);

    if (nextValue !== currentDragState.value) {
      currentDragState.value = nextValue;
      setFieldValue(currentDragState.field, nextValue);
    }
  }

  function commitDrag() {
    dragState.current = null;
  }

  function handleMouseDragStart(
    field: AdjustableField,
    step: number,
    event: MouseEvent<HTMLInputElement>,
  ) {
    if (completed) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    beginDrag(field, step, event.clientY);

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      moveEvent.preventDefault();
      updateDrag(moveEvent.clientY);
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      commitDrag();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleTouchDragStart(
    field: AdjustableField,
    step: number,
    event: TouchEvent<HTMLInputElement>,
  ) {
    if (completed) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    beginDrag(field, step, touch.clientY);

    const handleTouchMove = (moveEvent: globalThis.TouchEvent) => {
      const nextTouch = moveEvent.touches[0];

      if (!nextTouch) {
        return;
      }

      moveEvent.preventDefault();
      updateDrag(nextTouch.clientY);
    };
    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      commitDrag();
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        completed ? "border-ink" : "border-line"
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_64px_20px] items-center gap-3">
        {loadMode !== "bodyweight" && (
          <div className="min-w-0">
            <label className="section-label">Load</label>
            <div className="mt-1 flex h-10 items-center rounded-md border border-line bg-transparent">
              <input
                className={`h-full min-w-0 flex-1 touch-none rounded-md bg-transparent px-3 outline-none ${
                  completed ? "cursor-not-allowed text-muted" : "cursor-ns-resize"
                }`}
                disabled={completed}
                aria-label={`Set ${set.setNumber} Load (${unit})`}
                inputMode="decimal"
                value={load}
                onChange={(event) => setLoad(event.target.value)}
                onMouseDown={(event) => handleMouseDragStart("load", loadStep, event)}
                onTouchStart={(event) => handleTouchDragStart("load", loadStep, event)}
              />
              <span className="pr-3 text-sm font-semibold text-muted">
                {loadMode === "assistance" ? "assist" : unit}
              </span>
            </div>
          </div>
        )}
        {set.reps != null && (
          <div className="min-w-0">
            <label className="section-label">Reps</label>
            <input
              className={`mt-1 h-10 w-full touch-none rounded-md border border-line bg-transparent px-3 ${
                completed ? "cursor-not-allowed text-muted" : "cursor-ns-resize"
              }`}
              disabled={completed}
              aria-label={`Set ${set.setNumber} Reps`}
              inputMode="numeric"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              onMouseDown={(event) => handleMouseDragStart("reps", 1, event)}
              onTouchStart={(event) => handleTouchDragStart("reps", 1, event)}
            />
          </div>
        )}
        {set.seconds != null && (
          <div className="min-w-0">
            <label className="section-label">Seconds</label>
            <input
              className={`mt-1 h-10 w-full touch-none rounded-md border border-line bg-transparent px-3 ${
                completed ? "cursor-not-allowed text-muted" : "cursor-ns-resize"
              }`}
              disabled={completed}
              aria-label={`Set ${set.setNumber} Seconds`}
              inputMode="numeric"
              value={seconds}
              onChange={(event) => setSeconds(event.target.value)}
              onMouseDown={(event) => handleMouseDragStart("seconds", 5, event)}
              onTouchStart={(event) => handleTouchDragStart("seconds", 5, event)}
            />
          </div>
        )}
        <button
          className={`mt-5 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[13px] font-bold leading-none ${
            completed ? "border-ink bg-accent" : "border-ink"
          }`}
          aria-label={`Set ${set.setNumber} completed`}
          aria-pressed={completed}
          onClick={handleToggleCompleted}
          type="button"
        >
          {completed ? "✓" : ""}
        </button>
      </div>
    </div>
  );
}

function CompletedSets({ sets, unit, loadMode, defaultLoadValue, loadStep, onSave }: {
  sets: LoggedSet[];
  defaultLoadValue: number | null;
  loadStep: number;
  unit: string;
  loadMode: "weight" | "assistance" | "bodyweight";
  onSave: (setId: string, patch: Partial<LoggedSet>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSets, setSavedSets] = useState(sets);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => { setSavedSets(sets); }, [sets]);

  async function save(setId: string, patch: Partial<LoggedSet>) {
    setSaving(true);
    setError(null);
    try {
      await onSave(setId, patch);
      setSavedSets((current) => current.map((set) => set.id === setId ? { ...set, ...patch } : set));
    } catch {
      setError("This set could not be saved. Please check it off again to retry.");
      setResetVersion((version) => version + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">{editing ? "Edit sets" : "Completed"}</h2>
        <button className="text-sm font-semibold underline underline-offset-4" type="button"
          disabled={saving} onClick={() => { setEditing(!editing); setError(null); }}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing ? (
        <fieldset disabled={saving} className="space-y-3">
          {savedSets.map((set) => (
            <SetRow key={`${set.id}-${resetVersion}`} set={set} unit={unit} loadMode={loadMode}
              defaultLoadValue={defaultLoadValue} loadStep={loadStep} onSave={save} />
          ))}
          {error && <p role="alert" className="text-sm font-semibold">{error}</p>}
        </fieldset>
      ) : (
        <div className="card space-y-3 p-4">
          <h3 className="section-label">Sets</h3>
          {savedSets.map((set) => (
            <p key={set.id} className="text-sm">
              {set.completed ? summarizeSet(set, unit, loadMode === "assistance") : (
                <span className="line-through">
                  {[
                    set.loadValue != null ? `${set.loadValue} ${unit}` : null,
                    set.reps != null ? "0" : null,
                    set.seconds != null ? "0s" : null,
                  ].filter((value) => value !== null).join(" x ")}
                </span>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

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
