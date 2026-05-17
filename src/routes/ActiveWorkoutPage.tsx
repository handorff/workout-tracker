import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatLoad, formatRange, summarizeSet } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import {
  useCompleteExercise,
  useCompletedWorkouts,
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
      className={`rounded-2xl p-4 transition ${
        completed ? "bg-success/10" : "bg-black/[0.03]"
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_64px_20px] items-center gap-3">
        {loadMode !== "bodyweight" && (
          <div className="min-w-0">
            <label className="section-label">Load</label>
            <div className="mt-1 flex h-10 items-center rounded-xl border border-line bg-card">
              <input
                className={`h-full min-w-0 flex-1 touch-none rounded-xl bg-transparent px-3 outline-none ${
                  completed ? "cursor-not-allowed text-muted" : "cursor-ns-resize"
                }`}
                disabled={completed}
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
              className={`mt-1 h-10 w-full touch-none rounded-xl border border-line bg-card px-3 ${
                completed ? "cursor-not-allowed text-muted" : "cursor-ns-resize"
              }`}
              disabled={completed}
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
              className={`mt-1 h-10 w-full touch-none rounded-xl border border-line bg-card px-3 ${
                completed ? "cursor-not-allowed text-muted" : "cursor-ns-resize"
              }`}
              disabled={completed}
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
            completed ? "border-success bg-success" : "border-accent"
          }`}
          onClick={handleToggleCompleted}
          type="button"
        >
          {completed ? "✓" : ""}
        </button>
      </div>
    </div>
  );
}

export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const { sessionId = "" } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const sessionQuery = useWorkoutSession(userId, sessionId);
  const historyQuery = useCompletedWorkouts(userId);
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
  const previousPerformance = useMemo(() => {
    if (!currentPerformance || !historyQuery.data) {
      return null;
    }

    return (
      historyQuery.data
        .filter((completedSession) => completedSession.completedAt !== null)
        .find((completedSession) =>
          completedSession.performances.some(
            (performance) => performance.exerciseId === currentPerformance.exerciseId,
          ),
        )
        ?.performances.find(
          (performance) => performance.exerciseId === currentPerformance.exerciseId,
        ) ?? null
    );
  }, [currentPerformance, historyQuery.data]);

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
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">{activePerformance.exercise.name}</h1>
        </div>
        <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-mist">
          {completedCount + 1}/{session.performances.length}
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">Log sets</h2>
        </div>
        <div className="space-y-3">
          {activePerformance.loggedSets.map((set) => (
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

      {nextPerformance && (
        <section>
          <p className="text-lg font-semibold text-ink">
            <span className="text-muted">Up next:</span> {nextPerformance.exercise.name}
          </p>
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
