import { useEffect, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import type { LoggedSet } from "../types/domain";
import { summarizeSet } from "../lib/format";

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

export function SetRow({ set, unit, loadMode, defaultLoadValue, loadStep, onSave }: SetRowProps) {
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

export function CompletedSets({ sets, unit, loadMode, defaultLoadValue, loadStep, onSave, initiallyEditing = false, onDone }: {
  initiallyEditing?: boolean;
  onDone?: () => void;
  sets: LoggedSet[];
  defaultLoadValue: number | null;
  loadStep: number;
  unit: string;
  loadMode: "weight" | "assistance" | "bodyweight";
  onSave: (setId: string, patch: Partial<LoggedSet>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
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
          disabled={saving} onClick={() => {
            setError(null);
            if (editing && onDone) {
              onDone();
            } else {
              setEditing(!editing);
            }
          }}>
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

