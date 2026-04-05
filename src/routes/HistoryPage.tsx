import { Link } from "react-router-dom";

import { summarizeSession, formatDurationMinutes, formatWorkoutDate } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import { useCompletedWorkouts } from "../features/workouts/hooks";
import { StatusView } from "../components/StatusView";

export function HistoryPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const historyQuery = useCompletedWorkouts(userId);

  if (!user) {
    return null;
  }

  if (historyQuery.isLoading) {
    return <StatusView title="History" message="Loading completed workouts..." />;
  }

  if (historyQuery.isError) {
    return <StatusView title="History" message="Workout history could not be loaded." />;
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
        <p className="text-sm leading-6 text-muted">Past workouts, newest first.</p>
      </header>

      <div className="space-y-3">
        {historyQuery.data?.map((session) => (
          <section key={session.id} className="card space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-ink">{session.template.name}</h2>
                <p className="text-sm text-muted">
                  {formatWorkoutDate(session.completedAt)} •{" "}
                  {formatDurationMinutes(session.startedAt, session.completedAt) ?? "In progress"}
                </p>
              </div>
              <span className="rounded-full bg-black/[0.03] px-3 py-2 text-xs font-semibold text-ink">
                Completed
              </span>
            </div>
            <div className="space-y-2">
              {summarizeSession(session).map((line) => {
                const matchingPerformance = session.performances.find((performance) =>
                  line.startsWith(performance.exercise.name),
                );

                return (
                  <Link
                    key={line}
                    className="block text-sm leading-6 text-ink underline-offset-4 hover:underline"
                    to={
                      matchingPerformance
                        ? `/exercises/${matchingPerformance.exerciseId}`
                        : "/history"
                    }
                  >
                    {line}
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
