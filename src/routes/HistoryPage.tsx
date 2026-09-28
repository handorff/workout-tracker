import { useState } from "react";
import { Link } from "react-router-dom";

import { summarizeSet, formatDurationMinutes, formatWorkoutDate } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import {
  useCompletedWorkouts,
  useDeleteWorkoutSession,
} from "../features/workouts/hooks";


export function HistoryPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const historyQuery = useCompletedWorkouts(userId, undefined, month);
  const deleteWorkout = useDeleteWorkoutSession(userId);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removingSessionId, setRemovingSessionId] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  async function handleRemoveWorkout(sessionId: string) {
    const confirmed = window.confirm(
      "Remove this workout from your history permanently? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setRemovingSessionId(sessionId);

    try {
      await deleteWorkout.mutateAsync(sessionId);
    } catch {
      setDeleteError("That workout could not be removed. Try again.");
    } finally {
      setRemovingSessionId(null);
    }
  }

  const sessions = historyQuery.data ?? [];
  const today = new Date();
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const sessionsByDay = new Map<number, typeof sessions>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    const date = new Date(session.completedAt);
    if (date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth()) continue;
    const day = date.getDate();
    sessionsByDay.set(day, [...(sessionsByDay.get(day) ?? []), session]);
  }
  const activeDay = selectedDay ?? (sessionsByDay.size ? Math.max(...sessionsByDay.keys()) : null);
  const selectedSessions = activeDay === null ? [] : sessionsByDay.get(activeDay) ?? [];
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const visitCount = [...sessionsByDay.keys()].filter((day) => day <= daysElapsed).length;
  const weeklyAverage = (visitCount * 7 / daysElapsed).toFixed(1);
  function changeMonth(offset: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelectedDay(null);
    setDeleteError(null);
  }

  return (
    <main className="page-shell gap-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">History</h1>
          <Link className="secondary-button h-11 px-4 text-sm" to="/today">
            Today
          </Link>
        </div>
      </header>

      <section className="card space-y-4 p-3 sm:p-4" aria-label="Workout calendar">
        <div className="flex items-center justify-between gap-2">
          <button className="secondary-button h-11 w-11 px-0" aria-label="Previous month" onClick={() => changeMonth(-1)} type="button">‹</button>
          <div className="text-center" aria-live="polite">
            <h2 className="text-lg font-bold">{monthLabel}</h2>
            {!historyQuery.isLoading && !historyQuery.isError && <p className="mt-1 text-sm text-muted">{weeklyAverage} visits/week{isCurrentMonth ? " so far" : " on average"}</p>}
          </div>
          <button className="secondary-button h-11 w-11 px-0 disabled:opacity-30" aria-label="Next month" disabled={isCurrentMonth} onClick={() => changeMonth(1)} type="button">›</button>
        </div>
        {!isCurrentMonth && <button className="text-sm font-semibold underline" type="button" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); }}>This month</button>}
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day} className="py-2 text-xs text-muted">{day}</span>)}
          {Array.from({ length: month.getDay() }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const workouts = sessionsByDay.get(day) ?? [];
            const workoutLabels = [...new Set(workouts.map(({ template }) =>
              template.name === "Workout A" ? "A" : template.name === "Workout B" ? "B" : template.name === "Cardio" ? "C" : "•",
            ))].sort().join(" ");
            const dateLabel = new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
            return <button key={day} type="button"
              aria-label={`${dateLabel}: ${workouts.length ? workouts.map(workout => workout.template.name).join(", ") : "No workouts"}`}
              aria-pressed={activeDay === day}
              aria-current={isCurrentMonth && today.getDate() === day ? "date" : undefined}
              disabled={historyQuery.isLoading || historyQuery.isError}
              onClick={() => setSelectedDay(day)}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg border text-sm ${activeDay === day ? "border-ink ring-1 ring-ink" : "border-transparent"} ${workouts.length ? "bg-accent font-bold" : "hover:border-line"}`}
            ><span className={`flex h-7 w-7 items-center justify-center rounded-full ${isCurrentMonth && today.getDate() === day ? "bg-ink font-bold text-white" : ""}`}>{day}</span>
              <span className="h-3 text-[10px] leading-3" aria-hidden="true">{workoutLabels}</span>
            </button>;
          })}
        </div>
        {historyQuery.isLoading ? <p role="status" className="text-sm">Loading completed workouts...</p> : historyQuery.isError ? <p role="alert" className="text-sm">Workout history could not be loaded. <button type="button" className="underline" onClick={() => historyQuery.refetch()}>Try again</button></p> : null}
      </section>

      {deleteError ? (
        <section className="card border-ink p-4">
          <p className="text-sm font-semibold text-ink">{deleteError}</p>
        </section>
      ) : null}

      <div className="space-y-3">
        {!historyQuery.isLoading && !historyQuery.isError && sessions.length === 0 ? (
          <section className="card space-y-3 p-5">
            <h2 className="text-2xl font-bold text-ink">No workouts this month</h2>
            <p className="text-sm leading-6 text-muted">
              Completed workouts will appear on the calendar. You can browse previous months above.
            </p>
            <div>
              <Link className="secondary-button h-11 px-4 text-sm" to="/today">
                Back to Today
              </Link>
            </div>
          </section>
        ) : null}

        {!historyQuery.isLoading && !historyQuery.isError && activeDay !== null && <h2 className="section-label">{month.toLocaleDateString("en-US", { month: "long" })} {activeDay}</h2>}
        {!historyQuery.isLoading && !historyQuery.isError && activeDay !== null && selectedSessions.length === 0 && sessions.length > 0 && <p className="card p-5 text-sm">No workouts on this day.</p>}
        {selectedSessions.map((session) => (
          <section key={session.id} className="card space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-ink">
                  {formatWorkoutDate(session.completedAt)} •{" "}
                  {formatDurationMinutes(session.startedAt, session.completedAt) ?? "In progress"}
                </h2>
                <p className="text-sm text-muted">{session.template.name}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  className="text-sm font-semibold text-muted underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={deleteWorkout.isPending && removingSessionId === session.id}
                  onClick={() => handleRemoveWorkout(session.id)}
                  type="button"
                >
                  {deleteWorkout.isPending && removingSessionId === session.id
                    ? "Removing..."
                    : "Remove"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {[...session.performances]
                .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
                .map((performance) => {
                  const isAssistance = performance.exercise.loadMode === "assistance";
                  const setSummary = [...performance.loggedSets]
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((set) =>
                      summarizeSet(set, performance.exercise.unit, isAssistance),
                    )
                    .filter(Boolean)
                    .join(" / ");

                  return (
                    <Link
                      key={performance.id}
                      className="block underline-offset-4 hover:underline"
                      to={`/exercises/${performance.exerciseId}?workout=${session.workoutTemplateId}`}
                    >
                      <span className="block text-sm font-semibold leading-5 text-ink">
                        {performance.exercise.name}
                      </span>
                      {setSummary && (
                        <span className="block text-sm leading-6 text-muted">
                          {setSummary}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
