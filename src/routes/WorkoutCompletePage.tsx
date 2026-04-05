import { Link, useNavigate, useParams } from "react-router-dom";

import { formatDurationMinutes } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import { useWorkoutSession } from "../features/workouts/hooks";
import { getNextWorkoutName } from "../features/workouts/logic";
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
  const nextWorkoutName = getNextWorkoutName(session.template.name);

  return (
    <main className="page-shell gap-4">
      <header className="space-y-2">
        <h1 className="page-title">Workout Saved</h1>
        <p className="text-sm leading-6 text-muted">{session.template.name} is complete.</p>
      </header>

      <section className="card space-y-4 p-5">
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
        <p className="text-sm leading-6 text-ink">
          {
            session.performances.find((performance) =>
              performance.recommendationText.toLowerCase().includes("increase"),
            )?.recommendationText ?? "Workout saved successfully."
          }
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <p className="section-label">Next workout</p>
        <p className="font-display text-4xl font-bold text-ink">{nextWorkoutName}</p>
        <p className="text-sm leading-6 text-muted">
          The rotation advances automatically after {session.template.name}.
        </p>
      </section>

      <div className="mt-auto flex gap-3">
        <Link className="secondary-button flex-1" to="/history">
          Review Session
        </Link>
        <button className="primary-button flex-1" onClick={() => navigate("/today")}>
          Done
        </button>
      </div>
    </main>
  );
}
