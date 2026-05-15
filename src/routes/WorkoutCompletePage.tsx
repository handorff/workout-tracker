import { useNavigate, useParams } from "react-router-dom";

import { formatDurationMinutes, summarizeSet } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import { useWorkoutSession } from "../features/workouts/hooks";
import { StatusView } from "../components/StatusView";

export function WorkoutCompletePage() {
  const navigate = useNavigate();
  const { sessionId = "" } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const sessionQuery = useWorkoutSession(userId, sessionId);

  if (!user) {
    return null;
  }

  if (sessionQuery.isLoading) {
    return <StatusView title="Workout Saved" message="Loading your workout summary..." />;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <StatusView
        title="Workout Saved"
        message="This workout summary could not be loaded."
      />
    );
  }

  const session = sessionQuery.data;

  return (
    <main className="page-shell gap-4">
      <header className="space-y-2">
        <h1 className="page-title">Workout Saved</h1>
      </header>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="section-label">Summary</p>
            <p className="text-2xl font-bold text-ink">
              {session.performances.length} exercises •{" "}
              {session.performances.reduce(
                (count, performance) => count + performance.loggedSets.length,
                0,
              )}{" "}
              sets
            </p>
          </div>
          <span className="text-sm font-semibold text-muted">
            {formatDurationMinutes(session.startedAt, session.completedAt) ?? "Done"}
          </span>
        </div>
        <div className="space-y-3">
          {session.performances
            .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
            .map((performance) => {
              const isAssistance = performance.exercise.loadMode === "assistance";
              const setSummary = performance.loggedSets
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((set) => summarizeSet(set, performance.exercise.unit, isAssistance))
                .filter(Boolean)
                .join(" / ");

              return (
                <div key={performance.id}>
                  <p className="text-sm font-semibold leading-5 text-ink">
                    {performance.exercise.name}
                  </p>
                  {setSummary && (
                    <p className="text-sm leading-6 text-muted">{setSummary}</p>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      <div className="mt-auto">
        <button className="primary-button w-full" onClick={() => navigate("/today")}>
          Done
        </button>
      </div>
    </main>
  );
}
