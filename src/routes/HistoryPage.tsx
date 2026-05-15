import { useState } from "react";
import { Link } from "react-router-dom";

import { summarizeSet, formatDurationMinutes, formatWorkoutDate } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import {
  useCompletedWorkouts,
  useDeleteWorkoutSession,
} from "../features/workouts/hooks";
import { StatusView } from "../components/StatusView";

export function HistoryPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const historyQuery = useCompletedWorkouts(userId);
  const deleteWorkout = useDeleteWorkoutSession(userId);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removingSessionId, setRemovingSessionId] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  if (historyQuery.isLoading) {
    return <StatusView title="History" message="Loading completed workouts..." />;
  }

  if (historyQuery.isError) {
    return <StatusView title="History" message="Workout history could not be loaded." />;
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

      {deleteError ? (
        <section className="card border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{deleteError}</p>
        </section>
      ) : null}

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <section className="card space-y-3 p-5">
            <h2 className="text-2xl font-bold text-ink">No completed workouts yet</h2>
            <p className="text-sm leading-6 text-muted">
              Once you finish a workout, it will show up here.
            </p>
            <div>
              <Link className="secondary-button h-11 px-4 text-sm" to="/today">
                Back to Today
              </Link>
            </div>
          </section>
        ) : null}

        {sessions.map((session) => (
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
              {session.performances
                .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
                .map((performance) => {
                  const isAssistance = performance.exercise.loadMode === "assistance";
                  const setSummary = performance.loggedSets
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
                      to={`/exercises/${performance.exerciseId}`}
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
